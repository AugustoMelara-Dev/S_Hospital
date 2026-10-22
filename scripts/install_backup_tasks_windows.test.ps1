#Requires -Version 5.1
#
# Contract test for scripts/install_backup_tasks_windows.ps1 (F027 / T3-011;
# hardened by T3-018 for RV-T3-011).
#
# The registrar must:
#   * keep the `-BackupWorker` task (queue:work for UI backups);
#   * register a `-Scheduler` task that runs the Laravel scheduler every minute
#     through the `-SchedulerTick` runtime mode: `schedule:run --no-interaction`
#     plus `hospital:scheduler-tick --result=ok` / `--result=fail
#     --message=schedule:run failed`, exactly like the Docker scheduler sidecar
#     (docker-compose.prod.yml:289-307) and the T3-003 loop;
#   * never register a direct `hospital:backup` task (the Laravel schedule in
#     backend/routes/console.php is the single owner of backup automation);
#   * retire the legacy `-DailyBackup` task on -UpdateExisting/-Uninstall;
#   * keep the effective daily backup hour owned by HOSPITAL_DAILY_BACKUP_TIME
#     (backend/config/hospital.php:7), with -DailyBackupTime accepted only for
#     compatibility;
#   * keep the native php call stderr-safe in PS 5.1: $ErrorActionPreference is
#     relaxed around `& php ... 2>&1`, exit 0 with stderr still records tick ok,
#     a non-zero exit with stderr still records the Docker-parity tick fail, and
#     an unusable php path still attempts the fail heartbeat (RV-T3-011).
#
# Checks are AST-based (comments cannot satisfy them) plus controlled runs with
# synthetic disposable resources under %TEMP%: a fake backend/artisan and a
# fake php.cmd that records every invocation and can write to stderr. No real
# PHP, MySQL, Docker, backup or scheduled task registration is performed.
#
# Runtime mode is also executed directly (-SchedulerTick) with the fake php.cmd
# to verify exit codes and exact argument passing; -WhatIfOnly and -Status are
# exercised with a synthetic task prefix so no real task is touched.

$ErrorActionPreference = 'Stop'

$registrarScript = Join-Path $PSScriptRoot 'install_backup_tasks_windows.ps1'

$script:Checks = 0
$script:Errors = @()
$script:Skips = @()

function Assert-RegistrarContract {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

function Add-RegistrarSkip {
    param([string] $Message)
    $script:Skips += $Message
}

function Get-CommandAsts {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true))
}

function Get-CommandTexts {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @(Get-CommandAsts -Ast $Ast | ForEach-Object { $_.Extent.Text })
}

function Get-CommandRecords {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @(Get-CommandAsts -Ast $Ast | ForEach-Object {
        [pscustomobject]@{
            Text = $_.Extent.Text
            StartOffset = $_.Extent.StartOffset
        }
    })
}

function Get-MatchingCommandTexts {
    param([string[]] $CommandTexts, [string] $Pattern)
    return @($CommandTexts | Where-Object { $_ -match $Pattern })
}

function Get-StringValues {
    param([System.Management.Automation.Language.Ast] $Ast)

    $values = @()
    $constantStrings = $Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.StringConstantExpressionAst]
    }, $true)
    foreach ($node in $constantStrings) { $values += $node.Value }

    $expandableStrings = $Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.ExpandableStringExpressionAst]
    }, $true)
    foreach ($node in $expandableStrings) { $values += $node.Value }

    return @($values)
}

function Get-IfStatements {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.IfStatementAst]
    }, $true))
}

function Get-ForeachStatementTexts {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.ForeachStatementAst]
    }, $true) | ForEach-Object { $_.Extent.Text })
}

function Get-HashtableKeys {
    param([System.Management.Automation.Language.Ast] $Ast)

    $keys = @()
    $tables = @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.HashtableAst]
    }, $true))
    foreach ($table in $tables) {
        foreach ($pair in $table.KeyValuePairs) {
            $keyAst = $pair.Item1
            if ($keyAst -is [System.Management.Automation.Language.StringConstantExpressionAst]) {
                $keys += $keyAst.Value
            }
            elseif ($null -ne $keyAst -and $null -ne $keyAst.Extent) {
                $keys += $keyAst.Extent.Text.Trim("'", '"')
            }
        }
    }

    return @($keys)
}

function Get-FunctionDefinitions {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true))
}

function Get-AssignmentStatements {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst]
    }, $true))
}

