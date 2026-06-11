# Snapshot Pi — Setup 脚本修复文档（历史）

> ⚠️ **历史文档** — 此文档记录 2026-06-11 之前的旧部署方案的修复。
> 新部署方案见:
> - [NapCat 部署指南](napcat-deployment.md)
> - [QQ Bot 架构文档](qq-bot-architecture.md)
> - [部署重设计 Spec](superpowers/specs/2026-06-11-napcat-deployment-redesign.md)
> - [Node.zip 迁移计划](superpowers/plans/2026-06-11-napcat-nodezip-deployment.md) — 2026-06-11: Shell.zip + QQNT 分离下载 → NapCat.Shell.Windows.Node.zip 自包含包

## 修复日期
2026-06-11（历史存档）

---

## 一、编码问题（乱码 + 命令解析错误）

### 问题描述
`setup.bat`、`start.bat`、`scripts/setup.bat` 中文乱码，或出现 `'exist' 不是内部或外部命令` 等碎片化错误。

### 根因

| 层次 | 问题 | 影响 |
|------|------|------|
| 编码 | `.bat` 文件使用 UTF-8 编码 | CMD 以系统 OEM 代码页 (CP936/GBK) 读取文件，UTF-8 中文字节被误读为 GBK → 乱码 |
| 换行符 | Write 工具保存为 LF (`\n`) | CMD 需要 CRLF (`\r\n`)，LF + GBK 多字节字符导致行解析错位，命令被截断 |
| `chcp 65001` | 只能改变控制台**输出**编码 | 无法改变 CMD **读取** .bat 文件时的编码（始终是 CP936） |
| `chcp 65001` | 仅在输出层面切换 | CMD 解析文件先于命令执行，此时 `chcp` 尚未生效 |

### 修复方案

| 文件 | 编码 | 换行符 | 备注 |
|------|------|--------|------|
| `setup.bat` | **GBK**（无 BOM） | **CRLF** | 移除 `chcp 65001` |
| `start.bat` | **GBK**（无 BOM） | **CRLF** | 移除 `chcp 65001` |
| `scripts/setup.bat` | **GBK**（无 BOM） | **CRLF** | 移除 `chcp 65001` |
| `scripts/setup-napcat.ps1` | **UTF-8 BOM** | **CRLF** | PowerShell 需要 BOM 检测 UTF-8 |

**关键认知**：
- `.bat` 文件在中文 Windows 上**必须**用 GBK 编码，`chcp 65001` 无法解决 CMD 读取阶段的问题
- `.ps1` 文件**必须**带 UTF-8 BOM，否则 Windows PowerShell 退化为 ANSI (GBK) 读取

---

## 二、NapCat 覆盖式更新缺陷

### 问题描述
重新运行 `setup.bat` 时，`onebot11.json` 用户配置可能被 NapCat 官方包覆盖；`--force` 清理不完整。

### 根因

| 缺陷 | 详情 |
|------|------|
| `onebot11.json` 未受保护 | `$ProtectedFiles` 只包含 `index.js`, `napcat.bat`, `launcher.bat`, `launcher-user.bat`。`Copy-NapCatCore` 合并子目录时会覆盖 `config/onebot11.json` |
| `--force` 有前置条件 | 原逻辑 `if exist "napcat\napcat\napcat.mjs"` 包裹清理代码，如果 `napcat.mjs` 不存在（部分损坏），`--force` 不清理残留文件 |
| `napcat.mjs` 重复放置 | NapCat.Shell.zip 根目录有一个 `napcat.mjs`（启动器），被错误复制到 `napcat/napcat.mjs`（正确位置是 `napcat/napcat/napcat.mjs`） |
| `package.json` buildVersion 赋值崩溃 | `ConvertFrom-Json` 返回的对象不允许直接添加**不存在**的属性（`buildVersion` 字段在原始 JSON 中不存在） |

### 修复方案

| 修复 | 位置 | 方法 |
|------|------|------|
| 保护 `onebot11.json` | `setup-napcat.ps1` Main | `Copy-NapCatCore` 前备份、后恢复 |
| `--force` 无条件清理 | `scripts/setup.bat` Step 4 | 移除 `if exist napcat.mjs` 前置条件 |
| 阻止根级 `napcat.mjs` | `setup-napcat.ps1` Copy-NapCatCore | 注入模式过滤正则增加 `napcat\.mjs` |
| 修复 `buildVersion` | `setup-napcat.ps1` Update-VersionConfigs | 用 `Add-Member -Force` 替代直接赋值 |

#### 修复代码片段

**onebot11.json 备份/恢复**（`setup-napcat.ps1`）：
```powershell
# 备份用户配置文件
$onebotConfigPath = Join-Path $NapCatDir 'napcat\napcat\config\onebot11.json'
if (Test-Path $onebotConfigPath) {
    $onebotBackup = Get-Content $onebotConfigPath -Raw -Encoding UTF8
}

Copy-NapCatCore -SourceDir $extractedDir

# 恢复用户配置文件
if ($onebotBackup) {
    $onebotBackup | Set-Content $onebotConfigPath -Encoding UTF8 -NoNewline
}
```

