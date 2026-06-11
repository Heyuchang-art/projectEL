<#
.SYNOPSIS
    NapCat QQ Shell self-contained deployment (zero-dependency)
.DESCRIPTION
    1. Download NapCat.Shell.zip (no QQNT desktop needed)
    2. Silent-extract wrapper.node + DLLs from QQNT NSIS installer
    3. Clean up unnecessary files
    4. Deploy config templates from config/napcat-templates/
    5. Verify deployment integrity
    napcat/ is fully self-contained after deployment.
    Config templates live in config/napcat-templates/ (git-tracked) and
    are copied to napcat/config/ at deploy time.
.PARAMETER Force
    Force re-download and re-extract all components
.PARAMETER NapCatVersion
    NapCat Shell version (default v4.18.4)
.EXAMPLE
    .\setup-napcat.ps1
    .\setup-napcat.ps1 -Force
    .\setup-napcat.ps1 -NapCatVersion "v4.20.0"
#>

param(
    [switch]$Force = $false,
    [string]$NapCatVersion = "v4.18.4"
)

$ErrorActionPreference = 'Stop'
$RootDir    = Resolve-Path (Join-Path $PSScriptRoot '..')
$NapCatDir  = Join-Path $RootDir 'napcat'
$TempDir    = Join-Path $env:TEMP 'napcat-setup'
$7zaExe     = Join-Path $TempDir '7za.exe'

# ============================================================================
# Helpers
# ============================================================================

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Text, [string]$Color = 'Cyan')
    Write-Host "[$Step/$Total] $Text" -ForegroundColor $Color
}

function Test-NapCatCoreExists {
    $coreFile = Join-Path $NapCatDir 'napcat.mjs'
    return (Test-Path $coreFile) -and (-not $Force)
}

function Test-WrapperNodeExists {
    $wrapperFile = Join-Path $NapCatDir 'wrapper.node'
    return (Test-Path $wrapperFile) -and (-not $Force)
}

function Ensure-TempDir {
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}

# ============================================================================
# Step 1: Download NapCat.Shell.zip
# ============================================================================
function Install-NapCatShell {
    Write-Step 1 5 'Downloading NapCat Shell...' 'Cyan'

    if (Test-NapCatCoreExists) {
        Write-Host "  NapCat core already exists, skipping (use -Force to re-download)" -ForegroundColor Green
        return
    }

    $urls = @(
        "https://gh-proxy.com/https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/NapCat.Shell.zip"
        "https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/NapCat.Shell.zip"
    )

    $zipFile = Join-Path $env:TEMP 'NapCat.Shell.zip'

    $downloaded = $false
    foreach ($url in $urls) {
        try {
            Write-Host "  Trying: $url"
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($url, $zipFile)
            $wc.Dispose()
            $downloaded = $true
            Write-Host "  Download OK" -ForegroundColor Green
            break
        } catch {
            Write-Host "  Failed: $_" -ForegroundColor DarkYellow
        }
    }

    if (-not $downloaded) {
        Write-Host "  Download failed. Manually download and extract to napcat/" -ForegroundColor Red
        Write-Host "  URL: $($urls[-1])"
        exit 1
    }

    # Extract to temp directory
    Ensure-TempDir
    Write-Host "  Extracting..."
    Expand-Archive -Path $zipFile -DestinationPath $TempDir -Force
    Remove-Item $zipFile -Force

    # Locate napcat.mjs to find the source root
    $napcatMjs = Get-ChildItem $TempDir -Recurse -Filter 'napcat.mjs' -File | Select-Object -First 1
    if (-not $napcatMjs) {
        Write-Host "  ERROR: napcat.mjs not found in extracted files - zip structure may have changed" -ForegroundColor Red
        exit 1
    }

    # napcat.mjs is at <root>/napcat/napcat.mjs -> source root is its grandparent
    $sourceDir = Split-Path $napcatMjs.DirectoryName -Parent

    # Copy core files
    Write-Host "  Copying core files..."
    $allItems = Get-ChildItem $sourceDir -Force
    foreach ($item in $allItems) {
        $destPath = Join-Path $NapCatDir $item.Name

        # Skip injection-mode files
        if ($item.Name -match '^(NapCatWinBootMain\.exe|NapCatWinBootHook\.dll|loadNapCat\.js|launcher-win10.*\.bat|quickLoginExample\.bat|launcher\.bat|launcher-user\.bat|conout-D9oph_Le\.js)$') {
            Write-Host "    [skip injection] $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        if ($item.PSIsContainer) {
            if ($item.Name -eq 'napcat') {
                # napcat/ subdirectory -> flatten to root
                Copy-Item "$($item.FullName)\*" $NapCatDir -Recurse -Force
                Write-Host "    [flat] napcat/ -> root" -ForegroundColor Green
                continue
            }
            # Other directories: merge
            if (Test-Path $destPath) {
                Copy-Item "$($item.FullName)\*" $destPath -Recurse -Force
            } else {
                Copy-Item $item.FullName $destPath -Recurse -Force
            }
            Write-Host "    [dir] $($item.Name)/" -ForegroundColor Green
        } else {
            Copy-Item $item.FullName $destPath -Force
            Write-Host "    [file] $($item.Name)" -ForegroundColor Green
        }
    }

}

