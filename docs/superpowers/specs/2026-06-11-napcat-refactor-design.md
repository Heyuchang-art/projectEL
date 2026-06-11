# NapCat 部署重构设计 (NapCat Deployment Refactor)

> 状态: ✅ 已确认  
> 日期: 2026-06-11  
> 目标: 新仓库 clone 后一键部署 NapCat Shell 独立模式，无需安装 QQNT 桌面版

---

## 一、需求背景

当前 NapCat 集成存在四个痛点：

| # | 问题 | 根因 |
|:---|:---|:---|
| 1 | clone 后无法直接部署 | 二进制文件全部 gitignore，`wrapper.node` 依赖本机 QQNT 桌面版提取 |
| 2 | QQBotCard WebUI 无法启动 NapCat | `index.js`→`index.cjs` 重命名未完成提交，`napcat.bat` 找不到入口 |
| 3 | NapCat 原版复杂不兼容 | zip 含注入模式文件、多平台插件、旧版 hash chunk，与 Shell 独立模式冲突 |
| 4 | 部署流程脆弱 | 依赖注册表探测、版本严格匹配、GitHub 下载超时、编码问题 |

**设计目标：** `scripts/setup-napcat.ps1` 一键完成所有部署，无需 QQNT 桌面版、无需管理员权限、可重复运行。

---

## 二、架构概览

```
┌──────────────────────────────────────────────────┐
│                Snapshot Pi Backend                │
│                 server.ts (:3000)                 │
│                                                   │
│  POST /api/qq/start  ──→  preflightNapCat()      │
│                         ──→  initQQAdapter()      │
│                         ──→  spawnNapCat()        │
│                                                   │
│  QQWebSocketServer (:3001)  ←── OneBot v11 WS ───│
└──────────────────────┬───────────────────────────┘
                       │ ws://127.0.0.1:3001/qq/ws
┌──────────────────────▼───────────────────────────┐
│              NapCat Shell (独立模式)              │
│                                                   │
│  napcat.bat  →  node.exe  →  index.cjs           │
│                                   │               │
│                          NAPCAT_WRAPPER_PATH      │
│                                   │               │
│                              napcat.mjs           │
│                            (OneBot v11 客户端)     │
│                                   │               │
│                     wrapper.node  ←→  QQNT.dll    │
│                      (QQ 协议栈 + 原生插件)        │
└───────────────────────────────────────────────────┘
```

**原则：** NapCat 仅作为 OneBot v11 WebSocket 客户端，所有 AI/业务逻辑在 Snapshot Pi Backend 中。NapCat 本身不做定制修改（仅通过 `index.cjs` 设置环境变量）。

---

## 三、napcat/ 目录结构重构

### 3.1 目标结构

```
napcat/
├── napcat.bat              # ▲ Shell 入口 (GBK+CRLF, git 跟踪)
├── index.cjs               # ▲ 自定义启动器 (git 跟踪)
├── config.json             # ▲ QQ 版本伪装配置 (git 跟踪)
├── package.json            # ▲ QQ 伪装包信息 (git 跟踪)
│
├── node.exe                # △ setup 部署 (嵌入 Node.js ~77MB)
├── napcat.mjs              # △ setup 部署 (NapCat 核心 ~4.3MB)
├── wrapper.node            # △ setup 部署 (QQNT Wrapper ~93MB)
├── major.node              # △ setup 部署 (Node 原生模块 ~85MB)
├── QQNT.dll                # △ setup 部署 (QQNT 主 DLL ~206MB)
├── QBar.dll                # △ setup 部署
├── LightQuic.dll           # △ setup 部署
├── broadcast_ipc.dll       # △ setup 部署
├── libglib-2.0-0.dll       # △ setup 部署
├── libgobject-2.0-0.dll    # △ setup 部署
├── libvips-42.dll          # △ setup 部署
├── ncnn.dll                # △ setup 部署
├── opencv.dll              # △ setup 部署
├── avif_convert.dll        # △ setup 部署
│
├── config/                 # ▼ git 跟踪配置模板
│   ├── onebot11.json       # OneBot WS 客户端配置
│   ├── napcat.json         # NapCat 运行时配置
│   └── webui.json          # WebUI 配置
│
├── static/                 # △ setup 部署 (WebUI :6099)
├── plugins/                # △ setup 部署 (内置插件)
├── native/                 # △ setup 部署 (仅 win32-x64)
├── worker/                 # △ setup 部署
├── node_modules/           # △ setup 部署
├── KillQQ.bat              # ▲ 进程清理辅助 (git 跟踪)
│
├── cache/                  # ✗ gitignore (运行时)
├── logs/                   # ✗ gitignore (运行时)
├── config/napcat_*.json    # ✗ gitignore (账号绑定)
└── config/onebot11_*.json  # ✗ gitignore (账号绑定)
```

