# NapCat Deployment Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-command `setup-napcat.ps1` deployment after git clone — zero QQNT desktop dependency, QQBotCard start/stop functional.

**Architecture:** Minimal extractor: download QQNT NSIS installer → `7za.exe` silent extract → grab `wrapper.node` + DLLs → cleanup. NapCat runs standalone as OneBot v11 WS client, backend `server.ts` manages process lifecycle, frontend `QQBotCard.tsx` provides start/stop and status monitoring.

**Encoding rule:** All core code (PS1, TS, TSX, JS, JSON) uses English only. Only `start.bat` may contain Chinese (user-facing startup messages). This eliminates encoding-related garbled text issues entirely.

**Tech Stack:** PowerShell 5.1+, Node.js, 7-Zip standalone (7za.exe), NapCat Shell v4.18.4, QQNT NSIS installer

---

## File Map

| Action | File | Responsibility |
|:---|:---|:---|
| Create | `scripts/setup-napcat.ps1` | Minimal extractor: download NapCat Shell + extract binaries from QQNT installer |
| Create | `scripts/strip-bom.js` | Strip UTF-8 BOM from JSON files (NapCat compat) |
| Modify | `.gitignore` | Update NapCat exclusion rules |
| Modify | `napcat/napcat.bat` | Shell entry point, reference `index.cjs` |
| Modify | `backend/src/server.ts:326-354` | Align preflight paths + structured error with hint |
| Modify | `frontend/src/components/QQBotCard.tsx:55-72` | Display specific errors + fix hints |
| Track | `napcat/index.cjs` | Custom launcher (smart 3-tier wrapper.node locator) |
| Track | `napcat/config.json` | QQ version disguise config |
| Track | `napcat/package.json` | QQ disguise package info |
| Track | `napcat/KillQQ.bat` | Process cleanup helper |
| Track | `napcat/config/onebot11.json` | OneBot WS client config template |
| Track | `napcat/config/napcat.json` | NapCat runtime config |
| Track | `napcat/config/webui.json` | WebUI config (port 6099) |
| Delete | `napcat/index.js` | Replaced by `index.cjs` |
| Delete | `napcat/napcat/` (entire dir) | Old nested structure, now flattened |
| Delete | `scripts/install-napcat.ps1` | Replaced by new `setup-napcat.ps1` |
| Delete | `scripts/sync-qq-shell.ps1` | Merged into `setup-napcat.ps1` |
| Delete | `stderr.txt` `stdout.txt` etc. | Debug log leftovers |

---

### Task 1: Update .gitignore exclusion rules

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Replace NapCat rules**

Replace lines 27-68 of `.gitignore` (current NapCat rules) with:

```gitignore
# NapCat: large binaries (deployed by setup-napcat.ps1)
napcat/node.exe
napcat/napcat.mjs
napcat/wrapper.node
napcat/major.node
napcat/QQNT.dll
napcat/*.dll
napcat/node_modules/
napcat/native/
napcat/static/
napcat/worker/
napcat/plugins/

# NapCat: runtime-generated files
napcat/cache/
napcat/logs/
napcat/*.db*
napcat/*.log
napcat/config/napcat_*.json
napcat/config/onebot11_*.json
napcat/config/napcat_protocol_*.json

# NapCat: deployment leftovers
napcat.zip
```

> Key changes:
> - `napcat/napcat/napcat.mjs` → `napcat/napcat.mjs` (post-flatten path)
> - Remove deep `napcat/napcat/native/` paths → `napcat/native/`
> - Remove exclusion of `napcat/napcat/config/` — config now at `napcat/config/` and git-tracked

- [ ] **Step 2: Verify whitelisted files are not ignored**

Run: `git check-ignore napcat/napcat.bat napcat/index.cjs napcat/config/onebot11.json`

Expected: No output (files not ignored)

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for flat napcat/ structure"
```

---

### Task 2: Commit napcat/ protected files to git

**Files:**
- Track: `napcat/index.cjs`, `napcat/napcat.bat`, `napcat/config.json`, `napcat/package.json`
- Track: `napcat/KillQQ.bat`, `napcat/LICENSE-APACHE-2.0.txt`
- Track: `napcat/config/onebot11.json`, `napcat/config/napcat.json`, `napcat/config/webui.json`
- Track: `scripts/strip-bom.js`, `scripts/setup-napcat.ps1` (current version as baseline)
- Delete: `napcat/index.js`, `napcat/napcat/` (all residual files)
- Delete: `scripts/install-napcat.ps1`, `scripts/sync-qq-shell.ps1`
- Delete: `stderr.txt`, `stderr2.txt`, `stderr3.txt`, `stdout.txt`, `stdout2.txt`, `stdout3.txt`

- [ ] **Step 1: Delete old files**

```bash
# Delete old index.js
git rm napcat/index.js 2>/dev/null