# ============================================================================
# Step 2: Extract wrapper.node + DLLs (silent extract from QQNT installer)
# ============================================================================
function Sync-QQNTBinaries {
    Write-Step 2 5 'Extracting QQNT binaries...' 'Cyan'

    if (Test-WrapperNodeExists) {
        Write-Host "  wrapper.node already exists, skipping (use -Force to re-extract)" -ForegroundColor Green
        return
    }

    # 2a. Read expected version from config.json
    $targetVersion = ''
    $cfgPath = Join-Path $NapCatDir 'config.json'
    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $targetVersion = $cfg.curVersion
            if (-not $targetVersion) { $targetVersion = $cfg.baseVersion }
        } catch { }
    }
    if (-not $targetVersion) {
        $targetVersion = '9.9.26-44343'  # known stable version
    }

    Write-Host "  Target QQNT version: $targetVersion"
    $buildId = ($targetVersion -split '-')[-1]

    # 2b. Download QQNT installer
    # QQNT installer naming: QQ9.9.26.44343_x64.exe
    $qqntVersionClean = $targetVersion -replace '-', '.'
    $qqntInstaller = "QQ${qqntVersionClean}_x64.exe"
    $qqntUrl = "https://dldir1.qq.com/qqfile/qq/QQNT/Windows/${qqntInstaller}"

    $installerPath = Join-Path $env:TEMP $qqntInstaller
    if (-not (Test-Path $installerPath)) {
        Write-Host "  Downloading QQNT installer (~200MB)..."
        Write-Host "  $qqntUrl"
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($qqntUrl, $installerPath)
            $wc.Dispose()
            Write-Host "  Download OK" -ForegroundColor Green
        } catch {
            Write-Host "  QQNT installer download failed: $_" -ForegroundColor Red
            Write-Host "  Manually download $qqntInstaller to %TEMP% and retry" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "  Installer already cached: $installerPath"
    }

    # 2c. Download 7za.exe if needed
    if (-not (Test-Path $7zaExe)) {
        Write-Host "  Downloading 7za.exe..."
        $7zaUrl = 'https://7-zip.org/a/7za920.zip'
        $7zaZip = Join-Path $env:TEMP '7za920.zip'
        try {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($7zaUrl, $7zaZip)
            $wc.Dispose()
            Expand-Archive -Path $7zaZip -DestinationPath $TempDir -Force
            Remove-Item $7zaZip -Force
            Write-Host "  7za.exe ready" -ForegroundColor Green
        } catch {
            Write-Host "  7za.exe download failed, will try Expand-Archive fallback" -ForegroundColor Yellow
        }
    }

    # 2d. Extract QQNT installer
    $extractDir = Join-Path $env:TEMP 'qqnt-extract'
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

    Write-Host "  Extracting QQNT installer (may take 1-2 minutes)..."

    if (Test-Path $7zaExe) {
        # Use 7za to extract NSIS installer
        $extractArgs = @('x', "`"$installerPath`"", "-o`"$extractDir`"", '-y')
        $proc = Start-Process -FilePath $7zaExe -ArgumentList $extractArgs -Wait -NoNewWindow -PassThru
        if ($proc.ExitCode -ne 0) {
            Write-Host "  7za extraction failed (exit code: $($proc.ExitCode))" -ForegroundColor Yellow
            Write-Host "  Falling back to Expand-Archive..."
            try {
                Expand-Archive -Path $installerPath -DestinationPath $extractDir -Force
            } catch {
                Write-Host "  QQNT installer extraction completely failed" -ForegroundColor Red
                exit 1
            }
        }
    } else {
        # Fallback: Expand-Archive
        try {
            Expand-Archive -Path $installerPath -DestinationPath $extractDir -Force
        } catch {
            Write-Host "  QQNT installer extraction failed. Ensure 7za.exe is available." -ForegroundColor Red
            exit 1
        }
    }

    # 2e. Scan and extract wrapper.node + DLLs
    Write-Host "  Scanning for binary files..."

    # Recursively search for wrapper.node in extracted directory
    $wrapperSrc = Get-ChildItem $extractDir -Recurse -Filter 'wrapper.node' -File | Select-Object -First 1
    if (-not $wrapperSrc) {
        Write-Host "  ERROR: wrapper.node not found! QQNT installer structure may have changed" -ForegroundColor Red
        Write-Host "  Temporary workaround: install QQNT desktop, then re-run this script" -ForegroundColor Yellow
        exit 1
    }

    # wrapper.node location is resources/app/
    $resDir = $wrapperSrc.DirectoryName
    Write-Host "  Found wrapper.node at: $resDir"

    # Extract critical files
    $criticalFiles = @('wrapper.node', 'major.node')
    foreach ($f in $criticalFiles) {
        $src = Join-Path $resDir $f
        if (Test-Path $src) {
            Copy-Item $src $NapCatDir -Force
            Write-Host "    [critical] $f" -ForegroundColor Green
        } else {
            Write-Host "    [missing] $f" -ForegroundColor Yellow
        }
    }

    # Extract DLL dependencies
    $dllFiles = @(
        'QBar.dll', 'LightQuic.dll', 'broadcast_ipc.dll',
        'libglib-2.0-0.dll', 'libgobject-2.0-0.dll',
        'libvips-42.dll', 'ncnn.dll', 'opencv.dll', 'avif_convert.dll'
    )
    foreach ($f in $dllFiles) {
        $src = Join-Path $resDir $f
        if (Test-Path $src) {
            Copy-Item $src $NapCatDir -Force
            Write-Host "    [dll] $f" -ForegroundColor Green
        } else {
            Write-Host "    [missing] $f (non-critical)" -ForegroundColor DarkYellow
        }
    }

    # Extract QQNT.dll (in version root, not resources/app)
    $qqntDll = Get-ChildItem $extractDir -Recurse -Filter 'QQNT.dll' -File | Select-Object -First 1
    if ($qqntDll) {
        Copy-Item $qqntDll.FullName $NapCatDir -Force
        Write-Host "    [dll] QQNT.dll" -ForegroundColor Green
    } else {
        Write-Host "    [missing] QQNT.dll (non-critical)" -ForegroundColor DarkYellow
    }

    # 2f. Update version configs
    Write-Host "  Updating version configs -> $targetVersion (build $buildId)..."

    # config.json
    if (Test-Path $cfgPath) {
        try {
            $c = Get-Content $cfgPath -Raw | ConvertFrom-Json
            $c.baseVersion = $targetVersion
            $c.curVersion  = $targetVersion
            $c.buildId     = $buildId
            $c | ConvertTo-Json -Depth 10 | Set-Content $cfgPath -Encoding utf8
            Write-Host "    config.json OK" -ForegroundColor Green
        } catch {
            Write-Host "    config.json update failed" -ForegroundColor Yellow
        }
    }

    # package.json
    $pkgPath = Join-Path $NapCatDir 'package.json'
    if (Test-Path $pkgPath) {
        try {
            $p = Get-Content $pkgPath -Raw | ConvertFrom-Json
            $p.version = $targetVersion
            $p | Add-Member -MemberType NoteProperty -Name 'buildVersion' -Value $buildId -Force
            $p | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding utf8
            Write-Host "    package.json OK" -ForegroundColor Green
        } catch {
            Write-Host "    package.json update failed: $_" -ForegroundColor Yellow
        }
    }

    # 2g. Cleanup
    Write-Host "  Cleaning up temporary files..."
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    Write-Host "  Cleaned up QQNT installer (freed ~200MB)" -ForegroundColor Green
}

