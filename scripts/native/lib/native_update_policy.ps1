#Requires -Version 5.1

Set-StrictMode -Version Latest

function Test-NativeDatabaseUpdateCompatibility {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CurrentMigrationsRoot,
        [Parameter(Mandatory = $true)][string] $CandidateMigrationsRoot,
        [ValidateSet('no_schema_change','backward_compatible_additive')][string] $Policy = 'no_schema_change'
    )

    if (-not (Test-Path -LiteralPath $CurrentMigrationsRoot -PathType Container) -or -not (Test-Path -LiteralPath $CandidateMigrationsRoot -PathType Container)) {
        throw 'Migration directories are required for update compatibility validation.'
    }
    $oldMigrations = @(Get-ChildItem -LiteralPath $CurrentMigrationsRoot -File -Filter '*.php')
    $newMigrations = @(Get-ChildItem -LiteralPath $CandidateMigrationsRoot -File -Filter '*.php')
    $newByName = @{}
    foreach ($migration in $newMigrations) { $newByName[$migration.Name.ToLowerInvariant()] = $migration }
    foreach ($oldMigration in $oldMigrations) {
        $key = $oldMigration.Name.ToLowerInvariant()
        if (-not $newByName.ContainsKey($key)) { throw "Update removes an installed migration: $($oldMigration.Name)" }
        if ((Get-FileHash -LiteralPath $oldMigration.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $newByName[$key].FullName -Algorithm SHA256).Hash) {
            throw "Update modifies an installed migration: $($oldMigration.Name)"
        }
    }
    $oldNames = @($oldMigrations | ForEach-Object { $_.Name.ToLowerInvariant() })
    $added = @($newMigrations | Where-Object { $oldNames -notcontains $_.Name.ToLowerInvariant() } | ForEach-Object Name)
    if ($added.Count -gt 0 -and $Policy -ne 'backward_compatible_additive') {
        throw "Update adds database migrations but is not declared backward-compatible additive: $($added -join ', ')"
    }
    [pscustomobject]@{ Policy = $Policy; AddedMigrations = $added; BackwardCodeCompatible = ($added.Count -eq 0 -or $Policy -eq 'backward_compatible_additive') }
}
