<?php

namespace App\Support;

use App\Models\FiscalSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class LicenseHelper
{
    private static function secretSalt(): string
    {
        $configured = self::configuredString('app.license_salt');

        if ($configured !== '') {
            return $configured;
        }

        throw new RuntimeException(
            'HOSPITAL_LICENSE_SALT must be configured in the environment to sign or verify '
            .'offline registration files. The previous hardcoded default has been removed; '
            .'see docs/SECRETS.md.'
        );
    }

    /**
     * @return array{valid: bool, licensee: string, rtn: string, expires_at: string|null, type: string, message: string}
     */
    public static function checkLicense(): array
    {
        $settings = FiscalSetting::query()->firstOrNew();
        $hospitalName = HospitalName::display($settings->hospital_name);
        $configuredRtn = $settings->rtn;
        $rtn = $configuredRtn !== '' ? $configuredRtn : 'N/A';

        $configured = self::configuredString('app.license_salt');

        if (! Storage::disk('local')->exists('license.json')) {
            if ($configured === '' && self::configuredString('app.env', 'production') === 'production') {
                return [
                    'valid' => false,
                    'licensee' => $hospitalName,
                    'rtn' => $rtn,
                    'expires_at' => null,
                    'type' => 'Salt de Registro Faltante',
                    'message' => 'Configure HOSPITAL_LICENSE_SALT antes de operar en produccion.',
                ];
            }

            return [
                'valid' => true,
                'licensee' => $hospitalName,
                'rtn' => $rtn,
                'expires_at' => null,
                'type' => 'Operacion local',
                'message' => 'Sistema funcionando en modo local para la red del hospital.',
            ];
        }

        if ($configured === '') {
            return [
                'valid' => false,
                'licensee' => $hospitalName,
                'rtn' => $rtn,
                'expires_at' => null,
                'type' => 'Salt de Registro Faltante',
                'message' => 'Configure HOSPITAL_LICENSE_SALT antes de validar un archivo de registro local en produccion.',
            ];
        }

        try {
            $contents = Storage::disk('local')->get('license.json');

            if (! is_string($contents)) {
                throw new RuntimeException('No se pudo leer el archivo de registro local.');
            }

            $licenseData = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);

            if (
                ! is_array($licenseData)
                || ! is_string($licenseData['licensee'] ?? null)
                || ! is_string($licenseData['rtn'] ?? null)
                || ! is_string($licenseData['expires_at'] ?? null)
                || ! is_string($licenseData['signature'] ?? null)
                || empty($licenseData['licensee'])
                || empty($licenseData['rtn'])
                || empty($licenseData['expires_at'])
                || empty($licenseData['signature'])
            ) {
                return [
                    'valid' => false,
                    'licensee' => $hospitalName,
                    'rtn' => $rtn,
                    'expires_at' => null,
                    'type' => 'Invalida',
                    'message' => 'Archivo de registro corrupto o incompleto.',
                ];
            }

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
        } catch (\Exception) {
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

    public static function generateSignature(string $licensee, string $rtn, string $expiresAt): string
    {
        $payload = implode('|', [
            trim($licensee),
            trim($rtn),
            trim($expiresAt),
        ]);

        return hash_hmac('sha256', $payload, self::secretSalt());
    }

    private static function configuredString(string $key, string $default = ''): string
    {
        if (! function_exists('config')) {
            return $default;
        }

        $value = config($key, $default);

        return is_string($value) ? $value : $default;
    }
}
