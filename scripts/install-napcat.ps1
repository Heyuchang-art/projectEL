$ErrorActionPreference = 'Stop'
$zip  = Join-Path $PSScriptRoot '..\napcat.zip'
$dest = Join-Path $PSScriptRoot '..\napcat'
$url_proxy  = 'https://gh-proxy.com/https://github.com/NapNeko/NapCatQQ/releases/download/v4.18.4/NapCat.Shell.zip'
$url_direct = 'https://github.com/NapNeko/NapCatQQ/releases/download/v4.18.4/NapCat.Shell.zip'

Write-Host "[NapCat] Trying gh-proxy download..."
try {
    Invoke-WebRequest -Uri $url_proxy -OutFile $zip -TimeoutSec 45
    Write-Host "[NapCat] Download succeeded via gh-proxy."
} catch {
    Write-Host "[NapCat] gh-proxy failed, falling back to direct GitHub..."
    Invoke-WebRequest -Uri $url_direct -OutFile $zip
    Write-Host "[NapCat] Download succeeded via GitHub."
}

Write-Host "[NapCat] Extracting to $dest ..."
Expand-Archive -Path $zip -DestinationPath $dest -Force
Remove-Item $zip
Write-Host "[NapCat] Installation complete!"