function New-RegistrarFixture {
    param([string] $Root)

    $backendDir = Join-Path $Root 'backend'
    New-Item -ItemType Directory -Force -Path $backendDir | Out-Null
    Set-Content -LiteralPath (Join-Path $backendDir 'artisan') -Value '<?php // synthetic placeholder; never executed' -Encoding ASCII

    $scriptsDir = Join-Path $Root 'scripts'
    New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
    Set-Content -LiteralPath (Join-Path $scriptsDir 'run_backup_worker.cmd') -Value '@echo off' -Encoding ASCII

    # Top-level labels plus `exit /b` are used instead of nested parenthesized
    # blocks: in cmd the requested exit code inside a nested block is
    # unreliable (observed 0 instead of 7). The stub records every invocation
    # and can write to stderr for schedule:run with exit 0 (false-failure
    # control) or exit 7 (lost-heartbeat control).
    $phpCmd = Join-Path $Root 'php.cmd'
    $fakePhpLines = @(
        '@echo off',
        'setlocal',
        'echo %*>>"%~dp0php-invocations.log"',
        'if "%~2"=="schedule:run" if "%T3_018_TEST_STDERR_OK_SCHEDULE_RUN%"=="1" goto :stderr_ok',
        'if "%~2"=="schedule:run" if "%T3_018_TEST_STDERR_FAIL_SCHEDULE_RUN%"=="1" goto :stderr_fail',
        'if "%~2"=="schedule:run" if "%T3_018_TEST_FAIL_SCHEDULE_RUN%"=="1" goto :exit7',
        'goto :ok',
        ':stderr_ok',
        'echo synthetic schedule:run stderr 1>&2',
        'exit /b 0',
        ':stderr_fail',
        'echo synthetic schedule:run stderr 1>&2',
        'exit /b 7',
        ':exit7',
        'exit /b 7',
        ':ok',
        'exit /b 0'
    )
    Set-Content -LiteralPath $phpCmd -Value $fakePhpLines -Encoding ASCII

    return $phpCmd
}

function Get-InvocationLog {
    param([string] $Root)

    $logFile = Join-Path $Root 'php-invocations.log'
    if (Test-Path -LiteralPath $logFile) {
        return [string] (Get-Content -LiteralPath $logFile -Raw -ErrorAction SilentlyContinue)
    }

    return ''
}

function ConvertTo-QuotedProcessArgument {
    param([string[]] $Arguments)

    # PS 5.1 Start-Process joins -ArgumentList elements with spaces without
    # quoting them, so a path containing spaces (possible %TEMP% or checkout
    # root) would be split. Quote every element that contains whitespace,
    # mirroring the T3-003 loop smoke runs.
    return @($Arguments | ForEach-Object {
        $argument = [string] $_
        if ($argument -match '\s') {
            return '"' + $argument + '"'
        }
        return $argument
    })
}

