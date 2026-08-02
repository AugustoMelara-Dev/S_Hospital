function Get-WindowsCleanContract {
    [ordered]@{
        SchemaVersion = 1
        EvidenceRoot = 'qa/pre-installation-final/windows-clean'
        ExpectedSourceCommit = '5e7d48ecd6b7d8a0f647d8892e90fe8ac1b91c3e'
        ExpectedInstallerSha256 = '0a2947fd88d6ee4415b5bac314bbf4da6d7f89a72c570088116ffb54832b8559'
        ExpectedInstallerSizeBytes = [int64]404209817
        TestNames = @(
            'hash_in_vm',
            'installation',
            'first_start',
            'configuration',
            'invoice_l900',
            'logical_print',
            'physical_print',
            'reprint',
            'cancellation',
            'maintenance',
            'backup',
            'restore',
            'rollback',
            'windows_restart',
            'offline_operation',
            'uninstall_reinstall'
        )
        CoreTestNames = @(
            'hash_in_vm',
            'installation',
            'first_start',
            'configuration',
            'invoice_l900',
            'logical_print',
            'reprint',
            'cancellation',
            'maintenance',
            'backup',
            'restore',
            'rollback',
            'windows_restart',
            'offline_operation',
            'uninstall_reinstall'
        )
        PhaseDirectories = @(
            '00-environment',
            '01-hash-and-signature',
            '02-installation',
            '03-first-start',
            '04-configuration',
            '05-cash-and-invoice',
            '06-print-reprint-cancel',
            '07-maintenance',
            '08-backup',
            '09-restore',
            '10-rollback',
            '11-restart',
            '12-offline-check',
            '13-uninstall-reinstall',
            '14-final-report'
        )
        AllowedTestStatuses = @('PENDING', 'PASSED', 'FAILED', 'BLOCKED')
    }
}

function Get-WindowsCleanResultPath {
    param(
        [string] $ProjectRoot,
        [string] $EvidenceDir = ''
    )

    if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
        $EvidenceDir = Join-Path $ProjectRoot 'qa/pre-installation-final/windows-clean'
    }
    Join-Path $EvidenceDir 'RESULT.json'
}