**`--force` 无条件清理**（`scripts/setup.bat`）：
```batch
:: 之前：if "%FORCE%"=="1" ( if exist "napcat\napcat\napcat.mjs" ( ... ) )
:: 修复后：
if "%FORCE%"=="1" (
    echo  [--force] 清理现有 NapCat 核心...
    if exist "napcat\napcat" rmdir /s /q "napcat\napcat" 2>nul
    if exist "napcat\wrapper.node" del /q "napcat\wrapper.node" 2>nul
    if exist "napcat\node.exe" del /q "napcat\node.exe" 2>nul
)
```

**`buildVersion` 安全赋值**（`setup-napcat.ps1`）：
```powershell
# 之前：$p.buildVersion = $BuildId  （属性不存在时崩溃）
# 修复后：
$p | Add-Member -MemberType NoteProperty -Name 'buildVersion' -Value $buildId -Force
```

---

## 三、NapCat 配置验证缺失

### 问题描述
`onebot11.json` 仅检查文件是否存在，不验证 JSON 结构和必需字段。

### 根因

| 缺陷 | 详情 |
|------|------|
| 仅文件存在性检查 | `setup.bat` Step 5 和 `Test-Deployment` 只做 `if exist` / `Test-Path` |
| 标记为非关键 | `Test-Deployment` 中 `Critical=$false`，缺失也不阻止部署 |
| 无 JSON 结构验证 | 不检查 `network.websocketClients` 是否存在 |
| 无连接配置验证 | 不检查 ws url、`enable` 标志、`token` |

### 修复方案

| 修复 | 位置 | 方法 |
|------|------|------|
| 新增 `Test-OneBotConfig` | `setup-napcat.ps1` | 验证 JSON 有效性、`websocketClients`、`url`、`token` |
| 标记为关键 | `setup-napcat.ps1` Test-Deployment | `Critical=$true` |
| 批处理层验证 | `scripts/setup.bat` Step 5 | PowerShell 一行验证 `websocketClients` 存在 |

#### 验证内容

```
[验证] 检查 OneBot 配置有效性...
  ✓ WebSocket: Snapshot Pi → ws://127.0.0.1:3001/qq/ws
  ✓ access token 已设置
```

验证项：
- `onebot11.json` 文件存在
- JSON 可解析
- `network.websocketClients` 数组非空
- 每个客户端有 `url` 字段
- `enable` 状态
- `token` 是否设置（建议但非强制）

---

## 四、下载性能问题

### 问题描述
NapCat.Shell.zip 下载无进度、超时太短、无断点续传。

### 当前实现

```powershell
Invoke-WebRequest -Uri $url -OutFile $ZipFile -TimeoutSec 120
```

### 问题

| 问题 | 影响 |
|------|------|
| `Invoke-WebRequest` 性能差 | 比 curl/WebClient 慢 2-3 倍，缓冲整个响应 |
| 超时 120s | NapCat.Shell.zip 约 50-150MB，国内网络 120s 不够 |
| 无进度条 | 下载时完全黑屏，用户无法判断状态 |
| 无断点续传 | 中断后从头重试 |
| `gh-proxy.com` 先行 | 代理可能限速或过载 |

### 建议修复（待实现）

```powershell
# 使用 WebClient 替代 Invoke-WebRequest（更快，支持进度回调）
$wc = New-Object System.Net.WebClient
$wc.DownloadFile($url, $ZipFile)

# 增加超时和进度显示
# 可选：使用 curl.exe（Windows 10+ 自带）作为备选
```

---

## 五、修改文件清单

| 文件 | 修改项 |
|------|--------|
| `setup.bat` | GBK 编码 + CRLF + 中文消息 |
| `start.bat` | GBK 编码 + CRLF + 中文消息 |
| `scripts/setup.bat` | GBK 编码 + CRLF + 中文消息 + `--force` 无条件清理 + Step 5 `onebot11.json` 内容验证 |
| `scripts/setup-napcat.ps1` | UTF-8 BOM + CRLF + `onebot11.json` 备份恢复 + `Test-OneBotConfig` 函数 + `buildVersion` Add-Member 修复 + `onebot11.json` Critical + 根级 `napcat.mjs` 过滤 |

---

## 六、验证清单

- [ ] `chcp` 命令 → 显示"活动代码页: 936"
- [ ] `setup.bat` 中文正常显示
- [ ] `start.bat` 中文正常显示
- [ ] `setup.bat --force` 无条件清理 NapCat 残留
- [ ] `onebot11.json` 在重新部署后保持不变
- [ ] 缺少 `onebot11.json` 时报配置缺失
- [ ] `onebot11.json` 无效 JSON 时报解析失败
- [ ] `onebot11.json` 缺少 `websocketClients` 时报配置不完整
- [ ] `package.json` buildVersion 更新不再崩溃
- [ ] 根级 `napcat.mjs` 不再出现