function Invoke-RegistrarProcess {
    param(
        [string[]] $Arguments,
        [hashtable] $Environment,
        [string] $WorkingRoot
    )

    $stdoutPath = Join-Path $WorkingRoot 'process.stdout.log'
    $stderrPath = Join-Path $WorkingRoot 'process.stderr.log'
    $trackedVariables = @(
        'T3_018_TEST_FAIL_SCHEDULE_RUN',
        'T3_018_TEST_STDERR_OK_SCHEDULE_RUN',
        'T3_018_TEST_STDERR_FAIL_SCHEDULE_RUN'
    )
    $previousValues = @{}
    $exitCode = -999

    try {
        foreach ($name in $trackedVariables) {
            $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
            [Environment]::SetEnvironmentVariable($name, $null, 'Process')
        }
        if ($null -ne $Environment) {
            foreach ($name in @($Environment.Keys)) {
                [Environment]::SetEnvironmentVariable([string] $name, [string] $Environment[$name], 'Process')
            }
        }

        $processArguments = @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', $registrarScript
        ) + $Arguments
        $process = Start-Process -FilePath 'powershell.exe' `
            -ArgumentList (ConvertTo-QuotedProcessArgument -Arguments $processArguments) `
            -PassThru -Wait -NoNewWindow `
            -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $exitCode = $process.ExitCode
    }
    finally {
        foreach ($name in $trackedVariables) {
            [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process')
        }
    }

    $stdout = ''
    if (Test-Path -LiteralPath $stdoutPath) { $stdout = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue }
    $stderr = ''
    if (Test-Path -LiteralPath $stderrPath) { $stderr = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue }

    return [pscustomobject]@{
        ExitCode = $exitCode
        StdOut = [string] $stdout
        StdErr = [string] $stderr
    }
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-tasks-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    Assert-RegistrarContract (Test-Path -LiteralPath $registrarScript -PathType Leaf) 'scripts/install_backup_tasks_windows.ps1 must exist.'

    if (Test-Path -LiteralPath $registrarScript -PathType Leaf) {
        $tokens = $null
        $parseErrors = $null
        $registrarAst = [System.Management.Automation.Language.Parser]::ParseFile($registrarScript, [ref] $tokens, [ref] $parseErrors)

        Assert-RegistrarContract (@($parseErrors).Count -eq 0) ('Registrar must parse with 0 errors under Windows PowerShell 5.1; first error: ' + (@($parseErrors) | Select-Object -First 1).Message)

        $commandTexts = Get-CommandTexts -Ast $registrarAst
        $stringValues = Get-StringValues -Ast $registrarAst
        $ifStatements = Get-IfStatements -Ast $registrarAst
        $foreachTexts = Get-ForeachStatementTexts -Ast $registrarAst
        $hashtableKeys = Get-HashtableKeys -Ast $registrarAst
        $functionDefinitions = Get-FunctionDefinitions -Ast $registrarAst

        # Parameters preserved for existing operator commands and launchers.
        $paramNames = @()
        if ($null -ne $registrarAst.ParamBlock) {
            $paramNames = @($registrarAst.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
        }
        foreach ($expectedParam in @('ProjectRoot', 'PhpPath', 'TaskPrefix', 'DailyBackupTime', 'SchedulerTick', 'WhatIfOnly', 'UpdateExisting', 'Uninstall', 'Status', 'JsonStatus')) {
            Assert-RegistrarContract ($paramNames -contains $expectedParam) "Registrar must keep accepting the -$expectedParam parameter."
        }

        # Laravel scheduler parity (Docker sidecar / T3-003 loop). Only actual
        # Invoke-Artisan commands count; operator messages cannot satisfy it.
        $scheduleRunCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Invoke-Artisan\b' | Where-Object { $_ -match 'schedule:run' -and $_ -notmatch '--message=' })
        Assert-RegistrarContract ($scheduleRunCommands.Count -ge 1) 'Registrar must invoke php artisan schedule:run (Docker scheduler parity).'
        $scheduleRunQuoted = @($scheduleRunCommands | Where-Object { $_ -match '"schedule:run"' })
        Assert-RegistrarContract ($scheduleRunQuoted.Count -ge 1) 'Registrar must pass schedule:run as a real artisan invocation argument.'
        $scheduleRunNoInteraction = @($scheduleRunCommands | Where-Object { $_ -match '--no-interaction' })
        Assert-RegistrarContract ($scheduleRunNoInteraction.Count -ge 1) 'schedule:run must keep --no-interaction like the Docker scheduler sidecar.'

        $tickCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Invoke-Artisan\b' | Where-Object { $_ -match 'hospital:scheduler-tick' })
        Assert-RegistrarContract ($tickCommands.Count -ge 2) 'Registrar must invoke hospital:scheduler-tick for both ok and fail results.'
        $tickOkCommands = @($tickCommands | Where-Object { $_ -match '--result=ok' })
        Assert-RegistrarContract ($tickOkCommands.Count -ge 1) 'Registrar must record hospital:scheduler-tick --result=ok after a successful schedule:run.'
        $tickFailCommands = @($tickCommands | Where-Object { $_ -match '--result=fail' -and $_ -match 'schedule:run failed' })
        Assert-RegistrarContract ($tickFailCommands.Count -ge 1) 'Registrar must record hospital:scheduler-tick --result=fail --message=schedule:run failed when schedule:run fails, matching Docker.'

        # RV-T3-011 finding 1: the native php call must be stderr-safe in
        # PS 5.1. Invoke-Artisan relaxes $ErrorActionPreference around the call
        # (restoring it afterwards) while still merging stderr with 2>&1.
        $invokeArtisanDefinitions = @($functionDefinitions | Where-Object { $_.Name -eq 'Invoke-Artisan' })
        Assert-RegistrarContract ($invokeArtisanDefinitions.Count -eq 1) 'Registrar must keep exactly one Invoke-Artisan helper.'
        if ($invokeArtisanDefinitions.Count -eq 1) {
            $invokeBody = $invokeArtisanDefinitions[0].Body
            $invokeAssignments = @(Get-AssignmentStatements -Ast $invokeBody)
            $relaxAssignments = @($invokeAssignments | Where-Object { $_.Left.Extent.Text -eq '$ErrorActionPreference' -and $_.Right.Extent.Text -eq '"Continue"' })
            Assert-RegistrarContract ($relaxAssignments.Count -ge 1) 'Invoke-Artisan must relax $ErrorActionPreference to "Continue" around the native php call so a stderr line cannot raise a terminating NativeCommandError in PS 5.1 (RV-T3-011).'
            $restoreAssignments = @($invokeAssignments | Where-Object { $_.Left.Extent.Text -eq '$ErrorActionPreference' -and $_.Right.Extent.Text -eq '$previousErrorActionPreference' })
            Assert-RegistrarContract ($restoreAssignments.Count -ge 1) 'Invoke-Artisan must restore the previous $ErrorActionPreference after the native php call.'
            $mergedStderrRedirections = @($invokeBody.FindAll({
                param($node) $node -is [System.Management.Automation.Language.MergingRedirectionAst] -and
                             $node.FromStream -eq 'Error' -and $node.ToStream -eq 'Output'
            }, $true))
            Assert-RegistrarContract ($mergedStderrRedirections.Count -ge 1) 'Invoke-Artisan must keep merging stderr into the captured output (2>&1) so schedule:run failures keep their diagnostics.'
        }

        # The fail heartbeat is a single helper (T3-003 loop parity) used both
        # by the non-zero exit path and by the invocation-error catch.
        $tickFailureDefinitions = @($functionDefinitions | Where-Object { $_.Name -eq 'Write-SchedulerFailure' })
        Assert-RegistrarContract ($tickFailureDefinitions.Count -eq 1) 'Registrar must keep exactly one Write-SchedulerFailure helper for the fail heartbeat.'
        if ($tickFailureDefinitions.Count -eq 1) {
            $tickFailureCommands = @(Get-CommandTexts -Ast $tickFailureDefinitions[0].Body)
            $tickFailureFailTicks = @($tickFailureCommands | Where-Object { $_ -match '^Invoke-Artisan\b' -and $_ -match '--result=fail' -and $_ -match 'schedule:run failed' })
            Assert-RegistrarContract ($tickFailureFailTicks.Count -ge 1) 'Write-SchedulerFailure must invoke hospital:scheduler-tick --result=fail --message=schedule:run failed.'
        }

        # The tick runtime mode must exist with an exact `$SchedulerTick` guard,
        # must handle both outcomes with consistent exit codes, and must run
        # before the administrator check (Task Scheduler runs it unelevated).
        $schedulerTickGuards = @($ifStatements | Where-Object {
            $conditionTexts = @($_.Clauses | ForEach-Object { $_.Item1.Extent.Text.Trim() })
            @($conditionTexts | Where-Object { $_ -eq '$SchedulerTick' }).Count -ge 1
        })
        Assert-RegistrarContract ($schedulerTickGuards.Count -eq 1) 'Registrar must keep exactly one runtime guard `if ($SchedulerTick) { ... }` for the registered scheduler task.'
        if ($schedulerTickGuards.Count -eq 1) {
            $tickBody = $schedulerTickGuards[0].Extent.Text
            Assert-RegistrarContract ($tickBody -match '"schedule:run"' -and $tickBody -match '--no-interaction') 'The $SchedulerTick runtime mode must run schedule:run --no-interaction.'
            Assert-RegistrarContract ($tickBody -match 'hospital:scheduler-tick' -and $tickBody -match '--result=fail' -and $tickBody -match 'schedule:run failed') 'The $SchedulerTick runtime mode must record tick ok/fail like Docker.'
            Assert-RegistrarContract ($tickBody -match '\bexit 0\b' -and $tickBody -match '\bexit 1\b') 'The $SchedulerTick runtime mode must exit 0 on success and 1 on schedule:run failure.'

            # RV-T3-011: when schedule:run cannot even start, the catch must
            # still attempt the Docker-parity fail heartbeat before exiting 1.
            $tickCatchClauses = @($schedulerTickGuards[0].FindAll({
                param($node) $node -is [System.Management.Automation.Language.CatchClauseAst]
            }, $true))
            Assert-RegistrarContract ($tickCatchClauses.Count -ge 1) 'The $SchedulerTick runtime mode must keep a catch for schedule:run invocation errors.'
            $catchFailAttempts = @()
            foreach ($clause in $tickCatchClauses) {
                if ($null -eq $clause.Body) { continue }
                $catchFailAttempts += @(Get-CommandTexts -Ast $clause.Body | Where-Object { $_ -match '^Write-SchedulerFailure\b' })
            }
            Assert-RegistrarContract ($catchFailAttempts.Count -ge 1) 'The invocation-error catch must still attempt the fail heartbeat (Write-SchedulerFailure) before exiting 1 (RV-T3-011).'
        }
        $adminGuards = @($ifStatements | Where-Object { $_.Extent.Text -match 'Test-IsAdmin' })
        Assert-RegistrarContract ($adminGuards.Count -ge 1) 'Registrar must keep the administrator guard for registration/update/uninstall.'
        if ($schedulerTickGuards.Count -eq 1 -and $adminGuards.Count -ge 1) {
            Assert-RegistrarContract ($schedulerTickGuards[0].Extent.StartOffset -lt $adminGuards[0].Extent.StartOffset) 'The $SchedulerTick runtime mode must run before the administrator check so the scheduled task works unelevated.'
        }

        # No duplicate backup automation: schedule:run is the single owner.
        $duplicateBackupCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern 'hospital:backup')
        Assert-RegistrarContract ($duplicateBackupCommands.Count -eq 0) 'Registrar must not run its own hospital:backup; the Laravel schedule owns the daily and operational backups.'
        $duplicateBackupStrings = @($stringValues | Where-Object { $_ -match 'hospital:backup' })
        Assert-RegistrarContract ($duplicateBackupStrings.Count -eq 0) 'Registrar must not build any hospital:backup command string.'
        $legacyWrapperReferences = @(@($commandTexts) + @($stringValues) | Where-Object { $_ -match 'run_scheduled_backup' })
        Assert-RegistrarContract ($legacyWrapperReferences.Count -eq 0) 'Registrar must not keep using the retired run_scheduled_backup.cmd wrapper.'

        # Exactly two task definitions plus one XML-only rollback path. The
        # pair helper is reused for staging and final registration.
        $registerCalls = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Register-ScheduledTask\b')
        Assert-RegistrarContract ($registerCalls.Count -eq 3) 'Registrar must define worker, scheduler and the XML rollback registration path.'
        $workerRegisters = @($registerCalls | Where-Object { $_ -match '\$WorkerName' })
        Assert-RegistrarContract ($workerRegisters.Count -eq 1) 'Registrar must register the -BackupWorker task.'
        $schedulerRegisters = @($registerCalls | Where-Object { $_ -match '\$SchedulerName' })
        Assert-RegistrarContract ($schedulerRegisters.Count -eq 1) 'Registrar must register the -Scheduler task.'
        $dailyRegisters = @($registerCalls | Where-Object { $_ -match 'DailyBackup' })
        Assert-RegistrarContract ($dailyRegisters.Count -eq 0) 'Registrar must not register the legacy direct DailyBackup task anymore.'

        Assert-RegistrarContract (@($stringValues | Where-Object { $_ -eq '$TaskPrefix-BackupWorker' }).Count -ge 1) 'Registrar must keep the $TaskPrefix-BackupWorker task name.'
        Assert-RegistrarContract (@($stringValues | Where-Object { $_ -eq '$TaskPrefix-Scheduler' }).Count -ge 1) 'Registrar must define the $TaskPrefix-Scheduler task name.'
        Assert-RegistrarContract (@($stringValues | Where-Object { $_ -eq '$TaskPrefix-DailyBackup' }).Count -ge 1) 'Registrar must keep the $TaskPrefix-DailyBackup name to retire legacy installs.'

        # Scheduler trigger: every 1 minute, duration-bounded, never a daily
        # direct backup trigger.
        $triggerCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^New-ScheduledTaskTrigger\b')
        $repeatingTriggers = @($triggerCommands | Where-Object { $_ -match '-Once\b' -and $_ -match '-RepetitionInterval\b' -and $_ -match 'New-TimeSpan\s+-Minutes\s+1\b' })
        Assert-RegistrarContract ($repeatingTriggers.Count -ge 1) 'Scheduler task trigger must repeat every 1 minute (New-ScheduledTaskTrigger -Once -RepetitionInterval).'
        $schedulerRepetitionDurations = @($triggerCommands | Where-Object { $_ -match '-RepetitionDuration\b' -and $_ -match 'New-TimeSpan\s+-Days\s+3650\b' })
        Assert-RegistrarContract ($schedulerRepetitionDurations.Count -ge 1) 'Scheduler trigger must keep -RepetitionDuration (New-TimeSpan -Days 3650) so the every-minute schedule does not expire (RV-T3-011).'
        $dailyTriggers = @($triggerCommands | Where-Object { $_ -match '-Daily\b' })
        Assert-RegistrarContract ($dailyTriggers.Count -eq 0) 'Registrar must not create daily task triggers that duplicate the Laravel schedule.'
        $settingsCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^New-ScheduledTaskSettingsSet\b')
        $schedulerSettings = @($settingsCommands | Where-Object { $_ -match '-MultipleInstances\s+IgnoreNew\b' -and $_ -match '-StartWhenAvailable\b' })
        Assert-RegistrarContract ($schedulerSettings.Count -ge 1) 'Scheduler task settings must use -MultipleInstances IgnoreNew and -StartWhenAvailable.'
        $schedulerExecutionLimits = @($settingsCommands | Where-Object { $_ -match '-ExecutionTimeLimit\b' -and $_ -match 'New-TimeSpan\s+-Minutes\s+10\b' })
        Assert-RegistrarContract ($schedulerExecutionLimits.Count -ge 1) 'Scheduler settings must bound each tick with -ExecutionTimeLimit (New-TimeSpan -Minutes 10).'

        # The scheduler must be started right after being registered (RV-T3-011).
        $commandRecords = @(Get-CommandRecords -Ast $registrarAst)
        $startTaskRecords = @($commandRecords | Where-Object { $_.Text -match '^Start-ScheduledTask\b' })
        Assert-RegistrarContract ($startTaskRecords.Count -ge 1) 'Registrar must start the scheduler task after registering it.'
        Assert-RegistrarContract (@($startTaskRecords | Where-Object { $_.Text -match '\$schedulerTaskName' }).Count -ge 1) 'Registrar must start the registered Scheduler task (Start-ScheduledTask -TaskName $schedulerTaskName).'
        Assert-RegistrarContract (@($startTaskRecords | Where-Object { $_.Text -match '\$workerTaskName' }).Count -ge 1) 'Registrar must start the registered BackupWorker task immediately.'
        $registerTaskRecords = @($commandRecords | Where-Object { $_.Text -match '^Register-ScheduledTask\b' })
        if ($startTaskRecords.Count -ge 1 -and $registerTaskRecords.Count -ge 1) {
            $lastRegisterOffset = ($registerTaskRecords | Measure-Object -Property StartOffset -Maximum).Maximum
            $firstStartOffset = ($startTaskRecords | Measure-Object -Property StartOffset -Minimum).Minimum
            Assert-RegistrarContract ($firstStartOffset -gt $lastRegisterOffset) 'Start-ScheduledTask must run after Register-ScheduledTask so the start cannot be a no-op.'
        }

        # Scheduler action must call this registrar back in -SchedulerTick mode.
        $schedulerArgStrings = @($stringValues | Where-Object { $_ -match '\$registrarScript' -and $_ -match '-File\b' })
        $schedulerArgStringsWithMode = @($schedulerArgStrings | Where-Object { $_ -match '-SchedulerTick\b' -and $_ -match '-ProjectRoot\b' -and $_ -match '-PhpPath\b' })
        Assert-RegistrarContract ($schedulerArgStringsWithMode.Count -ge 1) 'Scheduler task action must invoke this registrar with -SchedulerTick and the resolved ProjectRoot/PhpPath.'

        # Legacy daily task cleanup on -UpdateExisting/-Uninstall.
        $legacyCleanupLoops = @($foreachTexts | Where-Object { $_ -match '\$legacyDailyTaskName' })
        Assert-RegistrarContract ($legacyCleanupLoops.Count -ge 2) 'Registrar must unregister the legacy -DailyBackup task in the update and uninstall paths.'

        # Updating tasks must be recoverable: preserve the previous XML, prove
        # that replacement definitions register under staging names, and keep
        # rollback code that restores the snapshots if final registration or
        # immediate startup fails.
        $exportTaskCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Export-ScheduledTask\b')
        Assert-RegistrarContract ($exportTaskCommands.Count -ge 1) 'UpdateExisting must snapshot existing task XML before replacement.'
        Assert-RegistrarContract (@($stringValues | Where-Object { $_ -match 'Stage-' }).Count -ge 1) 'Task definitions must be validated under disposable staging task names before existing tasks are removed.'
        $functionNames = @($functionDefinitions | ForEach-Object { $_.Name })
        Assert-RegistrarContract ($functionNames -contains 'Restore-ScheduledTaskSnapshots') 'Registrar must provide rollback that restores prior scheduled-task XML.'
        Assert-RegistrarContract (@($commandTexts | Where-Object { $_ -match '^Restore-ScheduledTaskSnapshots\b' }).Count -ge 1) 'Registration failure path must invoke scheduled-task rollback.'

        # Daily backup hour coherence and single-mechanism warnings.
        Assert-RegistrarContract (@($stringValues | Where-Object { $_ -match 'HOSPITAL_DAILY_BACKUP_TIME' }).Count -ge 1) 'Registrar must document that the daily backup hour comes from HOSPITAL_DAILY_BACKUP_TIME (config/hospital.php).'
        Assert-RegistrarContract (@($stringValues | Where-Object { $_ -match 'HospitalBillingOSBackupAutomation' }).Count -ge 1) 'Registrar must detect the user-startup loop mechanism to avoid double programming.'

        # Status must report the scheduler and the legacy daily task.
        foreach ($statusKey in @('Worker', 'Scheduler', 'LegacyDaily')) {
            Assert-RegistrarContract ($hashtableKeys -contains $statusKey) "Status JSON must keep the $statusKey key."
        }

        # ------------------------------------------------------------------
        # Controlled runs with synthetic disposable resources.
        # ------------------------------------------------------------------
        $okRoot = Join-Path $testRoot 'ok'
        New-Item -ItemType Directory -Force -Path $okRoot | Out-Null
        $okPhp = New-RegistrarFixture -Root $okRoot
        $ok = Invoke-RegistrarProcess -Arguments @('-SchedulerTick', '-ProjectRoot', $okRoot, '-PhpPath', $okPhp) -Environment @{} -WorkingRoot $okRoot
        $okInvocations = Get-InvocationLog -Root $okRoot

        Assert-RegistrarContract ($ok.ExitCode -eq 0) "Controlled run (ok): -SchedulerTick must exit 0 when schedule:run succeeds (stderr: $($ok.StdErr))."
        Assert-RegistrarContract ($okInvocations -match 'schedule:run --no-interaction') 'Controlled run (ok): schedule:run must be invoked with --no-interaction.'
        Assert-RegistrarContract ($okInvocations -match 'hospital:scheduler-tick --result=ok') 'Controlled run (ok): tick ok must be recorded.'
        Assert-RegistrarContract ($okInvocations -notmatch '--result=fail') 'Controlled run (ok): successful schedule:run must not record a tick fail.'
        Assert-RegistrarContract ($okInvocations -notmatch 'hospital:backup') 'Controlled run (ok): tick mode must never invoke hospital:backup.'
        Assert-RegistrarContract ($okInvocations -notmatch 'run_scheduled_backup') 'Controlled run (ok): tick mode must never use the retired wrapper.'

        $failRoot = Join-Path $testRoot 'fail'
        New-Item -ItemType Directory -Force -Path $failRoot | Out-Null
        $failPhp = New-RegistrarFixture -Root $failRoot
        $fail = Invoke-RegistrarProcess -Arguments @('-SchedulerTick', '-ProjectRoot', $failRoot, '-PhpPath', $failPhp) -Environment @{ T3_018_TEST_FAIL_SCHEDULE_RUN = '1' } -WorkingRoot $failRoot
        $failInvocations = Get-InvocationLog -Root $failRoot

        Assert-RegistrarContract ($fail.ExitCode -eq 1) 'Controlled run (fail): -SchedulerTick must exit 1 when schedule:run fails.'
        Assert-RegistrarContract ($failInvocations -match 'schedule:run --no-interaction') 'Controlled run (fail): schedule:run must be invoked with --no-interaction.'
        Assert-RegistrarContract ($failInvocations -match 'hospital:scheduler-tick --result=fail "--message=schedule:run failed"') 'Controlled run (fail): the Docker message schedule:run failed must be passed as a single quoted argument.'
        Assert-RegistrarContract ($failInvocations -notmatch 'hospital:scheduler-tick --result=ok') 'Controlled run (fail): failed schedule:run must not record a tick ok.'
        Assert-RegistrarContract ($failInvocations -notmatch 'hospital:backup') 'Controlled run (fail): tick mode must never invoke hospital:backup.'
        Assert-RegistrarContract ($fail.StdOut -match 'schedule:run exited with code 7') 'Controlled run (fail): the real schedule:run exit code must be logged.'

        # RV-T3-011 finding 1, false-failure control: exit 0 with a stderr line
        # must not abort the tick (that is the NativeCommandError trap in PS 5.1).
        $stderrOkRoot = Join-Path $testRoot 'stderr-ok'
        New-Item -ItemType Directory -Force -Path $stderrOkRoot | Out-Null
        $stderrOkPhp = New-RegistrarFixture -Root $stderrOkRoot
        $stderrOk = Invoke-RegistrarProcess -Arguments @('-SchedulerTick', '-ProjectRoot', $stderrOkRoot, '-PhpPath', $stderrOkPhp) -Environment @{ T3_018_TEST_STDERR_OK_SCHEDULE_RUN = '1' } -WorkingRoot $stderrOkRoot
        $stderrOkInvocations = Get-InvocationLog -Root $stderrOkRoot

        Assert-RegistrarContract ($stderrOk.ExitCode -eq 0) 'Controlled run (stderr-ok): schedule:run exit 0 with stderr output must not become a false failure; -SchedulerTick must exit 0 (RV-T3-011).'
        Assert-RegistrarContract ($stderrOkInvocations -match 'schedule:run --no-interaction') 'Controlled run (stderr-ok): schedule:run must be invoked with --no-interaction.'
        Assert-RegistrarContract ($stderrOkInvocations -match 'hospital:scheduler-tick --result=ok') 'Controlled run (stderr-ok): tick ok must be recorded even when schedule:run writes stderr.'
        Assert-RegistrarContract ($stderrOkInvocations -notmatch '--result=fail') 'Controlled run (stderr-ok): a successful schedule:run that writes stderr must never record a tick fail.'
        Assert-RegistrarContract ($stderrOk.StdOut -notmatch 'schedule:run failure') 'Controlled run (stderr-ok): no failure heartbeat may be logged when schedule:run exits 0.'
        Assert-RegistrarContract ($stderrOk.StdErr -notmatch 'NativeCommandError') 'Controlled run (stderr-ok): stderr output must not surface as an unhandled NativeCommandError.'

        # RV-T3-011 finding 1, lost-heartbeat control: exit 7 with a stderr line
        # must still record the Docker-parity tick fail and exit 1.
        $stderrFailRoot = Join-Path $testRoot 'stderr-fail'
        New-Item -ItemType Directory -Force -Path $stderrFailRoot | Out-Null
        $stderrFailPhp = New-RegistrarFixture -Root $stderrFailRoot
        $stderrFail = Invoke-RegistrarProcess -Arguments @('-SchedulerTick', '-ProjectRoot', $stderrFailRoot, '-PhpPath', $stderrFailPhp) -Environment @{ T3_018_TEST_STDERR_FAIL_SCHEDULE_RUN = '1' } -WorkingRoot $stderrFailRoot
        $stderrFailInvocations = Get-InvocationLog -Root $stderrFailRoot

        Assert-RegistrarContract ($stderrFail.ExitCode -eq 1) 'Controlled run (stderr-fail): schedule:run exit 7 with stderr output must exit 1 (RV-T3-011).'
        Assert-RegistrarContract ($stderrFailInvocations -match 'schedule:run --no-interaction') 'Controlled run (stderr-fail): schedule:run must be invoked with --no-interaction.'
        Assert-RegistrarContract ($stderrFailInvocations -match 'hospital:scheduler-tick --result=fail "--message=schedule:run failed"') 'Controlled run (stderr-fail): the fail heartbeat with the Docker message must be recorded even when schedule:run writes stderr (RV-T3-011).'
        Assert-RegistrarContract ($stderrFailInvocations -notmatch 'hospital:scheduler-tick --result=ok') 'Controlled run (stderr-fail): failed schedule:run must not record a tick ok.'
        Assert-RegistrarContract ($stderrFail.StdOut -match 'schedule:run: synthetic schedule:run stderr') 'Controlled run (stderr-fail): the stderr line must be captured and logged, not turned into an abort.'
        Assert-RegistrarContract ($stderrFail.StdOut -match 'schedule:run exited with code 7') 'Controlled run (stderr-fail): the actual schedule:run exit code must be logged.'
        Assert-RegistrarContract ($stderrFail.StdErr -notmatch 'NativeCommandError') 'Controlled run (stderr-fail): stderr output must not surface as an unhandled NativeCommandError.'

        # RV-T3-011 finding 1, invocation-error control: an unusable php path
        # (existing directory, so the registrar does not fall back to real php)
        # must log the failure, attempt the fail heartbeat and exit 1.
        $invErrorRoot = Join-Path $testRoot 'invocation-error'
        New-Item -ItemType Directory -Force -Path $invErrorRoot | Out-Null
        [void] (New-RegistrarFixture -Root $invErrorRoot)
        $invErrorPhp = Join-Path $invErrorRoot 'php-unavailable'
        New-Item -ItemType Directory -Force -Path $invErrorPhp | Out-Null
        $invError = Invoke-RegistrarProcess -Arguments @('-SchedulerTick', '-ProjectRoot', $invErrorRoot, '-PhpPath', $invErrorPhp) -Environment @{} -WorkingRoot $invErrorRoot

        Assert-RegistrarContract ($invError.ExitCode -eq 1) 'Controlled run (invocation-error): an unusable php path must exit 1.'
        Assert-RegistrarContract ($invError.StdOut -match 'schedule:run failure: invocation error') 'Controlled run (invocation-error): the invocation failure must be logged.'
        Assert-RegistrarContract ($invError.StdOut -match 'hospital:scheduler-tick --result=fail') 'Controlled run (invocation-error): the fail heartbeat must be attempted even when schedule:run cannot start (RV-T3-011).'
        Assert-RegistrarContract ($invError.StdOut -notmatch 'Scheduler tick recorded: ok') 'Controlled run (invocation-error): an invocation failure must never look like a successful tick.'

        # Harness quoting control: a ProjectRoot with spaces must survive
        # Start-Process -ArgumentList (PS 5.1 joins elements without quoting).
        $spacesRoot = Join-Path $testRoot 'ok with spaces'
        New-Item -ItemType Directory -Force -Path $spacesRoot | Out-Null
        $spacesPhp = New-RegistrarFixture -Root $spacesRoot
        $spaces = Invoke-RegistrarProcess -Arguments @('-SchedulerTick', '-ProjectRoot', $spacesRoot, '-PhpPath', $spacesPhp) -Environment @{} -WorkingRoot $spacesRoot
        $spacesInvocations = Get-InvocationLog -Root $spacesRoot

        Assert-RegistrarContract ($spaces.ExitCode -eq 0) "Controlled run (spaces): a ProjectRoot with spaces must survive process-argument quoting (exit 0); stderr: $($spaces.StdErr)"
        Assert-RegistrarContract ($spacesInvocations -match 'schedule:run --no-interaction') 'Controlled run (spaces): schedule:run must be invoked with --no-interaction.'
        Assert-RegistrarContract ($spacesInvocations -match 'hospital:scheduler-tick --result=ok') 'Controlled run (spaces): tick ok must be recorded with a spaced ProjectRoot.'

        # -WhatIfOnly must rehearse without registering anything.
        $whatIfRoot = Join-Path $testRoot 'whatif'
        New-Item -ItemType Directory -Force -Path $whatIfRoot | Out-Null
        $whatIfPhp = New-RegistrarFixture -Root $whatIfRoot
        $whatIfPrefix = 'T3018WhatIf' + [guid]::NewGuid().ToString('N').Substring(0, 8)
        $whatIf = Invoke-RegistrarProcess -Arguments @('-WhatIfOnly', '-ProjectRoot', $whatIfRoot, '-PhpPath', $whatIfPhp, '-TaskPrefix', $whatIfPrefix) -Environment @{} -WorkingRoot $whatIfRoot

        Assert-RegistrarContract ($whatIf.ExitCode -eq 0) 'Controlled run (whatif): -WhatIfOnly must exit 0 without administrator permissions.'
        Assert-RegistrarContract ($whatIf.StdOut -match '-SchedulerTick') 'Controlled run (whatif): output must show the scheduler action mode.'
        Assert-RegistrarContract ($whatIf.StdOut -match 'every 1 minute') 'Controlled run (whatif): output must show the scheduler cadence.'
        Assert-RegistrarContract ($whatIf.StdOut -match 'HOSPITAL_DAILY_BACKUP_TIME') 'Controlled run (whatif): output must point operators to HOSPITAL_DAILY_BACKUP_TIME.'
        Assert-RegistrarContract ($whatIf.StdOut -notmatch 'run_scheduled_backup') 'Controlled run (whatif): the retired daily wrapper must not be planned.'
        $whatIfSchedulerTask = Get-ScheduledTask -TaskName "$whatIfPrefix-Scheduler" -ErrorAction SilentlyContinue
        $whatIfWorkerTask = Get-ScheduledTask -TaskName "$whatIfPrefix-BackupWorker" -ErrorAction SilentlyContinue
        Assert-RegistrarContract ($null -eq $whatIfSchedulerTask) 'Controlled run (whatif): no scheduler task may be registered.'
        Assert-RegistrarContract ($null -eq $whatIfWorkerTask) 'Controlled run (whatif): no worker task may be registered.'

        # -Status -JsonStatus must report worker, scheduler and legacy daily.
        $statusRoot = Join-Path $testRoot 'status'
        New-Item -ItemType Directory -Force -Path $statusRoot | Out-Null
        $statusPhp = New-RegistrarFixture -Root $statusRoot
        $statusPrefix = 'T3018Status' + [guid]::NewGuid().ToString('N').Substring(0, 8)
        $status = Invoke-RegistrarProcess -Arguments @('-Status', '-JsonStatus', '-ProjectRoot', $statusRoot, '-PhpPath', $statusPhp, '-TaskPrefix', $statusPrefix) -Environment @{} -WorkingRoot $statusRoot

        Assert-RegistrarContract ($status.ExitCode -eq 0) 'Controlled run (status): -Status -JsonStatus must exit 0.'
        $statusJsonLine = @($status.StdOut -split '\r?\n' | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1)
        Assert-RegistrarContract ($statusJsonLine.Count -eq 1) 'Controlled run (status): status JSON must be emitted.'
        if ($statusJsonLine.Count -eq 1) {
            $statusPayload = $null
            try {
                $statusPayload = $statusJsonLine[0] | ConvertFrom-Json -ErrorAction Stop
            }
            catch {
                $statusPayload = $null
            }
            Assert-RegistrarContract ($null -ne $statusPayload) 'Controlled run (status): status JSON must parse.'
            if ($null -ne $statusPayload) {
                Assert-RegistrarContract ($null -ne $statusPayload.Worker -and $null -ne $statusPayload.Scheduler -and $null -ne $statusPayload.LegacyDaily) 'Controlled run (status): JSON must include Worker, Scheduler and LegacyDaily records.'
                Assert-RegistrarContract ($statusPayload.Scheduler.Installed -eq $false) 'Controlled run (status): synthetic scheduler task must be reported as not installed.'
                Assert-RegistrarContract ($statusPayload.LegacyDaily.Installed -eq $false) 'Controlled run (status): synthetic legacy daily task must be reported as not installed.'
            }
        }
    }

    if ($script:Errors.Count -gt 0) {
        Write-Host ('Backup tasks registrar test found {0} failing assertions:' -f $script:Errors.Count) -ForegroundColor Red
        foreach ($err in $script:Errors) {
            Write-Host ('  - {0}' -f $err) -ForegroundColor Red
        }
        throw 'Backup tasks registrar test failed.'
    }

    foreach ($skip in $script:Skips) {
        Write-Host ('[SKIP] {0}' -f $skip) -ForegroundColor Yellow
    }
    Write-Host ('Backup tasks registrar test passed: {0} checks, {1} skips.' -f $script:Checks, $script:Skips.Count)
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