# Delete old nested napcat/napcat/ directory
git rm -r napcat/napcat/ 2>/dev/null || true

# Delete old install scripts
git rm scripts/install-napcat.ps1 scripts/sync-qq-shell.ps1 2>/dev/null || true

# Delete debug log leftovers
git rm stderr.txt stderr2.txt stderr3.txt stdout.txt stdout2.txt stdout3.txt 2>/dev/null || true
```

- [ ] **Step 2: Stage new files**

```bash
# Stage napcat protected files
git add napcat/napcat.bat napcat/index.cjs napcat/config.json napcat/package.json
git add napcat/KillQQ.bat napcat/LICENSE-APACHE-2.0.txt
git add napcat/config/onebot11.json napcat/config/napcat.json napcat/config/webui.json

# Stage scripts
git add scripts/strip-bom.js scripts/setup-napcat.ps1
```

- [ ] **Step 3: Verify staged content**

```bash
git status
```

Confirm:
- `napcat/index.js` shows as `deleted`
- `napcat/napcat/` files show as `deleted`
- `napcat/index.cjs` shows as `new file`
- `napcat/config/onebot11.json` shows as `new file`

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: flatten napcat/ structure, track launcher files

- Replace napcat/index.js with napcat/index.cjs (smart 3-tier wrapper.node locator)
- Move config/ from napcat/napcat/config/ to napcat/config/
- Delete old injection-mode files (launchers, bootstrappers)
- Delete deprecated install-napcat.ps1 and sync-qq-shell.ps1
- Add strip-bom.js for JSON BOM cleanup
- Track setup-napcat.ps1 as baseline"
```

---

### Task 3: Rewrite setup-napcat.ps1 (minimal extractor)

**Files:**
- Rewrite: `scripts/setup-napcat.ps1`

This is the core of the refactor. Complete rewrite in English.

- [ ] **Step 1: Write the new script**

```powershell
<#
.SYNOPSIS
    NapCat QQ Shell self-contained deployment (zero-dependency)
.DESCRIPTION
    1. Download NapCat.Shell.zip (no QQNT desktop needed)
    2. Silent-extract wrapper.node + DLLs from QQNT NSIS installer
    3. Clean up unnecessary files + verify integrity
    4. napcat/ is fully self-contained after deployment
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

# ═══════════════════════════════════════════════════════════════════════════
# Protected files (git-tracked custom files — never overwritten by upstream)
# ═══════════════════════════════════════════════════════════════════════════
$ProtectedFiles = @(
    'napcat.bat',
    'index.cjs',
    'config.json',
    'package.json',
    'KillQQ.bat'
)

# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

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

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Download NapCat.Shell.zip
# ═══════════════════════════════════════════════════════════════════════════
function Install-NapCatShell {
    Write-Step 1 4 'Downloading NapCat Shell...' 'Cyan'

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
        Write-Host "  ERROR: napcat.mjs not found in extracted files — zip structure may have changed" -ForegroundColor Red
        exit 1
    }

    # napcat.mjs is at <root>/napcat/napcat.mjs → source root is its grandparent
    $sourceDir = Split-Path $napcatMjs.DirectoryName -Parent

    # Backup user config
    $onebotBackup = $null
    $onebotConfigPath = Join-Path $NapCatDir 'config\onebot11.json'
    if (Test-Path $onebotConfigPath) {
        $onebotBackup = Get-Content $onebotConfigPath -Raw -Encoding UTF8
    }

    # Copy core files
    Write-Host "  Copying core files..."
    $allItems = Get-ChildItem $sourceDir -Force
    foreach ($item in $allItems) {
        $destPath = Join-Path $NapCatDir $item.Name

        # Skip protected files
        if ($ProtectedFiles -contains $item.Name) {
            Write-Host "    [skip protected] $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        # Skip injection-mode files
        if ($item.Name -match '^(NapCatWinBootMain\.exe|NapCatWinBootHook\.dll|loadNapCat\.js|launcher-win10.*\.bat|quickLoginExample\.bat|launcher\.bat|launcher-user\.bat|conout-D9oph_Le\.js)$') {
            Write-Host "    [skip injection] $($item.Name)" -ForegroundColor DarkGray
            continue
        }

        # Skip root-level napcat.mjs (the real one is in napcat/ subdirectory)
        if ($item.Name -eq 'napcat.mjs' -and (-not $item.PSIsContainer)) {
            Write-Host "    [skip root-level] napcat.mjs" -ForegroundColor DarkGray
            continue
        }

        if ($item.PSIsContainer) {
            if ($item.Name -eq 'napcat') {
                # napcat/ subdirectory → flatten to root
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

    # Restore user config
    if ($onebotBackup) {
        $onebotBackup | Set-Content $onebotConfigPath -Encoding UTF8 -NoNewline
        Write-Host "  Restored onebot11.json" -ForegroundColor Green
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Extract wrapper.node + DLLs (silent extract from QQNT installer)
# ═══════════════════════════════════════════════════════════════════════════
function Sync-QQNTBinaries {
    Write-Step 2 4 'Extracting QQNT binaries...' 'Cyan'

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

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Remove unnecessary files
# ═══════════════════════════════════════════════════════════════════════════
function Clear-UnnecessaryFiles {
    Write-Step 3 4 'Cleaning up unnecessary files...' 'Cyan'

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

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Verify deployment integrity
# ═══════════════════════════════════════════════════════════════════════════
function Test-Deployment {
    Write-Step 4 4 'Verifying deployment...' 'Cyan'

    $required = @(
        @{Path='node.exe';           Label='Node.js runtime';          Critical=$true},
        @{Path='wrapper.node';       Label='QQNT Wrapper module';      Critical=$true},
        @{Path='napcat.mjs';         Label='NapCat core';              Critical=$true},
        @{Path='config\onebot11.json'; Label='OneBot config';          Critical=$true},
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

# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NapCat QQ Shell - Self-Contained Setup" -ForegroundColor Cyan
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
```

