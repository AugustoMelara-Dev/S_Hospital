function Get-HospitalLanAssetPaths([string] $Html) {
    $javaScript = ""
    $css = ""

    foreach ($scriptTag in [regex]::Matches($Html, '<script\b[^>]*>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $source = [regex]::Match($scriptTag.Value, 'src=["''](?<path>/assets/[^"'']+\.js)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($source.Success) {
            $javaScript = $source.Groups["path"].Value
            break
        }
    }

    foreach ($linkTag in [regex]::Matches($Html, '<link\b[^>]*>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $relationship = [regex]::Match($linkTag.Value, 'rel=["''](?<value>[^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $href = [regex]::Match($linkTag.Value, 'href=["''](?<path>/assets/[^"'']+\.css)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($relationship.Success -and $relationship.Groups["value"].Value -match '(?i)(^|\s)stylesheet(\s|$)' -and $href.Success) {
            $css = $href.Groups["path"].Value
            break
        }
    }

    return [pscustomobject] @{
        JavaScript = $javaScript
        Css = $css
    }
}
