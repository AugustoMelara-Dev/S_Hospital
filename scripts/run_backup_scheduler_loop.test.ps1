#Requires -Version 5.1
#
# Contract test for scripts/run_backup_scheduler_loop.ps1 (F027 / T3-003).
#
# The loop must run the Laravel scheduler every 60 seconds exactly like the
# Docker scheduler sidecar (docker-compose.prod.yml): `schedule:run
# --no-interaction` plus `hospital:scheduler-tick --result=ok` /
# `--result=fail --message=schedule:run failed`. It must NOT run its own daily
# backup anymore, and it must keep the single-instance mutex, the queue worker
# supervision, the heartbeat and the backup-automation.log logging.
#
# Critical scheduler commands are checked as real CommandAst invocations with
# their literal argument values, so a comment or a log string mentioning
# "schedule:run" cannot satisfy them. Some If/While guard checks still use
# Extent.Text, which can include comments (RV-T3-003), so the controlled smoke
# runs remain the behavioural backstop. The smoke runs use only synthetic
# disposable resources under %TEMP% with a fake php.cmd that records every
# invocation. No real PHP, MySQL, Docker or backup runs.

$ErrorActionPreference = 'Stop'

$loopScript = Join-Path $PSScriptRoot 'run_backup_scheduler_loop.ps1'

$script:Checks = 0
$script:Errors = @()
$script:Skips = @()
$script:ActiveLoopProcesses = @()

function Assert-LoopContract {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

function Add-LoopSkip {
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

function Get-MatchingCommandTexts {
    param([string[]] $CommandTexts, [string] $Pattern)
    return @($CommandTexts | Where-Object { $_ -match $Pattern })
}

# Returns every real `Invoke-Artisan -Arguments @(...)` command with the
# literal string values of its arguments. A log line, a comment or any other
# command that merely mentions "schedule:run" is not an Invoke-Artisan call and
# cannot satisfy the scheduler assertions built on top of this helper.
function Get-InvokeArtisanCalls {
    param([System.Management.Automation.Language.Ast] $Ast)

    $calls = @()
    foreach ($commandAst in Get-CommandAsts -Ast $Ast) {
        $elements = @($commandAst.CommandElements)
        if ($elements.Count -lt 1) { continue }
        if ($elements[0].Extent.Text -ne 'Invoke-Artisan') { continue }

        $argumentValues = @()
        for ($index = 1; $index -lt $elements.Count; $index++) {
            $argumentValues += @($elements[$index].FindAll({
                param($node) $node -is [System.Management.Automation.Language.StringConstantExpressionAst] -or
                             $node -is [System.Management.Automation.Language.ExpandableStringExpressionAst]
            }, $true) | ForEach-Object { $_.Value })
        }

        $calls += [pscustomobject]@{
            Text = $commandAst.Extent.Text
            Arguments = @($argumentValues)
        }
    }

    return @($calls)
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

function Get-FunctionDefinitions {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true))
}

function Get-IfStatements {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.IfStatementAst]
    }, $true))
}

function Get-IfStatementTexts {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @(Get-IfStatements -Ast $Ast | ForEach-Object { $_.Extent.Text })
}

function Get-WhileStatementTexts {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({
        param($node) $node -is [System.Management.Automation.Language.WhileStatementAst]
    }, $true) | ForEach-Object { $_.Extent.Text })
}

function Test-LoopMutexFree {
    $mutex = $null
    try {
        $mutex = [System.Threading.Mutex]::OpenExisting('Local\HospitalBillingOSBackupAutomation')
    }
    catch {
        return $true
    }

    try {
        $acquired = $mutex.WaitOne(0)
        if ($acquired) { [void] $mutex.ReleaseMutex() }
        return $acquired
    }
    catch [System.Threading.AbandonedMutexException] {
        [void] $mutex.ReleaseMutex()
        return $true
    }
    finally {
        $mutex.Dispose()
    }
}