- [ ] **Step 2: Validate script syntax**

Run: `powershell -NoProfile -Command "Get-Command 'scripts\setup-napcat.ps1'"`

Expected: No syntax errors. The file is UTF-8 without BOM (pure ASCII English, no encoding risk).

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-napcat.ps1
git commit -m "feat: rewrite setup-napcat.ps1 - zero-dependency extractor

- Download NapCat Shell zip (no QQNT desktop needed)
- Extract wrapper.node + DLLs from QQNT NSIS installer via 7za.exe
- Cleanup non-Windows plugins and stale hash chunks
- Version config auto-update
- Protected file list prevents custom launcher overwrite
- Idempotent: skip steps where files already exist
- -Force flag for full re-deployment
- All English output - no encoding issues"
```

---

### Task 4: Fix napcat.bat path

**Files:**
- Modify: `napcat/napcat.bat`

Current content references `./index.js`. Must change to `./index.cjs`.

- [ ] **Step 1: Update napcat.bat content**

```batch
@echo off
cd /d "%~dp0"
node.exe ./index.cjs %*
```

> Note:
> - Remove `chcp 65001` (not needed, all ASCII)
> - `index.js` -> `index.cjs`
> - Content is pure ASCII — encoding-safe regardless of GBK or UTF-8

- [ ] **Step 2: Verify line endings**

```bash
file napcat/napcat.bat
```

Expected: `DOS batch file, ASCII text, with CRLF line terminators`

- [ ] **Step 3: Commit**

```bash
git add napcat/napcat.bat
git commit -m "fix: napcat.bat use index.cjs"
```

---

### Task 5: Fix server.ts preflight paths + structured error

**Files:**
- Modify: `backend/src/server.ts:326-354`

- [ ] **Step 1: Replace preflightNapCat function**

Replace lines 326-354 with:

```typescript
  // ── NapCat Preflight ─────────────────────────────────────────────────
  async function preflightNapCat(): Promise<{ ok: boolean; error?: string; hint?: string }> {
    const dir = path.join(workspaceCwd, 'napcat');
    const setupCmd = 'powershell -File scripts\\setup-napcat.ps1';

    const checks = [
      { file: 'node.exe',                           label: 'Node.js runtime' },
      { file: 'wrapper.node',                       label: 'QQNT Wrapper module' },
      { file: 'napcat.mjs',                         label: 'NapCat core' },
      { file: path.join('config', 'onebot11.json'), label: 'OneBot config' },
    ];

    const missing: string[] = [];
    for (const c of checks) {
      if (!await fs.pathExists(path.join(dir, c.file))) {
        missing.push(`  - ${c.label} (${c.file})`);
      }
    }

    if (missing.length > 0) {
      return {
        ok: false,
        error: `Missing components:\n${missing.join('\n')}`,
        hint: `Run: ${setupCmd}`,
      };
    }

    // Strip BOM from JSON files (known issue: NapCat JSONs with UTF-8 BOM crash on parse)
    const stripBom = path.join(workspaceCwd, 'scripts', 'strip-bom.js');
    if (await fs.pathExists(stripBom)) {
      try {
        const { execSync } = await import('child_process');
        execSync(`node "${stripBom}"`, { cwd: dir, timeout: 5000, windowsHide: true });
      } catch { /* strip-bom failure is non-blocking */ }
    }
    return { ok: true };
  }
