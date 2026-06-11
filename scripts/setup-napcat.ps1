<#
.SYNOPSIS
    NapCat QQ Shell self-contained deployment (official Node.zip)
.DESCRIPTION
    1. Download NapCat.Shell.Windows.Node.zip (self-contained: QQ + Node.js + NapCat)
    2. Extract to napcat/ directory
    3. Deploy config templates from config/napcat-templates/
    4. Verify deployment integrity
    napcat/ is fully self-contained after deployment.
    Config templates live in config/napcat-templates/ (git-tracked) and
    are copied to napcat/napcat/config/ at deploy time.
.PARAMETER Force
    Force re-download and re-extract all components
.PARAMETER NapCatVersion
    NapCat release version (default v4.18.6)
.EXAMPLE
    .\setup-napcat.ps1
    .\setup-napcat.ps1 -Force
    .\setup-napcat.ps1 -NapCatVersion "v4.20.0"
#>

param(
    [switch]$Force = $false,
    [string]$NapCatVersion = "v4.18.6"
)

$ErrorActionPreference = 'Stop'
$RootDir    = Resolve-Path (Join-Path $PSScriptRoot '..')
$NapCatDir  = Join-Path $RootDir 'napcat'
$TempDir    = Join-Path $env:TEMP 'napcat-setup'

# ============================================================================
# Helpers
# ============================================================================

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Text, [string]$Color = 'Cyan')
    Write-Host "[$Step/$Total] $Text" -ForegroundColor $Color
}

function Test-NapCatDeployed {
    $batFile = Join-Path $NapCatDir 'napcat.bat'
    return (Test-Path $batFile) -and (-not $Force)
}

# ============================================================================
# Step 1: Download NapCat.Shell.Windows.Node.zip
# ============================================================================
function Install-NapCatNode {
    Write-Step 1 4 'Downloading NapCat.Shell.Windows.Node.zip...' 'Cyan'

    if (Test-NapCatDeployed) {
        Write-Host "  napcat.bat already exists, skipping (use -Force to re-deploy)" -ForegroundColor Green
        return
    }

    # --Force: clear existing napcat/ for a clean re-deploy
    if ($Force -and (Test-Path $NapCatDir)) {
        Write-Host "  [--Force] Clearing existing napcat/..."
        Remove-Item $NapCatDir -Recurse -Force
        Write-Host "  [--Force] napcat/ cleared" -ForegroundColor Green
    }

    $zipFileName = "NapCat.Shell.Windows.Node.zip"
    $urls = @(
        "https://gh-proxy.com/https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/$zipFileName"
        "https://github.com/NapNeko/NapCatQQ/releases/download/$NapCatVersion/$zipFileName"
    )

    $zipFile = Join-Path $env:TEMP $zipFileName

    $downloaded = $false
    if (Test-Path $zipFile) {
        Write-Host "  Using cached: $zipFile" -ForegroundColor Green
        $downloaded = $true
    } else {
        foreach ($url in $urls) {
            try {
                Write-Host "  Trying: $url"
                $wc = New-Object System.Net.WebClient
                $wc.DownloadFile($url, $zipFile)
                $wc.Dispose()
                $downloaded = $true
                Write-Host "  Download OK ($([math]::Round((Get-Item $zipFile).Length/1MB, 1))MB)" -ForegroundColor Green
                break
            } catch {
                Write-Host "  Failed: $_" -ForegroundColor DarkYellow
            }
        }
    }

    if (-not $downloaded) {
        Write-Host "  Download failed. Manually download and extract to napcat/" -ForegroundColor Red
        Write-Host "  URL: $($urls[-1])"
        exit 1
    }

    # Extract to temp first, then move
    Write-Host "  Extracting to napcat/ (may take 1-2 minutes)..."
    New-Item -ItemType Directory -Path $NapCatDir -Force | Out-Null

    $extractTemp = Join-Path $env:TEMP 'napcat-extract'
    if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
    New-Item -ItemType Directory -Path $extractTemp -Force | Out-Null

    Expand-Archive -Path $zipFile -DestinationPath $extractTemp -Force

    # Node.zip may have a wrapping folder or files at root — handle both cases
    $items = Get-ChildItem $extractTemp -Force
    $hasWrappingFolder = ($items.Count -eq 1) -and $items[0].PSIsContainer

    if ($hasWrappingFolder) {
        # Flatten: copy contents of the wrapping folder
        $sourceDir = $items[0].FullName
        Write-Host "  Detected wrapping folder: $($items[0].Name) — flattening..."
        Get-ChildItem $sourceDir -Force | ForEach-Object {
            Move-Item $_.FullName $NapCatDir -Force
        }
    } else {
        # Files at root: move directly
        Get-ChildItem $extractTemp -Force | ForEach-Object {
            Move-Item $_.FullName $NapCatDir -Force
        }
    }

    Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "  Extraction complete" -ForegroundColor Green
}

