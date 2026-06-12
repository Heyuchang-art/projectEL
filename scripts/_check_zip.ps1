$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\lisky\AppData\Local\Temp\NapCat.Shell.zip')
$zip.Entries | Where-Object { $_.Name -match 'wrapper|config\.json|napcat\.mjs|node\.exe|major|QQNT' } | ForEach-Object { Write-Host "$($_.FullName)  $($_.Length)" }
$zip.Dispose()
