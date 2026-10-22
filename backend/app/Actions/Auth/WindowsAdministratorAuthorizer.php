<?php

namespace App\Actions\Auth;

use Symfony\Component\Process\Process;

class WindowsAdministratorAuthorizer
{
    /** @return array{sid: string, account: string}|null */
    public function authorization(): ?array
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            return null;
        }

        $script = <<<'POWERSHELL'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $json = @{ sid = $identity.User.Value; account = $identity.Name } | ConvertTo-Json -Compress
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
    exit 0
}
exit 5
POWERSHELL;

        try {
            $systemRoot = getenv('SystemRoot');
            if (! is_string($systemRoot) || $systemRoot === '') {
                return null;
            }
            $powerShell = realpath($systemRoot.'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
            if (! is_string($powerShell)) {
                return null;
            }

            $process = new Process([
                $powerShell,
                '-NoLogo',
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                $script,
            ]);
            $process->setTimeout(10);
            $process->run();

            if (! $process->isSuccessful()) {
                return null;
            }

            $encodedIdentity = trim($process->getOutput());
            $identityJson = base64_decode($encodedIdentity, true);
            if (! is_string($identityJson)) {
                return null;
            }
            $identity = json_decode($identityJson, true, 4, JSON_THROW_ON_ERROR);
            if (! is_array($identity) || ! is_string($identity['sid'] ?? null) || ! is_string($identity['account'] ?? null)) {
                return null;
            }

            return [
                'sid' => substr($identity['sid'], 0, 191),
                'account' => substr($identity['account'], 0, 191),
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}
