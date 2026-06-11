const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════
// NapCat Shell Launcher — 智能 wrapper.node 定位
// ═══════════════════════════════════════════════════════════════════════════

const BASE_DIR = __dirname;

// ── 日志工具 ──────────────────────────────────────────────────────────────
function log(level, msg) {
    console.log(`[NapCat Launcher] ${level}: ${msg}`);
}

// ── L1: napcat/ 目录下的 wrapper.node（自包含部署） ────────────────────────
function findWrapperNodeBundled() {
    const bundled = path.join(BASE_DIR, 'wrapper.node');
    if (fs.existsSync(bundled)) {
        log('L1 hit', 'bundled wrapper.node');
        return bundled;
    }
    return null;
}

// ── 探测 QQNT 安装根目录 ──────────────────────────────────────────────────
function findQQNTRoot() {
    // a) 注册表 (HKEY_LOCAL_MACHINE)
    try {
        const out = execSync(
            'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\QQ" /v UninstallString 2>nul',
            { encoding: 'utf8', timeout: 3000, windowsHide: true }
        );
        const match = out.match(/REG_SZ\s+(.+)/);
        if (match) {
            const qqDir = path.dirname(match[1].replace(/"/g, ''));
            if (fs.existsSync(path.join(qqDir, 'versions'))) {
                return qqDir;
            }
        }
    } catch { /* 注册表读取失败，继续尝试其他方式 */ }

    // b) 常见安装路径
    const commonPaths = [
        'C:\\Program Files\\Tencent\\QQNT',
        'C:\\Program Files (x86)\\Tencent\\QQNT',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'QQNT'),
    ];
    for (const p of commonPaths) {
        if (fs.existsSync(path.join(p, 'versions'))) {
            return p;
        }
    }

    return null;
}

// ── L2: 从 QQNT 安装目录匹配版本 → 定位 wrapper.node ─────────────────────
function findWrapperNodeFromQQNT() {
    const qqDir = findQQNTRoot();
    if (!qqDir) {
        log('L2 skip', 'QQNT installation not found');
        return null;
    }

    // 从 config.json 读取期望的 QQ 版本号
    let targetVersion = '';
    try {
        const cfgPath = path.join(BASE_DIR, 'config.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        targetVersion = cfg.curVersion || cfg.baseVersion || '';
    } catch { /* config.json 不存在或损坏 */ }

    const versionsDir = path.join(qqDir, 'versions');
    if (!fs.existsSync(versionsDir)) {
        log('L2 fail', `versions directory not found: ${versionsDir}`);
        return null;
    }

    const candidates = fs.readdirSync(versionsDir)
        .filter(d => /^\d+\.\d+\.\d+-\d+$/.test(d))
        .sort()
        .reverse();

    if (candidates.length === 0) {
        log('L2 fail', 'no version directories found');
        return null;
    }

    // 精确匹配期望版本
    if (targetVersion) {
        const exact = candidates.find(v => v === targetVersion);
        if (exact) {
            const wrapperPath = path.join(versionsDir, exact, 'resources', 'app', 'wrapper.node');
            if (fs.existsSync(wrapperPath)) {
                log('L2 hit', `QQNT exact match ${exact}`);
                return wrapperPath;
            }
        }
        log('L2 info', `exact version ${targetVersion} not found, falling back to latest`);
    }

    // 降级：使用最新可用版本
    for (const ver of candidates) {
        const wrapperPath = path.join(versionsDir, ver, 'resources', 'app', 'wrapper.node');
        if (fs.existsSync(wrapperPath)) {
            log('L2 hit', `QQNT latest match ${ver}`);
            return wrapperPath;
        }
    }

    log('L2 fail', 'wrapper.node not found in any version directory');
    return null;
}

// ── 主定位逻辑 ────────────────────────────────────────────────────────────
function findWrapperNode() {
    // L1: 自包含部署（推荐，setup-napcat.ps1 执行后生效）
    const bundled = findWrapperNodeBundled();
    if (bundled) return bundled;

    // L2: 自动探测本机 QQNT 安装
    const fromQQNT = findWrapperNodeFromQQNT();
    if (fromQQNT) return fromQQNT;

    // L3: 不设置 NAPCAT_WRAPPER_PATH，让 napcat.mjs 的 loadQQWrapper() fallback 自行处理
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════════════════
const WRAPPER_NODE_PATH = findWrapperNode();

if (WRAPPER_NODE_PATH) {
    process.env.NAPCAT_WRAPPER_PATH = WRAPPER_NODE_PATH;
    log('OK', `wrapper.node → ${WRAPPER_NODE_PATH}`);
} else {
    console.warn('[NapCat Launcher] ╔══════════════════════════════════════╗');
    console.warn('[NapCat Launcher] ║  ⚠ wrapper.node 未找到！           ║');
    console.warn('[NapCat Launcher] ║                                    ║');
    console.warn('[NapCat Launcher] ║  请先运行一键部署:                  ║');
    console.warn('[NapCat Launcher] ║  powershell -File scripts\\setup-napcat.ps1 ║');
    console.warn('[NapCat Launcher] ║                                    ║');
    console.warn('[NapCat Launcher] ║  或安装 QQNT 桌面版:               ║');
    console.warn('[NapCat Launcher] ║  https://im.qq.com                 ║');
    console.warn('[NapCat Launcher] ╚══════════════════════════════════════╝');
}

const PACKAGE_JSON_PATH = path.join(BASE_DIR, 'package.json');
const CONFIG_JSON_PATH  = path.join(BASE_DIR, 'config.json');
const NAPCAT_MJS_PATH   = path.join(BASE_DIR, 'napcat.mjs');

process.env.NAPCAT_QQ_PACKAGE_INFO_PATH   = PACKAGE_JSON_PATH;
process.env.NAPCAT_QQ_VERSION_CONFIG_PATH = CONFIG_JSON_PATH;
process.env.NAPCAT_DISABLE_PIPE           = '1';

import(pathToFileURL(NAPCAT_MJS_PATH).href);