| 标记 | 含义 |
|:---|:---|
| ▲ | git 跟踪 — 项目自定义文件 |
| △ | setup 部署 — `setup-napcat.ps1` 下载/提取 |
| ▼ | git 跟踪 — 配置模板 |
| ✗ | gitignore — 运行时生成或账号绑定 |

### 3.2 删除的文件（不再部署）

- `NapCatWinBootMain.exe` / `NapCatWinBootHook.dll` / `loadNapCat.js` — 注入模式专用
- `launcher.bat` / `launcher-user.bat` / `launcher-win10.bat` / `launcher-win10-user.bat` — 注入模式启动脚本
- `quickLoginExample.bat` — 快速登录示例
- `native/**/*.darwin.*.node` / `native/**/*.linux.*.node` — 非 Windows 平台
- `static/assets/chunk-*-*.js` 未被 `index.html` 引用的旧版 hash — 死代码
- `conout-D9oph_Le.js` — 注入模式控制台输出
- `qqnt.json` — 注入模式配置

### 3.3 保留的受保护文件（不被 NapCat 官方包覆盖）

`setup-napcat.ps1` 的 `$ProtectedFiles` 列表：
```powershell
$ProtectedFiles = @(
    'napcat.bat',      # Shell 入口
    'index.cjs',       # 自定义启动器
    'config.json',     # 版本配置
    'package.json',    # QQ 伪装包
    'KillQQ.bat'       # 进程清理
)
```

---

## 四、最小化提取器部署流程

### 4.1 总流程

```
scripts/setup-napcat.ps1

Step 1 — 下载 NapCat Shell
  ├─ 检查 napcat/napcat.mjs 已存在 → 跳过
  ├─ 下载 NapCat.Shell.zip (~15MB)
  │   源 1 (优先): gh-proxy.com 代理
  │   源 2 (降级): github.com 直连
  └─ 解压 → 选择性复制 (跳过注入模式文件 + 受保护文件)

Step 2 — 最小化提取 wrapper.node + DLL
  ├─ 检查 napcat/wrapper.node 已存在 → 跳过
  ├─ 下载 QQNT 安装包 (~200MB NSIS installer)
  │   源: dldir1.qq.com (腾讯官方 CDN)
  ├─ 用 7za.exe 静默解压 NSIS 包到临时目录
  ├─ 扫描提取:
  │   wrapper.node    → napcat/
  │   major.node      → napcat/
  │   QQNT.dll        → napcat/
  │   QBar.dll        → napcat/
  │   LightQuic.dll   → napcat/
  │   broadcast_ipc.dll → napcat/
  │   libglib-2.0-0.dll → napcat/
  │   libgobject-2.0-0.dll → napcat/
  │   libvips-42.dll  → napcat/
  │   ncnn.dll        → napcat/
  │   opencv.dll      → napcat/
  │   avif_convert.dll → napcat/
  ├─ 更新 config.json (版本号 / buildId)
  └─ 清理: 临时目录 + QQNT 安装包

Step 3 — 清理非必要文件
  ├─ 删除非 Windows 平台插件
  ├─ 删除 static/assets/ 旧版 hash chunk
  └─ 删除 cache/*.png / *.log 等运行时垃圾

Step 4 — 验证完整性
  ├─ node.exe  (关键 — 缺失则阻止启动)
  ├─ wrapper.node (关键)
  ├─ napcat.mjs (关键)
  ├─ config/onebot11.json (关键 — JSON 内容验证)
  └─ napcat.bat / index.cjs (git 跟踪, 不需要验证)
```

### 4.2 关键设计决策

| 项 | 选择 | 理由 |
|:---|:---|:---|
| 提取工具 | `7za.exe` (7-Zip standalone) | 免安装单文件 ~700KB，NSIS 解压兼容性最好，按需下载 |
| QQNT 版本 | 固定 `config.json` 中的 `baseVersion` | 避免自动更新导致 `wrapper.node` API 不匹配 |
| 下载方式 | WebClient (.NET) + 进度条 | 比 `Invoke-WebRequest` 快 2-3× |
| 重复运行 | 检查文件→按需跳过 | `node.exe`/`wrapper.node`/`napcat.mjs` 任一缺失才触发对应步骤 |
| 用户配置保护 | `onebot11.json` 备份→部署→恢复 | 重复部署不覆盖用户 WS 连接配置 |
| 安装包清理 | 提取完成后立即删除 | QQNT 安装包 ~200MB，释放磁盘空间 |