# ============================================================================
# Step 3: Remove unnecessary files
# ============================================================================
function Clear-UnnecessaryFiles {
    Write-Step 3 5 'Cleaning up unnecessary files...' 'Cyan'

    $removedSize = 0

    # 3a. Remove non-Windows native plugins
    $nonWindowsPatterns = @(
        'native\**\*.darwin.*.node',
        'native\**\*.linux.*.node',
        'native\**\darwin.*\*',
        'native\**\linux.*\*'
    )
    foreach ($pattern in $nonWindowsPatterns) {
        $files = Get-ChildItem (Join-Path $NapCatDir $pattern) -File -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            $removedSize += $f.Length
            Remove-Item $f.FullName -Force
            Write-Host "  - $($f.Name)" -ForegroundColor Gray
        }
    }

    # Remove empty non-Windows platform directories
    $platDirs = @('darwin.arm64', 'linux.arm64', 'linux.x64', 'win32-arm64')
    foreach ($platDir in $platDirs) {
        $dirs = Get-ChildItem $NapCatDir -Recurse -Directory -Filter $platDir -ErrorAction SilentlyContinue
        foreach ($d in $dirs) {
            if ($d.FullName -match '\\native\\') {
                Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # 3b. Remove stale hash chunks not referenced by index.html
    $assetsDir = Join-Path $NapCatDir 'static\assets'
    if (Test-Path $assetsDir) {
        $indexHtml = Join-Path $NapCatDir 'static\index.html'
        if (Test-Path $indexHtml) {
            $htmlContent = Get-Content $indexHtml -Raw
            $referencedFiles = [regex]::Matches($htmlContent, '(?:src|href)="[^"]*?([^/"]+)"') |
                ForEach-Object { $_.Groups[1].Value } |
                Where-Object { $_ -match '\.(js|css|png|ico|svg|woff2?)$' }
            $refSet = [System.Collections.Generic.HashSet[string]]::new()
            foreach ($rf in $referencedFiles) { [void]$refSet.Add($rf) }

            $assetFiles = Get-ChildItem $assetsDir -File
            foreach ($af in $assetFiles) {
                if (-not $refSet.Contains($af.Name) -and $af.Name -match '^chunk-[A-Z0-9]+-[A-Za-z0-9_-]+\.(js|css)$') {
                    $removedSize += $af.Length
                    Remove-Item $af.FullName -Force
                }
            }
        }
    }

    # 3c. Clean cache/log junk
    Get-ChildItem (Join-Path $NapCatDir 'cache\*.png') -File -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem (Join-Path $NapCatDir '*.log') -File -ErrorAction SilentlyContinue | Remove-Item -Force

    # 3d. Remove deployment leftovers
    $rootZip = Join-Path $RootDir 'napcat.zip'
    if (Test-Path $rootZip) { Remove-Item $rootZip -Force }

    Write-Host "  Freed: $([math]::Round($removedSize/1MB, 1))MB" -ForegroundColor Green
}

# ============================================================================
# Step 4: Deploy config templates from git-tracked config/napcat-templates/
# ============================================================================
function Deploy-NapCatConfigTemplates {
    Write-Step 4 5 'Deploying config templates...' 'Cyan'

    $TemplateDir = Join-Path $RootDir 'config\napcat-templates'

    if (-not (Test-Path $TemplateDir)) {
        Write-Host "  ERROR: Template directory not found: $TemplateDir" -ForegroundColor Red
        Write-Host "  This should never happen - config/napcat-templates/ is git-tracked." -ForegroundColor Red
        exit 1
    }

    # Config files land at napcat/config/ (after zip napcat/ subdir flattening)
    $TargetDir = Join-Path $NapCatDir 'config'
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

    $templates = @('onebot11.json', 'napcat.json', 'webui.json')
    foreach ($t in $templates) {
        $src = Join-Path $TemplateDir $t
        if (-not (Test-Path $src)) {
            Write-Host "  ERROR: Template missing: $t" -ForegroundColor Red
            Write-Host "  Expected at: $src" -ForegroundColor Red
            exit 1
        }

        # Verify valid JSON before copying
        try {
            Get-Content $src -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
        } catch {
            Write-Host "  ERROR: Template is not valid JSON: $t" -ForegroundColor Red
            Write-Host "  $_" -ForegroundColor Red
            exit 1
        }

        Copy-Item $src $TargetDir -Force
        Write-Host "  [OK] $t -> napcat/config/" -ForegroundColor Green
    }

    # Verify the deployed onebot11.json structure
    $deployedConfig = Join-Path $TargetDir 'onebot11.json'
    try {
        $config = Get-Content $deployedConfig -Raw -Encoding UTF8 | ConvertFrom-Json
        $wsClients = $config.network.websocketClients
        if ($wsClients -and $wsClients.Count -gt 0) {
            foreach ($client in $wsClients) {
                if ($client.url -and $client.enable) {
                    Write-Host "  [OK] WS: $($client.name) -> $($client.url)" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "  [WARN] No WebSocket clients configured in onebot11.json" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [ERR] Deployed onebot11.json validation failed: $_" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# Step 5: Verify deployment integrity
# ============================================================================
function Test-Deployment {
    Write-Step 5 5 'Verifying deployment...' 'Cyan'

    $required = @(
        @{Path='node.exe';           Label='Node.js runtime';          Critical=$true},
        @{Path='wrapper.node';       Label='QQNT Wrapper module';      Critical=$true},
        @{Path='napcat.mjs';         Label='NapCat core';              Critical=$true},
        @{Path='config\onebot11.json';  Label='OneBot config (deployed from config/napcat-templates/)'; Critical=$true},
        @{Path='napcat.bat';         Label='Shell entry point';        Critical=$true},
        @{Path='index.cjs';          Label='Custom launcher';          Critical=$true}
    )

    $allOk = $true
    foreach ($r in $required) {
        $fullPath = Join-Path $NapCatDir $r.Path
        if (Test-Path $fullPath) {
            Write-Host "  [OK] $($r.Label) ($($r.Path))" -ForegroundColor Green
        } else {
            if ($r.Critical) {
                Write-Host "  [MISS] $($r.Label) ($($r.Path))" -ForegroundColor Red
                $allOk = $false
            } else {
                Write-Host "  [WARN] $($r.Label) (non-critical)" -ForegroundColor Yellow
            }
        }
    }

    # Validate onebot11.json content
    $configPath = Join-Path $NapCatDir 'config\onebot11.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $wsClients = $config.network.websocketClients
            if ($wsClients -and $wsClients.Count -gt 0) {
                foreach ($client in $wsClients) {
                    if ($client.url) {
                        Write-Host "  [OK] WS Client: $($client.name) -> $($client.url)" -ForegroundColor Green
                    } else {
                        Write-Host "  [WARN] WS Client missing url" -ForegroundColor Yellow
                    }
                }
            }
        } catch {
            Write-Host "  [ERR] onebot11.json is not valid JSON" -ForegroundColor Red
            $allOk = $false
        }
    }

    return $allOk
}

# ============================================================================
# Main
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NapCat QQ Shell - Self-Contained Setup (5 steps)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ensure napcat/ subdirectories exist
$subdirs = @('config', 'native', 'plugins', 'static', 'worker', 'node_modules')
foreach ($sd in $subdirs) {
    $destSub = Join-Path $NapCatDir $sd
    if (-not (Test-Path $destSub)) {
        New-Item -ItemType Directory -Path $destSub -Force | Out-Null
    }
}

try {
    Install-NapCatShell
    Sync-QQNTBinaries
    Clear-UnnecessaryFiles
    Deploy-NapCatConfigTemplates
    $ok = Test-Deployment
} finally {
    # Clean up temp directory
    if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
if ($ok) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Deployment complete! napcat/ is self-contained" -ForegroundColor Green
    Write-Host "  -> Run napcat.bat to start" -ForegroundColor Green
    Write-Host "  -> The entire napcat/ dir can be copied to any Windows machine" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Deployment incomplete - check missing items above" -ForegroundColor Red
    Write-Host "  Re-run: .\setup-napcat.ps1 -Force" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
