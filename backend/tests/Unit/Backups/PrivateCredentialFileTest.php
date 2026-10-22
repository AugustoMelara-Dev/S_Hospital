<?php

declare(strict_types=1);

namespace Tests\Unit\Backups;

use App\Actions\Backups\PrivateCredentialFile;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PrivateCredentialFileTest extends TestCase
{
    public function test_it_creates_credentials_below_a_private_application_directory_and_removes_them(): void
    {
        $root = storage_path('framework/testing/backup-private-'.bin2hex(random_bytes(4)));
        config()->set('backups.private_temp_root', $root);
        $credential = app(PrivateCredentialFile::class);

        $path = $credential->create("[client]\npassword=synthetic-only\n");

        try {
            $this->assertStringStartsWith(realpath($root).DIRECTORY_SEPARATOR, realpath($path));
            $this->assertSame("[client]\npassword=synthetic-only\n", file_get_contents($path));
            if (DIRECTORY_SEPARATOR === '/') {
                $this->assertSame('0600', substr(sprintf('%o', fileperms($path)), -4));
            }
        } finally {
            $credential->remove($path);
            $this->assertFileDoesNotExist($path);
        }

        $secondPath = $credential->create("[client]\npassword=synthetic-second\n");
        try {
            $this->assertSame("[client]\npassword=synthetic-second\n", file_get_contents($secondPath));
        } finally {
            $credential->remove($secondPath);
            @rmdir($root);
        }
    }

    public function test_it_removes_a_preexisting_everyone_full_control_entry_before_writing_credentials(): void
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->markTestSkipped('La regresion DACL corresponde a Windows.');
        }

        $root = storage_path('framework/testing/backup-private-'.bin2hex(random_bytes(4)));
        mkdir($root, 0700, true);
        $systemRoot = (string) getenv('SystemRoot');
        $icacls = $systemRoot.'\\System32\\icacls.exe';
        $powershell = $systemRoot.'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        $grant = new Process([$icacls, $root, '/grant', '*S-1-1-0:(OI)(CI)F']);
        $grant->mustRun();

        config()->set('backups.private_temp_root', $root);
        $credential = app(PrivateCredentialFile::class);
        $path = $credential->create("[client]\npassword=synthetic-only\n");

        try {
            $encodedPath = base64_encode($root);
            $script = '$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(\''.$encodedPath.'\')); '
                .'Import-Module (Join-Path $PSHOME \'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1\'); '
                .'$bad=@((Get-Acl -LiteralPath $p).Access | Where-Object {$_.AccessControlType -eq \'Allow\' -and $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq \'S-1-1-0\'}); '
                .'if($bad.Count -ne 0){exit 9}';
            $audit = new Process([$powershell, '-NoProfile', '-NonInteractive', '-Command', $script]);
            $audit->run();
            $this->assertSame(0, $audit->getExitCode(), 'La DACL privada conservo una entrada Everyone.') ;
        } finally {
            $credential->remove($path);
            @rmdir($root);
        }
    }
}