### 4.3 编码规范（防止乱码）

| 文件 | 编码 | 换行符 | 原因 |
|:---|:---|:---|:---|
| `*.bat` | **GBK** (无 BOM) | **CRLF** | CMD 以系统 OEM 代码页读取，UTF-8 中文会乱码 |
| `*.ps1` | **UTF-8 BOM** | **CRLF** | PowerShell 需要 BOM 检测 UTF-8 |
| `*.cjs` / `*.mjs` | **UTF-8** (无 BOM) | **LF** | Node.js 标准 |
| `*.json` | **UTF-8** (无 BOM) | **LF** | BOM 会导致 NapCat JSON.parse 崩溃 |

---

## 五、QQBotCard 启停修复

### 5.1 启动链路

```
QQBotCard.tsx 点击 "▶ 启动"
  │ POST /api/qq/start
  │
  ▼
server.ts handler
  ├─ getQQServer() 已存在? → 返回 "已在运行中"
  ├─ qqConfig 不存在? → 返回 400 "未找到 qq-bot-config.json"
  │
  ├─ preflightNapCat()
  │   ├─ checks: node.exe / wrapper.node / napcat.mjs / config/onebot11.json
  │   ├─ BOM 清理: strip-bom.js
  │   ├─ 失败 → 返回 400 + 具体缺失文件 + 修复命令
  │   └─ 通过 ↓
  │
  ├─ initQQAdapter() → QQWebSocketServer :3001
  ├─ resetNapcatGuard()
  ├─ spawnNapCat() → napcat.bat → node.exe ./index.cjs → napcat.mjs
  │   ├─ exit code=0 → 正常退出
  │   ├─ exit code≠0 → 自动重启 (最多 3 次, 指数退避 5s/15s/30s)
  │   └─ 3 次都失败 → enabled=false + 通知前端
  │
  └─ 返回 { success: true }
```

### 5.2 三个断点修复

**断点 ① — napcat.bat 找不到入口文件**

- 问题：`napcat/index.js` 已删除，`index.cjs` 是 untracked 新文件，`napcat.bat` 仍引用旧路径
- 修复：
  - `napcat.bat` 内容更新为 `node.exe ./index.cjs %*`
  - `index.cjs` 加入 git 跟踪
  - 确保 `napcat.bat` 编码为 GBK+CRLF

**断点 ② — preflightNapCat() 路径与扁平化一致**

- 问题：老结构 `napcat/napcat/config/onebot11.json`，扁平化后 `napcat/config/onebot11.json`
- 修复：preflight 使用相对于 `napcat/` 的路径，与部署后实际结构对齐
- 预检列表：
  ```
  napcat/node.exe
  napcat/wrapper.node
  napcat/napcat.mjs
  napcat/config/onebot11.json
  ```

**断点 ③ — 前端错误提示不具体**

- 问题：QQBotCard 只显示通用 "启动失败" / "无法连接到后端"
- 修复：
  - 后端返回结构化错误：`{ success: false, error: "具体原因", hint: "修复命令" }`
  - 前端 `actionError` 直接展示后端返回的具体错误信息
  - 检测到缺失部署文件时，提示"请运行: powershell -File scripts\\setup-napcat.ps1"

### 5.3 停止链路

```
QQBotCard.tsx 点击 "■ 停止"
  │ POST /api/qq/stop
  │
  ▼
server.ts handler
  ├─ stopQQAdapter()
  │   ├─ QQWebSocketServer.close() — 关闭所有 WS 连接
  │   └─ HTTP server 关闭
  ├─ resetNapcatGuard() — 取消待执行的重启定时器
  ├─ taskkill /PID <napcat> /T /F — 终止 NapCat 进程树
  ├─ qqConfig.enabled = false → 写回 qq-bot-config.json
  └─ 返回 { success: true }
```

---

## 六、.gitignore 更新

```gitignore
# NapCat: 排除大型二进制文件（通过 setup-napcat.ps1 部署）
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

# NapCat: 排除运行时生成文件
napcat/cache/
napcat/logs/
napcat/*.db*
napcat/*.log
napcat/config/napcat_*.json
napcat/config/onebot11_*.json
napcat/config/napcat_protocol_*.json

# NapCat: 排除部署残留
napcat.zip
```

