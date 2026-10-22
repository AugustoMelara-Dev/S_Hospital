<?php

namespace App\Console\Commands;

use App\Actions\Auth\CreateInitialAdminAccess;
use App\Actions\Auth\WindowsAdministratorAuthorizer;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

final class CreateInitialAdminAccessCommand extends Command
{
    protected $signature = 'auth:create-initial-admin-secure
        {--json : Emitir el resultado final en JSON}
        {--stdin-json : Leer los datos desde JSON por la entrada estándar}';

    protected $description = 'Crear el primer administrador desde una consola local elevada de Windows.';

    public function handle(WindowsAdministratorAuthorizer $authorizer, CreateInitialAdminAccess $creation): int
    {
        $authorization = $authorizer->authorization();
        if ($authorization === null) {
            return $this->finish(10, 'Este procedimiento requiere autorización de administrador de Windows.');
        }

        if ($this->option('stdin-json')) {
            $input = $this->readStandardInput();
            if ($input === null) {
                return $this->finish(11, 'No se recibieron datos de configuración válidos.');
            }
            ['name' => $name, 'username' => $username, 'email' => $email, 'password' => $password, 'password_confirmation' => $confirmation] = $input;
            $input['password'] = '';
            $input['password_confirmation'] = '';
            unset($input);
        } else {
            $name = $this->promptText('Nombre del administrador');
            $username = $this->promptText('Usuario');
            $email = $this->promptText('Correo');
            $password = $this->promptSecret('Contraseña temporal');
            $confirmation = $this->promptSecret('Repita la contraseña temporal');
        }

        if ($password === '' || ! hash_equals($password, $confirmation)) {
            return $this->finish(11, 'Las contraseñas no coinciden.');
        }

        try {
            $user = $creation->handle($name, $username, $email, $password, $authorization);
        } catch (ValidationException $exception) {
            $message = collect($exception->errors())->flatten()->first();

            return $this->finish(11, is_string($message) ? $message : 'Los datos no son válidos.');
        } catch (\Throwable $exception) {
            logger()->error('Falló la creación segura del administrador inicial.', ['exception_type' => $exception::class]);

            return $this->finish(13, 'No se pudo completar la configuración inicial.');
        } finally {
            $password = '';
            $confirmation = '';
        }

        return $this->finish(0, 'Administrador creado. Inicie sesión y cambie la contraseña temporal.', $user->username);
    }

    private function finish(int $code, string $message, ?string $username = null): int
    {
        if ($this->option('json')) {
            $this->line(json_encode(['ok' => $code === 0, 'code' => $code, 'message' => $message, 'username' => $username], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        } elseif ($code === 0) {
            $this->info($message);
        } else {
            $this->error($message);
        }

        return $code;
    }

    /** @return array{name:string, username:string, email:string, password:string, password_confirmation:string}|null */
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

        foreach (['name', 'username', 'email', 'password', 'password_confirmation'] as $field) {
            if (! isset($decoded[$field]) || ! is_string($decoded[$field])) {
                return null;
            }
        }

        return [
            'name' => $decoded['name'],
            'username' => $decoded['username'],
            'email' => $decoded['email'],
            'password' => $decoded['password'],
            'password_confirmation' => $decoded['password_confirmation'],
        ];
    }

    private function promptText(string $question): string
    {
        $value = $this->ask($question);

        return is_string($value) ? trim($value) : '';
    }

    private function promptSecret(string $question): string
    {
        $value = $this->secret($question);

        return is_string($value) ? $value : '';
    }
}
