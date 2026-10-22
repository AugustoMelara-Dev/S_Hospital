#Requires -Version 5.1

Set-StrictMode -Version Latest

function ConvertTo-NativeDotEnvValue {
    param([AllowEmptyString()][string] $Value)

    '"' + ($Value -replace '\\', '\\' -replace '"', '\"' -replace "`r", '' -replace "`n", '\n') + '"'
}

function ConvertFrom-NativeDotEnvValue {
    param([AllowEmptyString()][string] $Value)

    if ($Value.Length -ge 2 -and $Value[0] -eq '"' -and $Value[$Value.Length - 1] -eq '"') {
        return [Text.RegularExpressions.Regex]::Unescape($Value.Substring(1, $Value.Length - 2))
    }
    $Value
}
