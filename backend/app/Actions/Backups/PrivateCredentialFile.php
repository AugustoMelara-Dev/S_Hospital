<?php

declare(strict_types=1);

namespace App\Actions\Backups;

use RuntimeException;
use Symfony\Component\Process\Process;

class PrivateCredentialFile
{
    public function create(string $contents): string
    {
        $root = $this->root();
        if (! is_dir($root) && ! @mkdir($root, 0700, true) && ! is_dir($root)) {
            throw new RuntimeException('No se pudo preparar el directorio privado de credenciales.');
        }
        $this->restrict($root, true);

        $path = $root.DIRECTORY_SEPARATOR.'mysql-'.bin2hex(random_bytes(16)).'.cnf';
        $handle = @fopen($path, 'x+b');
        if ($handle === false) {
            throw new RuntimeException('No se pudo crear el archivo privado de credenciales.');
        }
        try {
            @chmod($path, 0600);
            $offset = 0;
            while ($offset < strlen($contents)) {
                $written = fwrite($handle, substr($contents, $offset));
                if ($written === false || $written === 0) {
                    throw new RuntimeException('No se pudo escribir el archivo privado de credenciales.');
                }
                $offset += $written;
            }
            if (! fflush($handle)) {
                throw new RuntimeException('No se pudo confirmar el archivo privado de credenciales.');
            }
        } catch (\Throwable $exception) {
            fclose($handle);
            @unlink($path);
            throw $exception;
        }
        fclose($handle);
        try {
            $this->restrict($path, false);
        } catch (\Throwable $exception) {
            @unlink($path);
            throw $exception;
        }

        return $path;
    }

    public function remove(string $path): void
    {
        if ($path !== '' && is_file($path) && ! @unlink($path)) {
            throw new RuntimeException('No se pudo eliminar el archivo temporal de credenciales.');
        }
    }

    private function root(): string
    {
        $configured = config('backups.private_temp_root');
        if (is_string($configured) && trim($configured) !== '') {
            return rtrim($configured, '/\\');
        }

        return storage_path('framework/backup-private');
    }

    private function restrict(string $path, bool $directory): void
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            $mode = $directory ? 0700 : 0600;
            if (! @chmod($path, $mode) || ((fileperms($path) & 0777) !== $mode)) {
                throw new RuntimeException('No se pudieron restringir las credenciales temporales.');
            }

            return;
        }

        $systemRoot = getenv('SystemRoot');
        if (! is_string($systemRoot) || trim($systemRoot) === '') {
            throw new RuntimeException('No se pudo localizar el sistema protegido de Windows.');
        }
        $whoami = $systemRoot.'\\System32\\whoami.exe';
        $powershell = $systemRoot.'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        if (! is_file($whoami) || ! is_file($powershell)) {
            throw new RuntimeException('No se pudieron localizar las herramientas protegidas de Windows.');
        }
        $identity = new Process([$whoami, '/user', '/fo', 'csv', '/nh']);
        $identity->setTimeout(10);
        $identity->run();
        if (! $identity->isSuccessful()
            || ! preg_match('/\b(S-1-5-(?:\d+-){1,14}\d+)\b/i', $identity->getOutput(), $match)) {
            throw new RuntimeException('No se pudo identificar la cuenta del proceso de respaldos.');
        }
        $processSid = strtoupper($match[1]);
        $script = <<<'POWERSHELL'
$ErrorActionPreference='Stop'
$target=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__TARGET__'))
$processSid=[Text.Encoding]::ASCII.GetString([Convert]::FromBase64String('__SID__'))
$directoryFlag='__DIRECTORY__'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$allowed=@('S-1-5-18','S-1-5-32-544',$processSid)
$isDirectory=$directoryFlag -eq '1'
$acl=Get-Acl -LiteralPath $target
$acl.SetAccessRuleProtection($true,$false)
foreach($existing in @($acl.Access)){[void]$acl.RemoveAccessRuleSpecific($existing)}
foreach($value in $allowed){
  $sid=[Security.Principal.SecurityIdentifier]::new($value)
  $inherit=if($isDirectory){[Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
  [void]$acl.AddAccessRule($rule)
}
if($isDirectory){([IO.DirectoryInfo]::new($target)).SetAccessControl($acl)}else{([IO.FileInfo]::new($target)).SetAccessControl($acl)}
$actual=Get-Acl -LiteralPath $target
$ownerSid=$actual.GetOwner([Security.Principal.SecurityIdentifier]).Value
if($ownerSid -notin $allowed -or -not $actual.AreAccessRulesProtected){throw 'Unexpected ACL owner or inheritance.'}
foreach($rule in $actual.Access){
  $sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  if($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $sid -notin $allowed){throw 'Unexpected ACL entry.'}
}
POWERSHELL;
        $script = str_replace(
            ['__TARGET__', '__SID__', '__DIRECTORY__'],
            [base64_encode($path), base64_encode($processSid), $directory ? '1' : '0'],
            $script,
        );
        $process = new Process(
            [$powershell, '-NoProfile', '-NonInteractive', '-Command', $script],
        );
        $process->setTimeout(15);
        $process->run();
        if (! $process->isSuccessful()) {
            throw new RuntimeException('No se pudieron restringir las credenciales temporales.');
        }
    }
}