function New-LoopSmokeFixture {
    param([string] $Root)

    $backendDir = Join-Path $Root 'backend'
    $logDir = Join-Path $backendDir 'storage\logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    Set-Content -LiteralPath (Join-Path $backendDir 'artisan') -Value '<?php // synthetic placeholder; never executed' -Encoding ASCII

    $phpCmd = Join-Path $Root 'php.cmd'
    # One invocation log per command type: the queue worker and schedule:run
    # runs are nearly concurrent, and concurrent `echo >>` appends to a single
    # file can fail with a sharing violation and lose a line.
    # Nested parenthesized blocks plus `exit /b` inside them are unreliable in
    # cmd (the observed exit code can be 0 instead of the requested one), so
    # the failure paths use top-level labels and goto.
    $fakePhpLines = @(
        '@echo off',
        'setlocal',
        'set "LOGFILE=%~dp0inv-other.log"',
        'if "%~2"=="queue:work" set "LOGFILE=%~dp0inv-worker.log"',
        'if "%~2"=="schedule:run" set "LOGFILE=%~dp0inv-schedule.log"',
        'if "%~2"=="hospital:scheduler-tick" set "LOGFILE=%~dp0inv-tick.log"',
        'echo inv first=[%~1] second=[%~2]>>"%LOGFILE%"',
        'echo %*>>"%LOGFILE%"',
        'if "%~2"=="schedule:run" if "%T3_LOOP_TEST_STDERR_FAIL_SCHEDULE_RUN%"=="1" goto :stderr_fail',
        'if "%~2"=="schedule:run" if "%T3_LOOP_TEST_FAIL_SCHEDULE_RUN%"=="1" goto :exit7',
        'goto :ok',
        ':stderr_fail',
        'echo synthetic schedule:run stderr 1>&2',
        'exit /b 9',
        ':exit7',
        'exit /b 7',
        ':ok',
        'exit /b 0'
    )
    Set-Content -LiteralPath $phpCmd -Value $fakePhpLines -Encoding ASCII

    return $phpCmd
}

function Get-SmokeInvocationText {
    param([string] $Root)

    $text = ''
    foreach ($file in @(Get-ChildItem -LiteralPath $Root -Filter 'inv-*.log' -File -ErrorAction SilentlyContinue)) {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($null -ne $content) {
            $text += $content + "`n"
        }
    }

    return $text
}