**git 跟踪的白名单（不会被 ignore 排除）：**
- `napcat/napcat.bat` — Shell 入口
- `napcat/index.cjs` — 自定义启动器（智能三级定位 wrapper.node）
- `napcat/config.json` — 版本伪装配置
- `napcat/package.json` — QQ 伪装包信息
- `napcat/KillQQ.bat` — 进程清理
- `napcat/config/onebot11.json` — OneBot 连接模板
- `napcat/config/napcat.json` — NapCat 运行时配置
- `napcat/config/webui.json` — WebUI 配置
- `napcat/LICENSE-APACHE-2.0.txt` — 许可证

---

## 七、错误处理矩阵

| 场景 | 检测方式 | 用户看到 | 修复指引 |
|:---|:---|:---|:---|
| `wrapper.node` 缺失 | `preflightNapCat()` | "缺少 QQNT Wrapper 原生模块" | `powershell -File scripts\\setup-napcat.ps1` |
| `node.exe` 缺失 | `preflightNapCat()` | "缺少 Node.js 运行时" | `powershell -File scripts\\setup-napcat.ps1` |
| `napcat.mjs` 缺失 | `preflightNapCat()` | "缺少 NapCat 核心程序" | `powershell -File scripts\\setup-napcat.ps1` |
| `onebot11.json` 无效 | `Test-OneBotConfig` | "OneBot 配置缺失/无效" | 检查 `napcat/config/onebot11.json` |
| NapCat 进程崩溃 | `proc.on('exit')` | 自动重启 (最多 3 次) | 查看 `napcat/logs/` |
| 3 次重启全失败 | `restartCount >= 3` | "NapCat 已连续崩溃 3 次" + 自动禁用 | 检查 `wrapper.node` 版本 + `config.json` |
| 端口 3001 被占用 | `httpServer.listen` error | WS 服务器启动失败 | 释放端口或修改配置 |
| NapCat JSON BOM 崩溃 | `strip-bom.js` (预检阶段) | 无感知，自动修复 | `strip-bom.js` 自动清理 |

---

## 八、测试验证清单

### 部署测试

- [ ] 全新 clone → `setup-napcat.ps1` → NapCat 启动成功
- [ ] 无 QQNT 桌面版的机器 → `setup-napcat.ps1` → 正常提取
- [ ] `setup-napcat.ps1` 重复运行 → 跳过已存在步骤
- [ ] `setup-napcat.ps1 --force` → 强制重新部署
- [ ] `onebot11.json` 用户配置在重新部署后保持不变
- [ ] 编码验证：`.bat` GBK+CRLF, `.ps1` UTF-8 BOM+CRLF

### 启动测试

- [ ] QQBotCard 点击 "启动" → preflight 通过 → NapCat 进程拉起
- [ ] `napcat.bat` 正确找到 `index.cjs` → `napcat.mjs` 加载
- [ ] NapCat 成功连接 `ws://127.0.0.1:3001/qq/ws`
- [ ] QQBotCard 显示 "在线" + 账号信息
- [ ] 扫码登录 QQ 后能正常收发消息

### 停止测试

- [ ] QQBotCard 点击 "停止" → WS 服务器关闭 → NapCat 进程终止
- [ ] `qq-bot-config.json` `enabled` 写回 `false`
- [ ] 再次点击 "启动" → 正常拉起

### 异常测试

- [ ] 缺失 `wrapper.node` → 显示具体错误 + 修复命令
- [ ] NapCat 进程异常退出 → 自动重启
- [ ] 连续崩溃 3 次 → 停止重启 + 显示诊断信息

---

## 九、实现范围边界

**本次重构包含：**
- ✅ `scripts/setup-napcat.ps1` 重写（最小化提取器）
- ✅ `napcat/` 目录结构重构 + `.gitignore` 更新
- ✅ `napcat.bat` / `index.cjs` 路径修复 + 编码修正
- ✅ `server.ts` preflight 路径对齐 + 错误信息结构化
- ✅ `QQBotCard.tsx` 错误展示优化
- ✅ `scripts/strip-bom.js` 保留并整合

**本次重构不包含：**
- ❌ `qq-adapter.ts` 重构（1204 行拆分） — 后续单独设计
- ❌ QQ Bot 功能变更 — 保持现有行为
- ❌ NapCat 源码修改 — 仅通过环境变量和配置适配
- ❌ Pi Agent / 知识库 / 前端布局等无关模块

---

*设计版本: 2026-06-11*
