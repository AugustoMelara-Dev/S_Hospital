function Protect-HospitalOperationalText([string] $Value, [string] $ProjectRoot = "") {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Value
    }

    $protected = $Value

    if (-not [string]::IsNullOrWhiteSpace($ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Test-HospitalOperationalUrlInput([string] $TargetUrl) {
    if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
        throw "La direccion del sistema esta vacia. Use http://127.0.0.1:8000 en servidor o http://IP-DEL-SERVIDOR:8000 en clientes."
    }

    $cleanUrl = $TargetUrl.Trim()

    try {
        $uri = [System.Uri] $cleanUrl
    } catch {
        throw "La direccion del sistema no es valida. Use una direccion como http://IP-DEL-SERVIDOR:8000."
    }

    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @("http", "https") -or [string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "La direccion del sistema debe iniciar con http:// o https:// e incluir el servidor."
    }

    if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
        throw "La direccion del sistema no debe incluir usuario ni contrasena. Use solo http://IP-DEL-SERVIDOR:8000."
    }

    if (-not [string]::IsNullOrWhiteSpace($uri.Query) -or -not [string]::IsNullOrWhiteSpace($uri.Fragment)) {
        throw "La direccion del sistema no debe incluir parametros ni fragmentos. Use solo http://IP-DEL-SERVIDOR:8000."
    }

    return $cleanUrl.TrimEnd("/")
}