function Invoke-LoopSmoke {
    param(
        [string] $Root,
        [bool] $FailScheduleRun,
        [bool] $StderrFailScheduleRun
    )

    $phpCmd = New-LoopSmokeFixture -Root $Root
    $loopLogFile = Join-Path $Root 'backend\storage\logs\backup-automation.log'

    $previousFlag = $env:T3_LOOP_TEST_FAIL_SCHEDULE_RUN
    $previousStderrFlag = $env:T3_LOOP_TEST_STDERR_FAIL_SCHEDULE_RUN
    try {
        if ($FailScheduleRun) {
            $env:T3_LOOP_TEST_FAIL_SCHEDULE_RUN = '1'
        }
        else {
            Remove-Item Env:\T3_LOOP_TEST_FAIL_SCHEDULE_RUN -ErrorAction SilentlyContinue
        }

        if ($StderrFailScheduleRun) {
            $env:T3_LOOP_TEST_STDERR_FAIL_SCHEDULE_RUN = '1'
        }
        else {
            Remove-Item Env:\T3_LOOP_TEST_STDERR_FAIL_SCHEDULE_RUN -ErrorAction SilentlyContinue
        }

        # PS 5.1 Start-Process joins -ArgumentList elements with spaces without
        # quoting them, so paths are quoted explicitly: the "spaces-ok" case
        # must survive a synthetic root containing spaces.
        $arguments = @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', ('"' + $loopScript + '"'),
            '-ProjectRoot', ('"' + $Root + '"'),
            '-PhpPath', ('"' + $phpCmd + '"'),
            '-DailyBackupTime', '02:00'
        )
        $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden
        $script:ActiveLoopProcesses += $process
    }
    finally {
        if ($null -eq $previousFlag) {
            Remove-Item Env:\T3_LOOP_TEST_FAIL_SCHEDULE_RUN -ErrorAction SilentlyContinue
        }
        else {
            $env:T3_LOOP_TEST_FAIL_SCHEDULE_RUN = $previousFlag
        }

        if ($null -eq $previousStderrFlag) {
            Remove-Item Env:\T3_LOOP_TEST_STDERR_FAIL_SCHEDULE_RUN -ErrorAction SilentlyContinue
        }
        else {
            $env:T3_LOOP_TEST_STDERR_FAIL_SCHEDULE_RUN = $previousStderrFlag
        }
    }

    $expected = if ($FailScheduleRun -or $StderrFailScheduleRun) { '--result=fail' } else { '--result=ok' }
    $deadline = (Get-Date).AddSeconds(30)
    $matched = $false
    while ((Get-Date) -lt $deadline -and -not $matched) {
        $content = Get-SmokeInvocationText -Root $Root
        if ($null -ne $content -and $content -match [regex]::Escape($expected)) {
            $matched = $true
            break
        }
        if ($process.HasExited) { break }
        Start-Sleep -Milliseconds 500
    }

    $wasRunning = -not $process.HasExited
    if ($wasRunning) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $null = $process.WaitForExit(5000)
    }

    $invocationText = Get-SmokeInvocationText -Root $Root
    $loopLog = ''
    if (Test-Path -LiteralPath $loopLogFile) {
        $loopLog = Get-Content -LiteralPath $loopLogFile -Raw
    }

    return [pscustomobject]@{
        Matched = $matched
        WasRunning = $wasRunning
        InvocationText = $invocationText
        LoopLog = $loopLog
    }
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-loop-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    Assert-LoopContract (Test-Path -LiteralPath $loopScript -PathType Leaf) 'scripts/run_backup_scheduler_loop.ps1 must exist.'

    if (Test-Path -LiteralPath $loopScript -PathType Leaf) {
        $tokens = $null
        $parseErrors = $null
        $loopAst = [System.Management.Automation.Language.Parser]::ParseFile($loopScript, [ref] $tokens, [ref] $parseErrors)

        Assert-LoopContract (@($parseErrors).Count -eq 0) ('Loop script must parse with 0 errors under Windows PowerShell 5.1; first error: ' + (@($parseErrors) | Select-Object -First 1).Message)

        $commandTexts = Get-CommandTexts -Ast $loopAst
        $stringValues = Get-StringValues -Ast $loopAst
        $functionNames = @(Get-FunctionDefinitions -Ast $loopAst | ForEach-Object { $_.Name })
        $ifTexts = Get-IfStatementTexts -Ast $loopAst
        $whileTexts = Get-WhileStatementTexts -Ast $loopAst

        # Parameters preserved for existing launchers (start_backup_automation.cmd,
        # install_backup_startup_current_user.ps1).
        $paramNames = @()
        if ($null -ne $loopAst.ParamBlock) {
            $paramNames = @($loopAst.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
        }
        foreach ($expectedParam in @('ProjectRoot', 'PhpPath', 'DailyBackupTime')) {
            Assert-LoopContract ($paramNames -contains $expectedParam) "Loop must keep accepting the -$expectedParam parameter."
        }

        # Laravel scheduler parity with the Docker scheduler sidecar. These
        # checks inspect real Invoke-Artisan CommandAst calls and their literal
        # argument values: a comment, a log line or any other command that
        # merely mentions schedule:run cannot satisfy them.
        $artisanCalls = Get-InvokeArtisanCalls -Ast $loopAst
        Assert-LoopContract ($artisanCalls.Count -ge 3) 'Loop must invoke php artisan through Invoke-Artisan for schedule:run and both tick results.'
        $scheduleRunCalls = @($artisanCalls | Where-Object { $_.Arguments -contains 'schedule:run' })
        Assert-LoopContract ($scheduleRunCalls.Count -ge 1) 'Loop must invoke php artisan schedule:run (Docker scheduler parity).'
        $scheduleRunNoInteraction = @($scheduleRunCalls | Where-Object { $_.Arguments -contains '--no-interaction' })
        Assert-LoopContract ($scheduleRunNoInteraction.Count -ge 1) 'schedule:run must keep --no-interaction like the Docker scheduler sidecar.'

        $tickCalls = @($artisanCalls | Where-Object { $_.Arguments -contains 'hospital:scheduler-tick' })
        Assert-LoopContract ($tickCalls.Count -ge 2) 'Loop must invoke hospital:scheduler-tick for both ok and fail results.'
        $tickOkCalls = @($tickCalls | Where-Object { $_.Arguments -contains '--result=ok' })
        Assert-LoopContract ($tickOkCalls.Count -ge 1) 'Loop must record hospital:scheduler-tick --result=ok after a successful schedule:run.'
        $tickFailCalls = @($tickCalls | Where-Object { $_.Arguments -contains '--result=fail' -and $_.Arguments -contains '--message=schedule:run failed' })
        Assert-LoopContract ($tickFailCalls.Count -ge 1) 'Loop must record hospital:scheduler-tick --result=fail --message=schedule:run failed when schedule:run fails, matching Docker.'

        $whileText = ($whileTexts | Select-Object -First 1)
        Assert-LoopContract ($whileTexts.Count -ge 1) 'Loop must keep the infinite supervision loop.'
        Assert-LoopContract ($whileText -match 'Invoke-LaravelScheduler') 'The Laravel scheduler must run inside the every-iteration loop.'
        Assert-LoopContract ($whileText -match 'Start-BackupWorker') 'Worker supervision must run inside the every-iteration loop.'

        # No duplicate daily backup: the Laravel schedule is the single owner.
        $duplicateBackupCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern 'hospital:backup')
        Assert-LoopContract ($duplicateBackupCommands.Count -eq 0) 'Loop must not run its own hospital:backup; the Laravel scheduler owns the daily and operational backups.'
        $duplicateBackupStrings = @($stringValues | Where-Object { $_ -match 'hospital:backup' })
        Assert-LoopContract ($duplicateBackupStrings.Count -eq 0) 'Loop must not build any hospital:backup command string.'
        $stateStrings = @($stringValues | Where-Object { $_ -match 'last-scheduled-backup-date' })
        Assert-LoopContract ($stateStrings.Count -eq 0) 'Loop must not keep the removed .last-scheduled-backup-date deduplication state.'

        # Single-instance mutex.
        $mutexCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern 'System\.Threading\.Mutex')
        Assert-LoopContract ($mutexCommands.Count -ge 1) 'Loop must create the single-instance System.Threading.Mutex.'
        $namedMutexCommands = @($mutexCommands | Where-Object { $_ -match 'HospitalBillingOSBackupAutomation' })
        Assert-LoopContract ($namedMutexCommands.Count -ge 1) 'Loop mutex must keep the local HospitalBillingOSBackupAutomation name.'
        $mutexGuards = @($ifTexts | Where-Object { $_ -match [regex]::Escape('-not $createdMutex') -and $_ -match '\bexit 0\b' })
        Assert-LoopContract ($mutexGuards.Count -ge 1) 'Loop must exit 0 when another instance already holds the mutex.'

        # Queue worker supervision.
        $startProcessCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Start-Process\b')
        Assert-LoopContract ($startProcessCommands.Count -ge 1) 'Loop must start the backup queue worker with Start-Process.'
        $startProcessPassThru = @($startProcessCommands | Where-Object { $_ -match '-PassThru' })
        Assert-LoopContract ($startProcessPassThru.Count -ge 1) 'Worker start must use -PassThru so supervision can inspect the process.'
        Assert-LoopContract (@($stringValues | Where-Object { $_ -eq 'queue:work' }).Count -ge 1) 'Loop must run queue:work.'
        Assert-LoopContract (@($stringValues | Where-Object { $_ -eq '--queue=backups' }).Count -ge 1) 'Loop must keep the backups queue.'
        Assert-LoopContract ($functionNames -contains 'Start-BackupWorker') 'Loop must keep the Start-BackupWorker helper.'
        $startWorkerCalls = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Start-BackupWorker$')
        Assert-LoopContract ($startWorkerCalls.Count -ge 2) 'Loop must start the worker once and restart it from the supervision path.'
        $supervisionGuards = @(Get-IfStatements -Ast $loopAst | Where-Object {
            $conditionTexts = @($_.Clauses | ForEach-Object { $_.Item1.Extent.Text })
            @($conditionTexts | Where-Object { $_ -match 'HasExited' }).Count -ge 1
        })
        Assert-LoopContract ($supervisionGuards.Count -ge 1) 'Loop supervision condition must check HasExited to restart a stopped worker.'
        $restartBranches = @($supervisionGuards | Where-Object { $_.Extent.Text -match 'Start-BackupWorker' -and $_.Extent.Text -match 'Restarting' })
        Assert-LoopContract ($restartBranches.Count -ge 1) 'Loop must log and restart the worker from inside the HasExited supervision branch.'

        # Heartbeat and logging.
        $heartbeatStrings = @($stringValues | Where-Object { $_ -match 'Heartbeat\.' })
        Assert-LoopContract ($heartbeatStrings.Count -ge 1) 'Loop must keep the periodic heartbeat log line.'
        $heartbeatGuards = @($ifTexts | Where-Object { $_ -match 'lastHeartbeat' -and $_ -match 'TotalMinutes\s+-ge\s+5' })
        Assert-LoopContract ($heartbeatGuards.Count -ge 1) 'Heartbeat must remain periodic with the 5-minute threshold.'
        Assert-LoopContract (@($stringValues | Where-Object { $_ -eq 'backup-automation.log' }).Count -ge 1) 'Loop must keep logging to backup-automation.log.'
        $addContentCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Add-Content\b')
        Assert-LoopContract ($addContentCommands.Count -ge 1) 'Loop logging must append to the automation log.'
        Assert-LoopContract ($functionNames -contains 'Write-AutomationLog') 'Loop must keep the Write-AutomationLog helper.'

        # Cadence.
        $sleepCommands = @(Get-MatchingCommandTexts -CommandTexts $commandTexts -Pattern '^Start-Sleep\b')
        $sleepSixty = @($sleepCommands | Where-Object { $_ -match '-Seconds\s+60' })
        Assert-LoopContract ($sleepSixty.Count -ge 1) 'Loop must keep the 60-second cadence.'

        # Controlled smoke runs: synthetic root + fake php.cmd that only records
        # invocations. No PHP, MySQL, Docker or real backup is touched.
        if (-not (Test-LoopMutexFree)) {
            Add-LoopSkip 'Controlled smoke runs skipped: another process currently holds Local\HospitalBillingOSBackupAutomation.'
        }
        else {
            $smokeCases = @(
                @{ Name = 'ok'; RelativeRoot = 'ok'; FailScheduleRun = $false; StderrFailScheduleRun = $false },
                @{ Name = 'fail'; RelativeRoot = 'fail'; FailScheduleRun = $true; StderrFailScheduleRun = $false },
                @{ Name = 'stderr-fail'; RelativeRoot = 'stderr-fail'; FailScheduleRun = $false; StderrFailScheduleRun = $true },
                @{ Name = 'spaces-ok'; RelativeRoot = 'ok with spaces'; FailScheduleRun = $false; StderrFailScheduleRun = $false }
            )
            foreach ($case in $smokeCases) {
                $caseRoot = Join-Path $testRoot $case.RelativeRoot
                New-Item -ItemType Directory -Force -Path $caseRoot | Out-Null
                $smoke = Invoke-LoopSmoke -Root $caseRoot -FailScheduleRun $case.FailScheduleRun -StderrFailScheduleRun $case.StderrFailScheduleRun
                $caseName = $case.Name
                $artisanPath = Join-Path $caseRoot 'backend\artisan'

                Assert-LoopContract ($smoke.WasRunning) "Controlled run ($caseName): loop must stay alive while supervising after its first iteration."
                Assert-LoopContract ($smoke.InvocationText -notmatch 'hospital:backup') "Controlled run ($caseName): loop must never invoke hospital:backup."
                Assert-LoopContract ($smoke.LoopLog -match 'Starting backup automation loop\.') "Controlled run ($caseName): loop must log its start."
                Assert-LoopContract ($smoke.LoopLog -notmatch 'Another backup automation loop is already running') "Controlled run ($caseName): mutex must allow the smoke instance to start."
                Assert-LoopContract ($smoke.InvocationText -match 'queue:work --queue=backups') "Controlled run ($caseName): loop must start the backups queue worker."
                $expectedWorkerLine = 'first=[' + $artisanPath + '] second=[queue:work]'
                Assert-LoopContract ($smoke.InvocationText -match [regex]::Escape($expectedWorkerLine)) "Controlled run ($caseName): worker must receive the intact artisan path as one argument even when ProjectRoot contains spaces (PS 5.1 does not quote -ArgumentList elements by itself)."
                Assert-LoopContract (-not (Test-Path -LiteralPath (Join-Path $caseRoot 'backend\storage\app\private\backups\.last-scheduled-backup-date'))) "Controlled run ($caseName): loop must not recreate the removed daily backup state file."

                if ($case.FailScheduleRun) {
                    Assert-LoopContract ($smoke.Matched) 'Controlled run (fail): loop must invoke schedule:run and then hospital:scheduler-tick --result=fail.'
                    Assert-LoopContract ($smoke.InvocationText -match 'schedule:run --no-interaction') 'Controlled run (fail): schedule:run must be invoked with --no-interaction.'
                    Assert-LoopContract ($smoke.InvocationText -match 'hospital:scheduler-tick --result=fail') 'Controlled run (fail): tick fail must be recorded.'
                    Assert-LoopContract ($smoke.InvocationText -match 'schedule:run failed') 'Controlled run (fail): tick fail must carry the Docker message schedule:run failed.'
                    Assert-LoopContract ($smoke.InvocationText -notmatch '--result=ok') 'Controlled run (fail): failed schedule:run must not record a tick ok.'
                    Assert-LoopContract ($smoke.LoopLog -match 'schedule:run exited with code 7') 'Controlled run (fail): loop must log the schedule:run failure code from the controlled stub.'
                }
                elseif ($case.StderrFailScheduleRun) {
                    Assert-LoopContract ($smoke.Matched) 'Controlled run (stderr-fail): stderr output from schedule:run must not abort the iteration; tick fail must still be recorded.'
                    Assert-LoopContract ($smoke.InvocationText -match 'schedule:run --no-interaction') 'Controlled run (stderr-fail): schedule:run must be invoked with --no-interaction.'
                    Assert-LoopContract ($smoke.InvocationText -match 'hospital:scheduler-tick --result=fail') 'Controlled run (stderr-fail): tick fail must be recorded despite stderr output.'
                    Assert-LoopContract ($smoke.InvocationText -match 'schedule:run failed') 'Controlled run (stderr-fail): tick fail must carry the Docker message schedule:run failed.'
                    Assert-LoopContract ($smoke.InvocationText -notmatch '--result=ok') 'Controlled run (stderr-fail): failed schedule:run must not record a tick ok.'
                    Assert-LoopContract ($smoke.LoopLog -match 'schedule:run exited with code 9') 'Controlled run (stderr-fail): loop must log the actual schedule:run failure code even when php writes to stderr (no NativeCommandError abort).'
                    Assert-LoopContract ($smoke.LoopLog -match 'synthetic schedule:run stderr') 'Controlled run (stderr-fail): loop must capture and log the stderr line written by schedule:run.'
                }
                else {
                    Assert-LoopContract ($smoke.Matched) "Controlled run ($caseName): loop must invoke schedule:run --no-interaction and hospital:scheduler-tick --result=ok."
                    Assert-LoopContract ($smoke.InvocationText -match 'schedule:run --no-interaction') "Controlled run ($caseName): schedule:run must be invoked with --no-interaction."
                    Assert-LoopContract ($smoke.InvocationText -match 'hospital:scheduler-tick --result=ok') "Controlled run ($caseName): tick ok must be recorded."
                }

                Start-Sleep -Milliseconds 1500
            }
        }
    }

    if ($script:Errors.Count -gt 0) {
        Write-Host ('Backup scheduler loop test found {0} failing assertions:' -f $script:Errors.Count) -ForegroundColor Red
        foreach ($err in $script:Errors) {
            Write-Host ('  - {0}' -f $err) -ForegroundColor Red
        }
        throw 'Backup scheduler loop test failed.'
    }

    foreach ($skip in $script:Skips) {
        Write-Host ('[SKIP] {0}' -f $skip) -ForegroundColor Yellow
    }
    Write-Host ('Backup scheduler loop test passed: {0} checks, {1} skips.' -f $script:Checks, $script:Skips.Count)
}
finally {
    foreach ($process in $script:ActiveLoopProcesses) {
        if ($null -ne $process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
