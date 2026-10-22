<?php

namespace App\Console\Commands;

use App\Actions\Auth\RecoverLocalAdminAccess;
use App\Actions\Auth\WindowsAdministratorAuthorizer;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

final class RecoverLocalAdminAccessCommand extends Command
{
    public const EXIT_NOT_AUTHORIZED = 10;

    public const EXIT_INVALID_INPUT = 11;

    public const EXIT_FAILED = 13;

    protected $signature = 'auth:recover-local-admin
        {--json : Emitir el resultado final en JSON}
        {--stdin-json : Leer usuario, motivo y contraseñas desde JSON por la entrada estándar}';

    protected $description = 'Recuperar el acceso de un administrador mediante una consola local elevada de Windows.';

    public function handle(
        WindowsAdministratorAuthorizer $authorizer,
        RecoverLocalAdminAccess $recovery,
    ): int {
        $authorization = $authorizer->authorization();
        if ($authorization === null) {
            return $this->finish(
                self::EXIT_NOT_AUTHORIZED,
                'Este procedimiento requiere autorización de administrador de Windows.',
            );
        }

        if ($this->option('stdin-json')) {
            $input = $this->readStandardInput();
            if ($input === null) {
                return $this->finish(self::EXIT_INVALID_INPUT, 'No se recibieron datos de recuperación válidos.');
            }

            $identity = trim($input['identity']);
            $reason = trim($input['reason']);
            $password = $input['password'];
            $confirmation = $input['password_confirmation'];
            $input['password'] = '';
            $input['password_confirmation'] = '';
            unset($input);
        } else {
            $identity = trim((string) $this->ask('Usuario o correo del administrador'));
            $reason = trim((string) $this->ask('Motivo de la recuperación'));
            $password = (string) $this->secret('Nueva contraseña temporal');
            $confirmation = (string) $this->secret('Repita la contraseña temporal');
        }

        if ($password === '' || ! hash_equals($password, $confirmation)) {
            return $this->finish(
                self::EXIT_INVALID_INPUT,
                'Las contraseñas no coinciden.',
            );
        }

        try {
            $user = $recovery->handle($identity, $password, $reason, $authorization);
        } catch (ValidationException $exception) {
            $message = collect($exception->errors())->flatten()->first();

            return $this->finish(
                self::EXIT_INVALID_INPUT,
                is_string($message) ? $message : 'Los datos de recuperación no son válidos.',
            );
        } catch (\Throwable $exception) {
            logger()->error('Falló la recuperación local de acceso.', [
                'exception_type' => $exception::class,
            ]);

            return $this->finish(
                self::EXIT_FAILED,
                'No se pudo completar la recuperación de acceso.',
            );
        } finally {
            $password = '';
            $confirmation = '';
        }

        return $this->finish(
            self::SUCCESS,
            'Acceso recuperado. Inicie sesión y cambie la contraseña temporal.',
            $user->username,
        );
    }

    private function finish(int $code, string $message, ?string $username = null): int
    {
        if ($this->option('json')) {
            $this->line(json_encode([
                'ok' => $code === self::SUCCESS,
                'code' => $code,
                'message' => $message,
                'username' => $username,
            ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        } elseif ($code === self::SUCCESS) {
            $this->info($message);
        } else {
            $this->error($message);
        }

        return $code;
    }

    /**
     * @return array{identity: string, reason: string, password: string, password_confirmation: string}|null
     */
    private function readStandardInput(): ?array
    {
        $payload = stream_get_contents(STDIN, 8193);
        if (! is_string($payload) || $payload === '' || strlen($payload) > 8192) {
            return null;
        }

        try {
            $decoded = json_decode($payload, true, 8, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        foreach (['identity', 'reason', 'password', 'password_confirmation'] as $field) {
            if (! isset($decoded[$field]) || ! is_string($decoded[$field])) {
                return null;
            }
        }

        return [
            'identity' => $decoded['identity'],
            'reason' => $decoded['reason'],
            'password' => $decoded['password'],
            'password_confirmation' => $decoded['password_confirmation'],
        ];
    }
}
