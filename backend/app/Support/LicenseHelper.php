<?php

namespace App\Support;

use App\Models\FiscalSetting;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;

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

        // Check if manual offline license file exists
        if (!Storage::disk('local')->exists('license.json')) {
            // Default Demo Offline License
            return [
                'valid' => true,
                'licensee' => $hospitalName,
                'rtn' => $rtn,
                'expires_at' => null,
                'type' => 'Demo Local / Desarrollo',
                'message' => 'Sistema funcionando en modo desarrollo local. Para producción multi-dispositivo LAN, active su licencia comercial.'
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
                    'message' => 'Archivo de licencia corrupto o incompleto.'
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
                    'message' => "La licencia registrada para {$licenseData['licensee']} (RTN: {$licenseData['rtn']}) no coincide con el RTN del hospital actual ({$rtn})."
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
                    'type' => 'Licencia Expirada',
                    'message' => "La licencia comercial offline expiró el {$expiresAt->format('d/m/Y')}."
                ];
            }

            // Verify signature
            $expectedSignature = self::generateSignature($licenseData['licensee'], $licenseData['rtn'], $licenseData['expires_at']);
            if (!hash_equals($expectedSignature, $licenseData['signature'])) {
                return [
                    'valid' => false,
                    'licensee' => $licenseData['licensee'],
                    'rtn' => $licenseData['rtn'],
                    'expires_at' => $licenseData['expires_at'],
                    'type' => 'Firma Invalida',
                    'message' => 'La firma digital de la licencia no se pudo verificar. Firma alterada.'
                ];
            }

            return [
                'valid' => true,
                'licensee' => $licenseData['licensee'],
                'rtn' => $licenseData['rtn'],
                'expires_at' => $licenseData['expires_at'],
                'type' => 'Licencia Comercial LAN',
                'message' => "Licencia comercial offline totalmente válida y registrada a nombre de {$licenseData['licensee']}."
            ];

        } catch (\Exception $e) {
            return [
                'valid' => false,
                'licensee' => $hospitalName,
                'rtn' => $rtn,
                'expires_at' => null,
                'type' => 'Error de Lectura',
                'message' => 'Ocurrió un error al validar el archivo de licencia offline.'
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
            trim($expiresAt)
        ]);

        return hash_hmac('sha256', $payload, self::SECRET_SALT);
    }
}
