<?php

namespace App\Support;

use App\Models\FiscalSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class LicenseHelper
{
    private const SECRET_SALT = 'Hospital_OS_LAN_Secured_2026_Key';

    /**
     * Get the license status metadata.
     *
     * @return array{
     *     valid: bool,
     *     licensee: string,
     *     rtn: string,
     *     expires_at: string|null,
     *     type: string,
     *     message: string
     * }
     */
    public static function checkLicense(): array
    {
        $settings = FiscalSetting::query()->first();
        $hospitalName = HospitalName::display($settings?->hospital_name);
        $rtn = $settings?->rtn ?? 'N/A';

        // Check if manual offline registration file exists
        if (! Storage::disk('local')->exists('license.json')) {
            return [
                'valid' => true,
                'licensee' => $hospitalName,
                'rtn' => $rtn,
                'expires_at' => null,
                'type' => 'Operacion local',
                'message' => 'Sistema funcionando en modo local para la red del hospital.',
            ];
        }

        try {
            $licenseData = json_decode(Storage::disk('local')->get('license.json'), true, 512, JSON_THROW_ON_ERROR);

            if (empty($licenseData['licensee']) || empty($licenseData['rtn']) || empty($licenseData['expires_at']) || empty($licenseData['signature'])) {
                return [
                    'valid' => false,
                    'licensee' => $hospitalName,
                    'rtn' => $rtn,
                    'expires_at' => null,
                    'type' => 'Invalida',
                    'message' => 'Archivo de registro corrupto o incompleto.',
                ];
            }

            // Verify integrity matches active hospital or the licensed entity
            if ($licenseData['rtn'] !== $rtn) {
                return [
                    'valid' => false,
                    'licensee' => $licenseData['licensee'],
                    'rtn' => $licenseData['rtn'],
                    'expires_at' => $licenseData['expires_at'],
                    'type' => 'RTN Incompatible',
                    'message' => "El registro local para {$licenseData['licensee']} (RTN: {$licenseData['rtn']}) no coincide con el RTN del hospital actual ({$rtn}).",
                ];
            }

            // Validate expiration date
            $expiresAt = Carbon::parse($licenseData['expires_at']);
            if ($expiresAt->isPast()) {
                return [
                    'valid' => false,
                    'licensee' => $licenseData['licensee'],
                    'rtn' => $licenseData['rtn'],
                    'expires_at' => $licenseData['expires_at'],
                    'type' => 'Registro expirado',
                    'message' => "El registro local expiro el {$expiresAt->format('d/m/Y')}.",
                ];
            }

            // Verify signature
            $expectedSignature = self::generateSignature($licenseData['licensee'], $licenseData['rtn'], $licenseData['expires_at']);
            if (! hash_equals($expectedSignature, $licenseData['signature'])) {
                return [
                    'valid' => false,
                    'licensee' => $licenseData['licensee'],
                    'rtn' => $licenseData['rtn'],
                    'expires_at' => $licenseData['expires_at'],
                    'type' => 'Firma Invalida',
                    'message' => 'La firma digital del registro no se pudo verificar. Firma alterada.',
                ];
            }

            return [
                'valid' => true,
                'licensee' => $licenseData['licensee'],
                'rtn' => $licenseData['rtn'],
                'expires_at' => $licenseData['expires_at'],
                'type' => 'Registro LAN verificado',
                'message' => "Registro local verificado a nombre de {$licenseData['licensee']}.",
            ];

        } catch (\Exception $e) {
            return [
                'valid' => false,
                'licensee' => $hospitalName,
                'rtn' => $rtn,
                'expires_at' => null,
                'type' => 'Error de Lectura',
                'message' => 'Ocurrio un error al validar el archivo de registro local.',
            ];
        }
    }

    /**
     * Generate offline license signature.
     */
    public static function generateSignature(string $licensee, string $rtn, string $expiresAt): string
    {
        $payload = implode('|', [
            trim($licensee),
            trim($rtn),
            trim($expiresAt),
        ]);

        return hash_hmac('sha256', $payload, self::SECRET_SALT);
    }
}
