import { createAgentSession, SessionManager, DefaultResourceLoader, AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { compileWorkflowToSkill } from "./compiler.js";
import { KnowledgeBaseService } from "./knowledge-base/knowledge-base-service.js";
import { createKnowledgeRoutes } from "./knowledge-base/knowledge-routes.js";
import { buildAgentKnowledgeContext } from "./knowledge-base/agent-context.js";
import { createWikiRoutes } from "./wiki-manager.js";
import { getQQServer, initQQAdapter, stopQQAdapter } from "./qq-adapter.js";
import { ReportGenerator } from "./qq-report-generator.js";
import { getQQLogger } from "./qq-logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// workspaceCwd 指向 Snapshot Pi 的根目录
const workspaceCwd = path.resolve(__dirname, "../../");
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // 确保项目本地的技能与扩展工作区目录存在
  await fs.ensureDir(path.join(workspaceCwd, "skills"));
  await fs.ensureDir(path.join(workspaceCwd, ".pi", "skills"));
  await fs.ensureDir(path.join(workspaceCwd, ".pi", "extensions"));

  // 将我们的开发扩展及依赖的编译器复制到 .pi/extensions 目录下，以便 Pi 底层加载器自动发现并运行
  const extSource = path.resolve(__dirname, "study-agent-extension.ts");
  const extDest = path.join(workspaceCwd, ".pi", "extensions", "study-agent-extension.ts");
  await fs.copy(extSource, extDest);

  const compilerSource = path.resolve(__dirname, "compiler.ts");
  const compilerDest = path.join(workspaceCwd, ".pi", "extensions", "compiler.ts");
  await fs.copy(compilerSource, compilerDest);

  // 初始化 Pi 资源加载器 (加载本地的 skills, prompts, 扩展等)
  const loader = new DefaultResourceLoader({
    cwd: workspaceCwd,
    agentDir: path.join(workspaceCwd, ".pi", "agent"), // 使用本地的 agentDir
    additionalExtensionPaths: [extDest]
  });
  await loader.reload();

  // 初始化项目本地的 API key 存储与模型列表
  const authStoragePath = path.join(workspaceCwd, ".pi", "auth.json");
  const modelsJsonPath = path.join(workspaceCwd, ".pi", "models.json");

  const authStorage = AuthStorage.create(authStoragePath);
  const modelRegistry = ModelRegistry.create(authStorage, modelsJsonPath);

  // 多会话与预设管理器
  const sessions = new Map<string, any>();
  const sessionPresets = new Map<string, string>();

  // 查找一个本地已配置 API key 的可用模型作为保底
  function getConfiguredFallbackModel(): any {
    const allModels = modelRegistry.getAll();
    for (const m of allModels) {
      const authStatus = modelRegistry.getProviderAuthStatus(m.provider);
      if (authStatus.configured || !!authStatus.source) {
        return m;
      }
    }
    return allModels[0];
  }

  // 加载 JSONL 文件的辅助函数
  async function loadEntriesFromFile(filePath: string) {
    if (!(await fs.pathExists(filePath))) return [];
    try {
      const content = await fs.readFile(filePath, "utf8");
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async function getOrCreateSession(sessionId: string, presetId?: string): Promise<any> {
    if (sessions.has(sessionId)) {
      return sessions.get(sessionId)!;
    }

    const sessionDir = path.join(workspaceCwd, ".pi", "agent", "sessions");
    await fs.ensureDir(sessionDir);

    const files = await fs.readdir(sessionDir);
    const sessionFile = files.find(f => f.endsWith(`_${sessionId}.jsonl`));

    let sessionManager: SessionManager;
    if (sessionFile) {
      sessionManager = SessionManager.open(path.join(sessionDir, sessionFile), sessionDir, workspaceCwd);
    } else {
      sessionManager = SessionManager.create(workspaceCwd, sessionDir);
      sessionManager.newSession({ id: sessionId });
    }

    if (presetId) {
      sessionManager.appendCustomEntry("preset", { presetId });
      sessionPresets.set(sessionId, presetId);
    } else {
      const entries = sessionManager.getEntries();
      const presetEntry = entries.find((e: any) => e.type === "custom" && e.customType === "preset");
      if (presetEntry) {
        sessionPresets.set(sessionId, (presetEntry as any).data?.presetId);
      }
    }

    const { session } = await createAgentSession({
      cwd: workspaceCwd,
      resourceLoader: loader,
      authStorage,
      modelRegistry,
      sessionManager
    });

    session.subscribe((event) => {
      io.to(sessionId).emit("pi-event", event);
    });

    const activePresetId = sessionPresets.get(sessionId);
    if (activePresetId && !sessionFile) {
      const presetsPath = path.join(workspaceCwd, "skills", "agent-presets.json");
      if (await fs.pathExists(presetsPath)) {
        const presets = await fs.readJson(presetsPath);
        const preset = presets.find((p: any) => p.id === activePresetId);
        if (preset && preset.modelConfig) {
          const { provider, modelId, thinkingLevel } = preset.modelConfig;
          let model = modelRegistry.find(provider, modelId);

          // 检查该模型是否已配置凭证，否则采用已配置的可用模型作为保底
          let isConfigured = false;
          if (model) {
            const authStatus = modelRegistry.getProviderAuthStatus(model.provider);
            isConfigured = authStatus.configured || !!authStatus.source;
            console.log(`[Session Preset] Model ${provider}/${modelId} configured:`, isConfigured, 'authStatus:', JSON.stringify(authStatus));
          } else {
            console.log(`[Session Preset] Model ${provider}/${modelId} not found in registry`);
          }

          if (!model || !isConfigured) {
            const previousModel = model;
            model = getConfiguredFallbackModel();
            console.log(`[Session Preset] Falling back from ${previousModel?.provider}/${previousModel?.id} to ${model?.provider}/${model?.id}`);
          }

          if (model) {
            try {
              await session.setModel(model);
              console.log(`[Session Preset] setModel succeeded: ${model.provider}/${model.id}, session.model now: ${session.model?.provider}/${session.model?.id}`);
            } catch (err) {
              console.error(`Failed to set model ${model.provider}/${model.id} for preset:`, err);
            }
            // 独立设置思考等级，不受 setModel 失败影响
            if (thinkingLevel && thinkingLevel !== "off") {
              try {
                await session.setThinkingLevel(thinkingLevel);
              } catch (err) {
                console.error(`Failed to set thinkingLevel "${thinkingLevel}" for preset, trying fallback "low"...`, err);
                try {
                  await session.setThinkingLevel("low");
                } catch (fallbackErr) {
                  console.error(`Fallback thinkingLevel "low" also failed:`, fallbackErr);
                }
              }
            }
          }
        }
      }
    }

    // 检查该会话当前模型是否已配置凭证，否则采用已配置的可用模型作为保底
    if (!session.model) {
      const fallback = getConfiguredFallbackModel();
      console.log(`[Session FinalCheck] No model found for session ${sessionId}, setting fallback to ${fallback?.provider}/${fallback?.id}`);
      if (fallback) {
        try {
          await session.setModel(fallback);
        } catch (err) {
          console.error(`Failed to set fallback model for session ${sessionId}:`, err);
        }
      }
    } else {
      const authStatus = modelRegistry.getProviderAuthStatus(session.model.provider);
      const isConfigured = authStatus.configured || !!authStatus.source;
      console.log(`[Session FinalCheck] session.model=${session.model.provider}/${session.model.id}, configured=${isConfigured}, authStatus:`, JSON.stringify(authStatus));
      if (!isConfigured) {
        const fallback = getConfiguredFallbackModel();
        console.log(`[Session FinalCheck] Falling back to ${fallback?.provider}/${fallback?.id}`);
        if (fallback) {
          try {
            await session.setModel(fallback);
            console.log(`[Session FinalCheck] setModel succeeded: ${fallback.provider}/${fallback.id}, session.model now: ${session.model?.provider}/${session.model?.id}`);
          } catch (err) {
            console.error(`Failed to set fallback model for session ${sessionId}:`, err);
          }
        }
      }
    }

    sessions.set(sessionId, session);
    return session;
  }

  // 初始化第一个默认会话，确保有个保底
  const defaultSessionId = "default-session";
  await getOrCreateSession(defaultSessionId);

  // 初始化知识库模块
  const kbService = new KnowledgeBaseService(workspaceCwd);
  
  // 运行旧布局自动迁移到 knowledge_bases/default
  await kbService.migrateOldPaths();
  
  // 初始化激活库状态文件以供 Agent 使用（如果已有则沿用上次选择，否则初始化为 default）
  const activeKbPath = path.join(workspaceCwd, '.pi', 'active_kb.json');
  await fs.ensureDir(path.dirname(activeKbPath));
  if (await fs.pathExists(activeKbPath)) {
    try {
      const saved = await fs.readJson(activeKbPath);
      if (saved.activeKbId && typeof saved.activeKbId === 'string') {
        kbService.activeKbId = saved.activeKbId;
      }
    } catch {
      // 文件损坏则回退到 default
      await fs.writeJson(activeKbPath, { activeKbId: 'default' }, { spaces: 2 });
    }
  } else {
    await fs.writeJson(activeKbPath, { activeKbId: 'default' }, { spaces: 2 });
  }
  
  await kbService.ensureDirectories();
  const kbRouter = createKnowledgeRoutes(() => kbService, io);
  app.use('/api/knowledge', kbRouter);

  const wikiRouter = createWikiRoutes(() => kbService, io);
  app.use('/api/wiki', wikiRouter);

  // ── 迁移遗留的根目录 inbox/qq-logs 到记忆库中 ──────────────────────
  const oldInboxQQLogs = path.join(workspaceCwd, 'inbox', 'qq-logs');
  const newInboxQQLogs = path.join(kbService.inboxDir, 'qq-logs');
  if (await fs.pathExists(oldInboxQQLogs)) {
    await fs.ensureDir(newInboxQQLogs);
    const oldLogFiles = await fs.readdir(oldInboxQQLogs);
    for (const file of oldLogFiles) {
      const src = path.join(oldInboxQQLogs, file);
      const dest = path.join(newInboxQQLogs, file);
      if (await fs.pathExists(dest)) {
        // 合并 JSONL 日志：将旧文件内容追加到新文件末尾
        const oldContent = await fs.readFile(src, 'utf-8');
        if (oldContent.trim()) {
          await fs.appendFile(dest, '\n' + oldContent.trim() + '\n', 'utf-8');
        }
      } else {
        await fs.move(src, dest);
      }
    }
    // 清理旧目录
    await fs.remove(path.join(workspaceCwd, 'inbox'));
    console.log('[KB Migration] Migrated root inbox/qq-logs into memory library.');
  }

  // ── QQ Bot ──────────────────────────────────────────────────────────

  interface NapCatGuardState {
    process: ChildProcess | null;
    restartCount: number;
    restartTimer: ReturnType<typeof setTimeout> | null;
  }

  const MAX_NAPCAT_RESTART = 3;
  const NAPCAT_RESTART_BACKOFF = [5_000, 15_000, 30_000]; // 5s, 15s, 30s 指数退避

  const napcatGuard: NapCatGuardState = {
    process: null,
    restartCount: 0,
    restartTimer: null,
  };

  let qqConfig: any = null;
  const qqConfigPath = path.join(workspaceCwd, 'config', 'qq-bot-config.json');

  if (await fs.pathExists(qqConfigPath)) {
    qqConfig = await fs.readJson(qqConfigPath);
    if (qqConfig.enabled) {
      initQQAdapter(httpServer, getOrCreateSession, io, qqConfig, kbService);
      console.log('[QQ] Config loaded and adapter auto-started');
    } else {
      console.log('[QQ] Config loaded (disabled, adapter not auto-started)');
    }
  }

  // 将 QQ 日志器重定向到记忆库的 inbox 目录中，使日志与知识库储存在一起
  const qqLogger = getQQLogger(workspaceCwd);
  qqLogger.setLogDir(path.join(kbService.inboxDir, 'qq-logs'));

  const reportGen = new ReportGenerator(kbService, workspaceCwd);

  // ── NapCat Preflight ─────────────────────────────────────────────────
  async function preflightNapCat(): Promise<{ ok: boolean; error?: string; hint?: string }> {
    const dir = path.join(workspaceCwd, 'napcat');
    const setupCmd = 'powershell -File scripts\\setup-napcat.ps1';

    const checks = [
      { file: 'node.exe',                                    label: 'Node.js runtime' },
      { file: 'wrapper.node',                                label: 'QQNT Wrapper module' },
      { file: path.join('napcat', 'napcat.mjs'),             label: 'NapCat core' },
      { file: path.join('napcat', 'config', 'onebot11.json'), label: 'OneBot config' },
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

    // Note: BOM cleanup no longer needed — config templates are clean UTF-8 without BOM.
    // strip-bom.js is kept under scripts/ for other use cases.
    return { ok: true };
  }

  // ── NapCat 进程守护 ────────────────────────────────────────────────
  function resetNapcatGuard() {
    napcatGuard.restartCount = 0;
    if (napcatGuard.restartTimer) {
      clearTimeout(napcatGuard.restartTimer);
      napcatGuard.restartTimer = null;
    }
  }

  function spawnNapCat(): ChildProcess {
    const napcatScriptRel = qqConfig?.napcat?.path || 'napcat/napcat.bat';
    const napcatScript = path.join(workspaceCwd, napcatScriptRel);

    if (!fs.existsSync(napcatScript)) {
      const msg =
        `NapCat 启动脚本不存在: ${napcatScriptRel}\n` +
        `请先运行部署: scripts\\setup.bat`;
      console.error(`[QQ] ${msg}`);
      throw new Error(msg);
    }

    const napcatDir = path.dirname(napcatScript);
    const proc = spawn(napcatScript, [], {
      cwd: napcatDir,
      shell: true,
      stdio: 'pipe',
    });

    proc.stdout?.on('data', (d: Buffer) => {
      for (const line of d.toString().split('\n').filter(Boolean)) {
        if (line.includes('[error]') || line.includes('[ERROR]')) {
          console.error(`[NapCat] ${line}`);
        } else if (line.includes('[warn]') || line.includes('[WARN]')) {
          console.warn(`[NapCat] ${line}`);
        }
      }
    });

    proc.stderr?.on('data', (d: Buffer) => {
      console.error(`[NapCat:stderr] ${d.toString().trim()}`);
    });

    proc.on('exit', (code, signal) => {
      console.log(`[QQ] NapCat 进程退出 (code=${code}, signal=${signal})`);

      // 用户主动停止
      if (!qqConfig?.enabled) {
        console.log('[QQ] QQ Bot 已禁用，不自动重启');
        return;
      }

      // 正常退出（code 0）
      if (code === 0) return;

      // 异常退出 → 自动重启
      if (napcatGuard.restartCount >= MAX_NAPCAT_RESTART) {
        console.error(
          `[QQ] NapCat 已连续崩溃 ${MAX_NAPCAT_RESTART} 次，停止自动重启。\n` +
          `  请检查: 1) wrapper.node 版本是否匹配  2) QQNT 版本配置是否正确\n` +
          `  修复后可通过 WebUI 重新启动。`
        );
        // 标记为禁用，防止下次自动启动
        qqConfig.enabled = false;
        fs.writeJson(qqConfigPath, qqConfig, { spaces: 2 }).catch(() => {});
        return;
      }

      const delay = NAPCAT_RESTART_BACKOFF[napcatGuard.restartCount];
      console.warn(
        `[QQ] NapCat 异常退出，${delay / 1000}s 后进行第 ` +
        `${napcatGuard.restartCount + 1}/${MAX_NAPCAT_RESTART} 次自动重启...`
      );
      napcatGuard.restartTimer = setTimeout(() => {
        napcatGuard.restartCount++;
        napcatGuard.process = spawnNapCat();
      }, delay);
    });

    return proc;
  }

  // QQ 状态（始终可用）
  app.get('/api/qq/status', (_req, res) => {
    const server = getQQServer();
    if (!server) {
      return res.json({ initialized: false, running: false, accounts: [] });
    }
    res.json({ initialized: true, running: true, ...server.getStatus() });
  });

  // 健康检查
  app.get('/api/qq/health', (_req, res) => {
    const server = getQQServer();
    const status = server ? server.getStatus() : { accounts: [] };
    const online = status.accounts.some((a: any) => a.online);
    res.json({
      status: online ? 'healthy' : 'degraded',
      accounts: status.accounts.length,
      online: status.accounts.filter((a: any) => a.online).length,
      uptime: process.uptime(),
    });
  });

  // 启动 QQ 服务
  app.post('/api/qq/start', async (_req, res) => {
    try {
      if (getQQServer()) {
        return res.json({ success: true, message: 'QQ 服务已在运行中' });
      }

      if (!qqConfig) {
        return res.status(400).json({ success: false, error: '未找到 config/qq-bot-config.json 配置文件' });
      }

      // 预检：确保 NapCat 运行环境完整
      const preflight = await preflightNapCat();
      if (!preflight.ok) {
        return res.status(400).json({ success: false, error: preflight.error, hint: preflight.hint });
      }

      // 初始化 QQ WebSocket 适配器（监听端口 3001）
      initQQAdapter(httpServer, getOrCreateSession, io, qqConfig, kbService);

      // 启动 NapCat Shell（独立模式，无需 QQ.exe 和管理员权限）
      resetNapcatGuard();
      napcatGuard.process = spawnNapCat();
      console.log('[QQ] NapCat 已启动 (Shell standalone mode)');

      // 写配置 enabled: true
      qqConfig.enabled = true;
      await fs.writeJson(qqConfigPath, qqConfig, { spaces: 2 });

      res.json({ success: true, message: 'QQ 服务已启动' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 停止 QQ 服务
  app.post('/api/qq/stop', async (_req, res) => {
    try {
      stopQQAdapter();
      resetNapcatGuard();

      if (napcatGuard.process?.pid) {
        try {
          spawn('taskkill', ['/PID', String(napcatGuard.process.pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {
          // 忽略 kill 错误
        }
        napcatGuard.process = null;
      }

      // 写配置 enabled: false
      if (qqConfig) {
        qqConfig.enabled = false;
        await fs.writeJson(qqConfigPath, qqConfig, { spaces: 2 });
      }

      console.log('[QQ] NapCat 已停止');
      res.json({ success: true, message: 'QQ 服务已停止' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 运营周报
  app.get('/api/qq/report/weekly', async (req, res) => {
    try {
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
      const report = await reportGen.generateWeeklyReport(groupId);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 运营周报 QQ 纯文本格式
  app.get('/api/qq/report/weekly/text', async (req, res) => {
    try {
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
      const report = await reportGen.generateWeeklyReport(groupId);
      res.type('text/plain').send(reportGen.formatReportForQQ(report, groupId));
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // ----------------- HTTP 会话路由 -----------------

  // 1. 列出所有会话
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessionDir = path.join(workspaceCwd, ".pi", "agent", "sessions");
      await fs.ensureDir(sessionDir);
      const list = await SessionManager.list(workspaceCwd, sessionDir);

      const presetsPath = path.join(workspaceCwd, "skills", "agent-presets.json");
      const presets = (await fs.pathExists(presetsPath)) ? await fs.readJson(presetsPath) : [];

      const results = await Promise.all(
        list.map(async (info) => {
          const entries = await loadEntriesFromFile(info.path);
          const presetEntry = entries.find((e: any) => e.type === "custom" && e.customType === "preset");
          const presetId = presetEntry ? presetEntry.data?.presetId : undefined;
          const preset = presets.find((p: any) => p.id === presetId);

          return {
            id: info.id,
            name: info.name || info.firstMessage || "(新会话)",
            firstMessage: info.firstMessage,
            createdAt: info.created,
            modifiedAt: info.modified,
            messageCount: info.messageCount,
            preset: preset ? { id: preset.id, name: preset.name } : null
          };
        })
      );

      // Merge active in-memory sessions that are not yet persisted on disk
      const activeSessionIds = Array.from(sessions.keys());
      for (const sId of activeSessionIds) {
        if (!results.some((r) => r.id === sId)) {
          const s = sessions.get(sId);
          if (s && s.sessionManager) {
            let firstMessage = "";
            let messageCount = 0;
            const entries = s.sessionManager.getEntries() || [];
            for (const entry of entries) {
              if (entry.type === "message") {
                messageCount++;
                const msg = entry.message;
                if (msg && (msg.role === "user" || msg.role === "assistant")) {
                  let text = "";
                  if (typeof msg.content === "string") {
                    text = msg.content;
                  } else if (Array.isArray(msg.content)) {
                    text = msg.content.map((c: any) => c.text || "").join("");
                  }
                  if (text && !firstMessage && msg.role === "user") {
                    firstMessage = text;
                  }
                }
              }
            }

            const header = s.sessionManager.getHeader();
            const created = header?.timestamp ? new Date(header.timestamp) : new Date();
            const sName = s.sessionManager.getSessionName();
            const presetId = sessionPresets.get(sId);
            const preset = presets.find((p: any) => p.id === presetId);

            results.push({
              id: sId,
              name: sName || firstMessage || "(新会话)",
              firstMessage: firstMessage || "(无消息)",
              createdAt: created,
              modifiedAt: new Date(),
              messageCount: messageCount,
              preset: preset ? { id: preset.id, name: preset.name } : null
            });
          }
        }
      }

      // Sort sessions by modifiedAt date descending
      results.sort((a, b) => {
        const timeA = new Date(a.modifiedAt).getTime();
        const timeB = new Date(b.modifiedAt).getTime();
        return timeB - timeA;
      });

      res.json({ sessions: results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. 新建会话
  app.post("/api/sessions/create", async (req, res) => {
    const { presetId, sessionId, name } = req.body;
    const sId = sessionId || randomUUID();
    if (name && name.length > 100) {
      return res.status(400).json({ error: "会话名称不能超过100个字符" });
    }
    try {
      const session = await getOrCreateSession(sId, presetId);
      if (name && name.trim()) {
        session.sessionManager.appendSessionInfo(name.trim());
      }
      res.json({
        success: true,
        sessionId: sId,
        presetId,
        model: session.model?.id,
        thinkingLevel: session.thinkingLevel
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. 切换会话
  app.post("/api/sessions/switch", async (req, res) => {
    const { sessionId } = req.body;
    try {
      const session = await getOrCreateSession(sessionId);
      res.json({
        success: true,
        sessionId,
        model: session.model?.id,
        thinkingLevel: session.thinkingLevel
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. 删除会话
  app.delete("/api/sessions/:id", async (req, res) => {
    const sessionId = req.params.id;
    if (sessionId === "default-session") {
      return res.status(400).json({ error: "不能删除默认会话" });
    }
    try {
      if (sessions.has(sessionId)) {
        const s = sessions.get(sessionId)!;
        await s.abort();
        s.dispose();
        sessions.delete(sessionId);
      }
      sessionPresets.delete(sessionId);

      const sessionDir = path.join(workspaceCwd, ".pi", "agent", "sessions");
      const files = (await fs.pathExists(sessionDir)) ? await fs.readdir(sessionDir) : [];
      const sessionFile = files.find(f => f.endsWith(`_${sessionId}.jsonl`));
      if (sessionFile) {
        await fs.remove(path.join(sessionDir, sessionFile));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 重命名会话
  app.put("/api/sessions/:id/rename", async (req, res) => {
    const sessionId = req.params.id;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "名称不能为空" });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: "会话名称不能超过100个字符" });
    }
    try {
      // Ensure session is loaded (may be on disk but not in memory)
      const session = await getOrCreateSession(sessionId);
      session.sessionManager.appendSessionInfo(name.trim());
      res.json({ success: true, sessionId, name: name.trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- HTTP 智能体预设路由 -----------------

  // 获取所有预设
  app.get("/api/agents", async (req, res) => {
    try {
      const presetsPath = path.join(workspaceCwd, "skills", "agent-presets.json");
      const presets = (await fs.pathExists(presetsPath)) ? await fs.readJson(presetsPath) : [];
      res.json({ presets });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 新建预设
  app.post("/api/agents", async (req, res) => {
    try {
      const presetsPath = path.join(workspaceCwd, "skills", "agent-presets.json");
      const presets = (await fs.pathExists(presetsPath)) ? await fs.readJson(presetsPath) : [];
      
      const presetData = { ...req.body };
      if (!presetData.modelConfig || !presetData.modelConfig.provider || !presetData.modelConfig.modelId) {
        const fallback = getConfiguredFallbackModel();
        if (fallback) {
          presetData.modelConfig = {
            provider: fallback.provider,
            modelId: fallback.id,
            thinkingLevel: presetData.modelConfig?.thinkingLevel || "off"
          };
        }
      }

      const newPreset = { id: randomUUID().slice(0, 8), ...presetData };
      presets.push(newPreset);
      await fs.outputJson(presetsPath, presets, { spaces: 2 });
      res.json({ success: true, preset: newPreset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 更新预设
  app.put("/api/agents/:id", async (req, res) => {
    try {
      const presetsPath = path.join(workspaceCwd, "skills", "agent-presets.json");
      let presets = (await fs.pathExists(presetsPath)) ? await fs.readJson(presetsPath) : [];
      const index = presets.findIndex((p: any) => p.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: "Preset not found" });
      }

      const presetData = { ...req.body };
      if (!presetData.modelConfig || !presetData.modelConfig.provider || !presetData.modelConfig.modelId) {
        const fallback = getConfiguredFallbackModel();
        if (fallback) {
          presetData.modelConfig = {
            provider: fallback.provider,
            modelId: fallback.id,
            thinkingLevel: presetData.modelConfig?.thinkingLevel || "off"
          };
        }
      }

      presets[index] = { ...presets[index], ...presetData, id: req.params.id };
      await fs.outputJson(presetsPath, presets, { spaces: 2 });
      res.json({ success: true, preset: presets[index] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 删除预设
  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const presetsPath = path.join(workspaceCwd, "skills", "agent-presets.json");
      let presets = (await fs.pathExists(presetsPath)) ? await fs.readJson(presetsPath) : [];
      presets = presets.filter((p: any) => p.id !== req.params.id);
      await fs.outputJson(presetsPath, presets, { spaces: 2 });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------- HTTP 技能与模型路由 -----------------

  // 获取所有已保存的可视化工作流
  app.get("/api/workflows", async (_req, res) => {
    try {
      const skillsDir = path.join(workspaceCwd, "skills");
      const entries = await fs.readdir(skillsDir).catch(() => []);
      const workflows = [];

      for (const entry of entries) {
        const workflowPath = path.join(skillsDir, entry, "workflow.json");
        if (!await fs.pathExists(workflowPath)) continue;
        try {
          const workflow = await fs.readJson(workflowPath);
          workflows.push({
            id: workflow.id || entry,
            name: workflow.name || entry,
            description: workflow.description || "",
            nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
            edgeCount: Array.isArray(workflow.edges) ? workflow.edges.length : 0
          });
        } catch (err) {
          console.warn(`Failed to read workflow ${entry}:`, err);
        }
      }

      workflows.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
      res.json({ workflows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取特定技能的可视化工作流 JSON
  app.get("/api/workflow/:id", async (req, res) => {
    const jsonPath = path.join(workspaceCwd, "skills", req.params.id, "workflow.json");
    if (await fs.pathExists(jsonPath)) {
      const data = await fs.readJson(jsonPath);
      res.json(data);
    } else {
      res.status(404).json({ error: "Workflow json not found" });
    }
  });

  // 删除用户保存的可视化工作流，内置模板不允许删除
  app.delete("/api/workflow/:id", async (req, res) => {
    const protectedWorkflowIds = new Set([
      "blank-workflow",
      "course-group-todo",
      "courseware-card",
      "socratic-quiz",
      "daily-briefing"
    ]);
    const workflowId = req.params.id;
    if (protectedWorkflowIds.has(workflowId)) {
      res.status(400).json({ error: "Built-in workflow templates cannot be deleted" });
      return;
    }

    const skillDir = path.join(workspaceCwd, "skills", workflowId);
    const piSkillDir = path.join(workspaceCwd, ".pi", "skills", workflowId);

    try {
      if (!await fs.pathExists(skillDir) && !await fs.pathExists(piSkillDir)) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      await fs.remove(skillDir);
      await fs.remove(piSkillDir);

      try {
        const targetSessionId = (req.query.sessionId as string) || defaultSessionId;
        const s = await getOrCreateSession(targetSessionId);
        await s.prompt("/reload");
      } catch (reloadErr) {
        console.warn("Workflow delete reload skipped:", reloadErr);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Workflow delete error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 保存并编译可视化工作流 JSON ➔ SKILL.md
  app.post("/api/workflow/:id", async (req, res) => {
    const { name, description, nodes, edges, sessionId } = req.body;
    const targetDir = path.join(workspaceCwd, "skills", req.params.id);
    const jsonPath = path.join(targetDir, "workflow.json");

    try {
      await fs.ensureDir(targetDir);
      await fs.outputJson(jsonPath, { id: req.params.id, name, description, nodes, edges }, { spaces: 2 });

      // 编译为 Markdown SKILL.md 写入到 .pi/skills 目录中
      const skillMDPath = path.join(workspaceCwd, ".pi", "skills", req.params.id, "SKILL.md");
      await compileWorkflowToSkill(jsonPath, skillMDPath);

      // 通过 prompt 触发内核 /reload 指令，动态热重载新编译的技能
      const targetSessionId = sessionId || defaultSessionId;
      const s = await getOrCreateSession(targetSessionId);
      await s.prompt("/reload");

      res.json({ success: true, message: "Workflow saved and compiled successfully" });
    } catch (err: any) {
      console.error("Workflow save error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 获取所有可用模型与 Provider 状态
  app.get("/api/models", async (req, res) => {
    const sessionId = (req.query.sessionId as string) || defaultSessionId;
    try {
      const s = await getOrCreateSession(sessionId);
      const allModels = modelRegistry.getAll();
      const providersList = ["anthropic", "openai", "google", "deepseek", "qwen", "openrouter"];

      const providersData = providersList.map((p) => {
        const authStatus = modelRegistry.getProviderAuthStatus(p);

        let configuredBaseUrl = "";
        const allRegisteredModels = modelRegistry.getAll();
        const firstModelOfProvider = allRegisteredModels.find(m => m.provider === p);
        if (firstModelOfProvider) {
          configuredBaseUrl = firstModelOfProvider.baseUrl;
        }

        return {
          id: p,
          name: modelRegistry.getProviderDisplayName(p),
          configured: authStatus.configured || !!authStatus.source,
          source: authStatus.source,
          baseUrl: configuredBaseUrl
        };
      });

      const modelsData = allModels.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        reasoning: m.reasoning,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens
      }));

      res.json({
        providers: providersData,
        models: modelsData,
        activeModel: s.model?.id,
        activeProvider: s.model?.provider,
        thinkingLevel: s.thinkingLevel
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 配置 Provider (API Key, Base URL 等)
  app.post("/api/models/configure", async (req, res) => {
    const { provider, apiKey, baseUrl, api, models } = req.body;
    try {
      if (apiKey !== undefined) {
        if (apiKey.trim() === "") {
          authStorage.remove(provider);
        } else {
          authStorage.set(provider, { type: "api_key", key: apiKey });
        }
      }

      let modelsConfig: any = { providers: {} };
      if (await fs.pathExists(modelsJsonPath)) {
        try {
          modelsConfig = await fs.readJson(modelsJsonPath);
        } catch (err) {
          // 容错忽略损坏的 JSON
        }
      }

      if (!modelsConfig.providers) {
        modelsConfig.providers = {};
      }

      if (!modelsConfig.providers[provider]) {
        modelsConfig.providers[provider] = {};
      }

      if (baseUrl !== undefined) {
        modelsConfig.providers[provider].baseUrl = baseUrl;
      }

      if (api !== undefined) {
        modelsConfig.providers[provider].api = api;
      }

      if (models !== undefined) {
        modelsConfig.providers[provider].models = models;
      }

      if (Object.keys(modelsConfig.providers[provider]).length === 0) {
        delete modelsConfig.providers[provider];
      }

      await fs.outputJson(modelsJsonPath, modelsConfig, { spaces: 2 });

      modelRegistry.refresh();
      authStorage.reload();

      res.json({ success: true, message: `Provider ${provider} configured successfully` });
    } catch (err: any) {
      console.error("Configure provider error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 切换激活的模型与思考级别
  app.post("/api/models/select", async (req, res) => {
    const { provider, modelId, thinkingLevel, sessionId } = req.body;
    const targetSessionId = sessionId || defaultSessionId;
    try {
      const s = await getOrCreateSession(targetSessionId);
      const model = modelRegistry.find(provider, modelId);
      if (!model) {
        return res.status(404).json({ error: `Model ${provider}/${modelId} not found` });
      }

      await s.setModel(model);

      if (thinkingLevel) {
        await s.setThinkingLevel(thinkingLevel);
      }

      io.to(targetSessionId).emit("session-state", {
        model: s.model?.id,
        thinkingLevel: s.thinkingLevel,
        messages: s.messages
      });

      res.json({
        success: true,
        activeModel: s.model?.id,
        thinkingLevel: s.thinkingLevel
      });
    } catch (err: any) {
      console.error("Select model error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 静态托管前端打包后的静态资源 (如果是生产一键包环境)
  const frontendDistPath = path.join(workspaceCwd, "frontend", "dist");
  if (await fs.pathExists(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    // 拦截所有非 API 请求，返回前端 Single Page Application 的 index.html
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(path.join(frontendDistPath, "index.html"));
    });
    console.log(`[Server] Statically hosting frontend dist from ${frontendDistPath}`);
  }

  // ----------------- Socket.io 实时通信 -----------------
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // 加入指定会话的房间
    socket.on("join-session", async (data: { sessionId: string }) => {
      const sId = data.sessionId || defaultSessionId;
      socket.join(sId);
      console.log(`Socket ${socket.id} joined session: ${sId}`);

      try {
        const s = await getOrCreateSession(sId);
        socket.emit("session-state", {
          model: s.model?.id,
          thinkingLevel: s.thinkingLevel,
          messages: s.messages
        });
      } catch (err: any) {
        socket.emit("pi-error", { message: err.message });
      }
    });

    // 离开会话房间
    socket.on("leave-session", (data: { sessionId: string }) => {
      if (data.sessionId) {
        socket.leave(data.sessionId);
        console.log(`Socket ${socket.id} left session: ${data.sessionId}`);
      }
    });

    // 客户端发送新消息
    socket.on("send-message", async (data: { text: string; images?: any[]; sessionId: string }) => {
      const sId = data.sessionId || defaultSessionId;
      try {
        const s = await getOrCreateSession(sId);
        const knowledgeContext = await buildAgentKnowledgeContext(kbService, data.text);
        const promptText = knowledgeContext
          ? `${knowledgeContext.promptPrefix}\n\n---\n\n[用户问题]\n${data.text}`
          : data.text;

        if (knowledgeContext) {
          socket.emit("knowledge:context-used", {
            sessionId: sId,
            references: knowledgeContext.references
          });
        }

        await s.prompt(promptText, { images: data.images });
      } catch (err: any) {
        socket.emit("pi-error", { message: err.message });
      }
    });

    // 客户端触发中断/中止执行
    socket.on("abort", async (data: { sessionId: string }) => {
      const sId = data.sessionId || defaultSessionId;
      try {
        const s = await getOrCreateSession(sId);
        await s.abort();
      } catch (err: any) {
        socket.emit("pi-error", { message: err.message });
      }
    });

    // 客户端触发清空对话 / 新建会话
    socket.on("clear-session", async (data: { sessionId: string }) => {
      const sId = data.sessionId || defaultSessionId;
      try {
        const s = await getOrCreateSession(sId);
        await s.abort();
        s.sessionManager.newSession({ id: sId });
        s.agent.state.messages = [];
        io.to(sId).emit("session-state", {
          model: s.model?.id,
          thinkingLevel: s.thinkingLevel,
          messages: s.messages
        });
      } catch (err: any) {
        socket.emit("pi-error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start backend server:", err);
});
