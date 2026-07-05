# ==============================================================================
# S_Hospital - Env Helpers Library
# ==============================================================================
# Contiene funciones reutilizables y seguras para manipulacion de archivos .env
# de forma no destructiva y compatible con PowerShell de Windows sin emojis.

# Safe environment variables loader into a hashtable
function Read-EnvFile([string] $path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $path)) {
        return $values
    }
    Get-Content -LiteralPath $path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -gt 0 -and [char]$line[0] -eq [char]0xFEFF) {
            $line = $line.Substring(1).Trim()
        }
        if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        $values[$key] = $value
    }
    return $values
}

# Update env variables in .env file preserving existing keys and comments
function Update-DotEnv {
    param (
        [string]$Path,
        [hashtable]$Variables
    )
    if (-not (Test-Path $Path)) {
        if (Test-Path "$Path.example") {
            Copy-Item "$Path.example" $Path
        } else {
            New-Item $Path -ItemType File | Out-Null
        }
    }
    
    $lines = Get-Content $Path
    $newLines = @()
    $processedKeys = @()

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -gt 0 -and [char]$trimmed[0] -eq [char]0xFEFF) {
            $trimmed = $trimmed.Substring(1).Trim()
        }
        if ($trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            $newLines += $line
            continue
        }

        $parts = $trimmed.Split("=", 2)
        $key = $parts[0].Trim()
        
        if ($Variables.ContainsKey($key)) {
            $val = $Variables[$key]
            # Wrap in double quotes if there are spaces and not already quoted
            if ($val -match "\s" -and -not $val.StartsWith('"') -and -not $val.StartsWith("'")) {
                $val = """$val"""
            }
            $newLines += "$key=$val"
            $processedKeys += $key
        } else {
            $newLines += $line
        }
    }

    # Append any variables that were not in the template/file
    foreach ($key in $Variables.Keys) {
        if ($processedKeys -notcontains $key) {
            $val = $Variables[$key]
            if ($val -match "\s" -and -not $val.StartsWith('"') -and -not $val.StartsWith("'")) {
                $val = """$val"""
            }
            $newLines += "$key=$val"
        }
    }

    Set-Content $Path -Value $newLines
}