# ============================================================================
# Step 2: Clean up unnecessary files
# ============================================================================
# Node.zip only ships Windows binaries — no Darwin/Linux native modules to clean.
# We keep a minimal cleanup for cache/log junk.
function Clear-JunkFiles {
    Write-Step 2 4 'Cleaning up junk files...' 'Cyan'
    Get-ChildItem (Join-Path $NapCatDir 'cache\*.png') -File -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem (Join-Path $NapCatDir '*.log') -File -ErrorAction SilentlyContinue | Remove-Item -Force
    Write-Host "  Clean" -ForegroundColor Green
}

# ============================================================================
# Step 3: Deploy config templates from git-tracked config/napcat-templates/
# ============================================================================
function Deploy-NapCatConfigTemplates {
    Write-Step 3 4 'Deploying config templates...' 'Cyan'

    $TemplateDir = Join-Path $RootDir 'config\napcat-templates'

    if (-not (Test-Path $TemplateDir)) {
        Write-Host "  ERROR: Template directory not found: $TemplateDir" -ForegroundColor Red
        Write-Host "  This should never happen - config/napcat-templates/ is git-tracked." -ForegroundColor Red
        exit 1
    }

    # In Node.zip, NapCat config lives at napcat/napcat/config/
    $TargetDir = Join-Path $NapCatDir 'napcat\config'
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

    $templates = @('onebot11.json', 'napcat.json', 'webui.json')
    foreach ($t in $templates) {
        $src = Join-Path $TemplateDir $t
        if (-not (Test-Path $src)) {
            Write-Host "  ERROR: Template missing: $t" -ForegroundColor Red
            exit 1
        }

        # Verify valid JSON before copying
        try {
            Get-Content $src -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
        } catch {
            Write-Host "  ERROR: Template is not valid JSON: $t" -ForegroundColor Red
            exit 1
        }

        Copy-Item $src $TargetDir -Force
        Write-Host "  [OK] $t -> napcat/napcat/config/" -ForegroundColor Green
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
# Step 4: Verify deployment integrity
# ============================================================================
function Test-Deployment {
    Write-Step 4 4 'Verifying deployment...' 'Cyan'

    # In Node.zip:
    #   napcat.bat              → root (spawn target)
    #   node/node.exe           → Node.js runtime
    #   napcat/napcat.mjs       → NapCat core
    #   napcat/config/          → config (overwritten by our templates above)
    $required = @(
        @{Path='napcat.bat';                        Label='Shell entry point';       Critical=$true},
        @{Path='node\node.exe';                     Label='Node.js runtime';          Critical=$true},
        @{Path='napcat\napcat.mjs';                 Label='NapCat core';              Critical=$true},
        @{Path='napcat\config\onebot11.json';       Label='OneBot config (deployed)'; Critical=$true}
    )

    $allOk = $true
    foreach ($r in $required) {
        $fullPath = Join-Path $NapCatDir $r.Path
        if (Test-Path $fullPath) {
            $size = ""
            if ((Get-Item $fullPath).PSIsContainer -eq $false) {
                $size = " ($([math]::Round((Get-Item $fullPath).Length/1KB, 1))KB)"
            }
            Write-Host "  [OK] $($r.Label) ($($r.Path))$size" -ForegroundColor Green
        } else {
            if ($r.Critical) {
                Write-Host "  [MISS] $($r.Label) ($($r.Path))" -ForegroundColor Red
                $allOk = $false
            } else {
                Write-Host "  [WARN] $($r.Label) (non-critical)" -ForegroundColor Yellow
            }
        }
    }

    # Validate onebot11.json WS client configuration
    $configPath = Join-Path $NapCatDir 'napcat\config\onebot11.json'
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $wsClients = $config.network.websocketClients
            if ($wsClients -and $wsClients.Count -gt 0) {
                foreach ($client in $wsClients) {
                    if ($client.url) {
                        Write-Host "  [OK] WS Client: $($client.name) -> $($client.url)" -ForegroundColor Green
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
Write-Host "  NapCat QQ Shell - Self-Contained Setup (4 steps)" -ForegroundColor Cyan
Write-Host "  Source: NapCat.Shell.Windows.Node.zip $NapCatVersion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    Install-NapCatNode
    Clear-JunkFiles
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
    Write-Host "  -> Server spawns: napcat/napcat.bat" -ForegroundColor Green
    Write-Host "  -> WebUI:        http://127.0.0.1:6099/webui" -ForegroundColor Green
    Write-Host "  -> The entire napcat/ dir can be copied to any Windows machine" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Deployment incomplete - check missing items above" -ForegroundColor Red
    Write-Host "  Re-run: .\setup-napcat.ps1 -Force" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