```

- [ ] **Step 2: Update /api/qq/start handler to pass hint**

Find the preflight call in `app.post('/api/qq/start', ...)` and update the error response:

```typescript
      // Preflight: ensure NapCat runtime is complete
      const preflight = await preflightNapCat();
      if (!preflight.ok) {
        return res.status(400).json({
          success: false,
          error: preflight.error,
          hint: preflight.hint,
        });
      }
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "fix: server.ts preflight paths + structured error with hint

- Use path.join for cross-platform config/onebot11.json path
- Return list of ALL missing files (not just first)
- Add hint field with one-click fix command
- All English error messages"
```

---

### Task 6: Fix QQBotCard.tsx error display

**Files:**
- Modify: `frontend/src/components/QQBotCard.tsx:55-72`

- [ ] **Step 1: Replace startService function**

Replace `startService` (lines 55-72) with:

```tsx
  const startService = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, running: true } : null);
        setActionError(null);
      } else {
        // Show specific error + fix hint
        const msg = data.hint
          ? `${data.error}\n\nFix: ${data.hint}`
          : (data.error || 'Start failed');
        setActionError(msg);
      }
    } catch {
      setActionError('Cannot connect to backend (localhost:3000)\nVerify backend is running: npx tsx backend/src/server.ts');
    }
    setActionLoading(false);
    fetchData();
  };
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QQBotCard.tsx
git commit -m "fix: QQBotCard shows specific preflight errors + fix hints

- Display backend hint (one-click deploy command) when available
- Show connection help message on fetch failure
- All English error messages"
```

---

### Task 7: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Run setup-napcat.ps1**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-napcat.ps1
```

Expected output:
```
[1/4] Downloading NapCat Shell...
  NapCat core already exists, skipping
[2/4] Extracting QQNT binaries...
  wrapper.node already exists, skipping
[3/4] Cleaning up unnecessary files...
[4/4] Verifying deployment...
  [OK] Node.js runtime (node.exe)
  [OK] QQNT Wrapper module (wrapper.node)
  [OK] NapCat core (napcat.mjs)
  [OK] OneBot config (config\onebot11.json)
  [OK] Shell entry point (napcat.bat)
  [OK] Custom launcher (index.cjs)
  [OK] WS Client: Snapshot Pi -> ws://127.0.0.1:3001/qq/ws
  Deployment complete!
```

- [ ] **Step 2: Verify NapCat can start independently**

```bash
cd napcat && napcat.bat
```

Expected: Process starts, `[NapCat Launcher]` log appears, attempts connection to `ws://127.0.0.1:3001/qq/ws` (fails because backend is not running — this is expected).

Press Ctrl+C to terminate.

- [ ] **Step 3: Verify backend preflight passes**

```bash
# Start backend
cd backend && npx tsx src/server.ts
```

Expected: `[QQ] Config loaded (disabled, adapter not auto-started)`

```bash
# In another terminal, test preflight via start API
curl -X POST http://localhost:3000/api/qq/start
```

Expected (if NapCat is deployed):
```json
{"success":true,"message":"QQ service started"}
```

- [ ] **Step 4: Verify frontend start/stop UX**

Open `http://localhost:5173`, click QQ Bot icon -> check status panel loads correctly.

- [ ] **Step 5: Final commit (if any corrections needed)**

```bash
git status
# If anything was missed, git add + commit
```

---

## Execution Order

```
Task 1 (.gitignore)
  -> Task 2 (commit napcat/ protected files)
        -> Task 3 (setup-napcat.ps1 rewrite)
              |--> Task 4 (napcat.bat fix)
              |--> Task 5 (server.ts fix)
              |--> Task 6 (QQBotCard.tsx fix)
                    -> Task 7 (E2E verification)
```

Tasks 3-6 can be implemented in parallel (different files). Task 7 must run after all others are complete.
