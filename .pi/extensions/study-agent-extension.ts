import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import fs from "fs-extra";
import path from "path";
import { compileWorkflowToSkill } from "./compiler.js";
import { completeSimple } from "@earendil-works/pi-ai";

export default function (pi: ExtensionAPI) {
  // 注入预设 System Prompt
  pi.on("before_agent_start", async (event, ctx) => {
    try {
      const entries = ctx.sessionManager.getEntries();
      const presetEntry = entries.find((e: any) => e.type === "custom" && e.customType === "preset");
      if (!presetEntry) return;

      const presetId = (presetEntry as any).data?.presetId;
      if (!presetId) return;

      const presetsPath = path.join(ctx.cwd, "skills", "agent-presets.json");
      if (await fs.pathExists(presetsPath)) {
        const presets = await fs.readJson(presetsPath);
        const preset = presets.find((p: any) => p.id === presetId);
        if (preset && preset.systemPrompt) {
          return {
            systemPrompt: `${preset.systemPrompt}\n\n${event.systemPrompt}`
          };
        }
      }
    } catch (err) {
      console.error("Preset systemPrompt injection error:", err);
    }
  });

  // 监听用户输入事件，用于自动拦截并调用 Qwen 子智能体识图以及注入知识库文档
  pi.on("input", async (event, ctx) => {
    let text = event.text;
    let images = event.images || [];
    let transformed = false;

    // 0. Slash Command 主动触发技能拦截
    if (text.trim().startsWith("/")) {
      const match = text.trim().match(/^\/([\w-]+)(?:\s+(.*))?$/);
      if (match) {
        const skillId = match[1];
        const restText = match[2] || "";
        const skillPath = path.join(ctx.cwd, ".pi", "skills", skillId, "SKILL.md");
        
        try {
          if (await fs.pathExists(skillPath)) {
            text = `[系统强制指令]\n用户显式调用了 /${skillId} 技能。\n请你立刻查阅并按照名为 "${skillId}" 的技能说明书严格执行对应的操作流程。不要找借口拒绝，也不要解释，直接开始执行第一步。\n\n[用户的附加输入]\n${restText}`;
            transformed = true;
          }
        } catch (err) {
          console.error("Error checking skill path for slash command:", err);
        }
      }
    }

    // 1. 识图逻辑 (如果上传了图片，且当前主模型不支持多模态输入)
    const activeModelSupportsVision = ctx.model?.input?.includes("image");
    if (images.length > 0 && !activeModelSupportsVision) {
      try {
        // 寻找可用的识图模型
        let visionModel = ctx.modelRegistry.find("qwen", "qwen3.6-flash-2026-04-16") || 
                            ctx.modelRegistry.find("qwen", "qwen3.6-35b-a3b") || 
                            ctx.modelRegistry.find("qwen", "qwen-vl-max");
        let auth = visionModel ? await ctx.modelRegistry.getApiKeyAndHeaders(visionModel) : { ok: false, apiKey: undefined, headers: undefined };
        
        if (!auth.ok) {
          const allModels = ctx.modelRegistry.getAll();
          const candidateModels = allModels.filter(m => m.input && m.input.includes("image"));
          
          for (const m of candidateModels) {
            const a = await ctx.modelRegistry.getApiKeyAndHeaders(m);
            if (a.ok) {
              if (m.provider === "anthropic" && a.apiKey?.startsWith("sk-ant-router") && m.baseUrl?.includes("api.anthropic.com")) {
                continue;
              }
              if (m.provider === "google" && a.apiKey?.startsWith("sk-ant-router") && m.baseUrl?.includes("generativelanguage.googleapis.com")) {
                continue;
              }
              visionModel = m;
              auth = a;
              break;
            }
          }
        }

        if (!visionModel || !auth.ok) {
          throw new Error("模型注册表里找不到任何已配置且有效的识图模型（如 Qwen, Gemini, GPT-4o 等），请在配置面板中添加服务商凭证");
        }

        pi.sendMessage({
          customType: "subagent-status",
          content: `🤖 **识图子智能体**：检测到上传图片，正在调用 ${visionModel.name || visionModel.id} 进行图像分析和细节提取...`,
          display: true,
          details: { status: "working", agent: visionModel.provider }
        });

        const content = [
          { 
            type: "text" as const, 
            text: "请详细描述用户上传的这张或多张图片。你的描述将被传递给另一个主大语言模型（如 DeepSeek），以便它能够根据你的描述准确解答用户的问题。因此，请聚焦于图片的细节、文字、结构、颜色和关键信息，并客观、清晰、结构化地进行描述。" 
          },
          ...images.map(img => ({
            type: "image" as const,
            data: img.data,
            mimeType: img.mimeType
          }))
        ];

        const context = {
          messages: [
            { role: "user" as const, content, timestamp: Date.now() }
          ]
        };

        const assistantMessage = await completeSimple(visionModel, context, {
          apiKey: auth.apiKey,
          headers: auth.headers
        });

        let description = "";
        let thinkingContent = "";
        for (const part of assistantMessage.content) {
          if (part.type === "text") {
            description += part.text;
          } else if (part.type === "thinking") {
            thinkingContent += part.thinking;
          }
        }

        if (!description.trim() && thinkingContent.trim()) {
          description = thinkingContent;
        }

        if (!description.trim()) {
          const diag = `stopReason=${assistantMessage.stopReason}, error=${assistantMessage.errorMessage || 'none'}, contentBlocks=${assistantMessage.content.map(c => c.type).join(',') || 'empty'}`;
          throw new Error(`${visionModel.name || visionModel.id} 子智能体返回了空的图像描述 [诊断: ${diag}]`);
        }

        pi.sendMessage({
          customType: "subagent-result",
          content: `🤖 **${visionModel.name || visionModel.id} 识图子智能体**分析完成！\n\n**图片详细描述：**\n${description}`,
          display: true,
          details: { status: "done", agent: visionModel.provider, result: description }
        });

        text = `[${visionModel.name || visionModel.id} 图像分析子智能体提供的图片描述]\n${description}\n\n---\n\n[用户的原问题]\n${text}`;
        images = []; // 清除图片防止 text-only 模型报错
        transformed = true;
      } catch (err: any) {
        console.error("Vision subagent error:", err);
        pi.sendMessage({
          customType: "subagent-error",
          content: `❌ **识图子智能体执行出错**：${err.message || err}`,
          display: true,
          details: { status: "error", agent: "vision", error: err.message }
        });
        
        text = `[识图子智能体运行出错：${err.message || err}]\n\n${text}`;
        images = [];
        transformed = true;
      }
    }

    // 2. 注入预设绑定的知识库文档
    try {
      const entries = ctx.sessionManager.getEntries();
      const presetEntry = entries.find((e: any) => e.type === "custom" && e.customType === "preset");
      if (presetEntry) {
        const presetId = (presetEntry as any).data?.presetId;
        if (presetId) {
          const presetsPath = path.join(ctx.cwd, "skills", "agent-presets.json");
          if (await fs.pathExists(presetsPath)) {
            const presets = await fs.readJson(presetsPath);
            const preset = presets.find((p: any) => p.id === presetId);
            if (preset && preset.contextDocs && preset.contextDocs.length > 0) {
              let docsContent = "";
              const activeKbId = await getActiveKbId(ctx.cwd);
              for (const doc of preset.contextDocs) {
                const docPath = path.isAbsolute(doc) ? doc : path.join(ctx.cwd, "knowledge_bases", activeKbId, "wiki_core", doc);
                if (await fs.pathExists(docPath)) {
                  const content = await fs.readFile(docPath, "utf8");
                  docsContent += `\n\n--- 文档: ${path.basename(doc)} ---\n${content}\n`;
                }
              }
              if (docsContent.trim()) {
                text = `[知识库文档上下文]\n${docsContent.trim()}\n\n---\n\n${text}`;
                transformed = true;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error reading contextDocs in input event:", err);
    }

    if (transformed) {
      return {
        action: "transform" as const,
        text,
        images
      };
    }

    return { action: "continue" as const };
  });

  // 辅助函数：读取当前激活的记忆库ID
  const getActiveKbId = async (cwd: string): Promise<string> => {
    const activeKbPath = path.join(cwd, ".pi", "active_kb.json");
    try {
      if (await fs.pathExists(activeKbPath)) {
        const data = await fs.readJson(activeKbPath);
        return data.activeKbId || "default";
      }
    } catch (err) {
      console.error("Error reading active_kb.json:", err);
    }
    return "default";
  };

  // 辅助函数：将概念标题转化为规范的文件名
  const slugify = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w一-鿿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled';
  };

  // 注册让 Agent 显式存储记忆的工具
  pi.registerTool({
    name: "save_memory",
    label: "存储记忆",
    description: "记录有关用户的个人偏好、重要事实或系统相关的长期记忆，以便在将来的对话中随时查阅",
    parameters: Type.Object({
      title: Type.String({ description: "简短、唯一的记忆标题或概念名称，例如 user-name 或 favorite-editor" }),
      content: Type.String({ description: "具体的记忆细节、偏好事实或上下文内容，使用详细且客观的陈述" }),
      tags: Type.Optional(Type.Array(Type.String(), { description: "相关标签，系统默认会自动添加 memory 标签" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        const activeKbId = await getActiveKbId(ctx.cwd);
        const uuid = Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 6);
        const now = new Date().toISOString();
        
        const cardTitle = params.title.trim();
        const cardFilename = `${slugify(cardTitle)}.md`;
        
        const conceptsDir = path.join(ctx.cwd, "knowledge_bases", activeKbId, "wiki_core", "concepts");
        await fs.ensureDir(conceptsDir);
        
        const filePath = path.join(conceptsDir, cardFilename);
        
        // Frontmatter
        const fm = {
          id: uuid,
          title: cardTitle,
          lifecycle: "immortal",
          confidence_score: 1.0,
          decay_rate: 0,
          last_interacted: now,
          created_at: now,
          tags: Array.from(new Set([...(params.tags || []), "memory"])),
          type: "concept"
        };
        
        const fmLines = Object.entries(fm).map(([k, v]) => {
          if (v === undefined || v === null) return null;
          if (Array.isArray(v)) {
            if (v.length === 0) return null;
            return `${k}: [${v.map(item => typeof item === 'string' && item.startsWith('#') ? item : `"${item}"`).join(', ')}]`;
          }
          if (typeof v === 'number' || typeof v === 'boolean') {
            return `${k}: ${v}`;
          }
          return `${k}: ${v}`;
        }).filter(Boolean);
        
        const content = `---\n${fmLines.join('\n')}\n---\n\n# ${cardTitle}\n\n${params.content}\n`;
        await fs.writeFile(filePath, content, 'utf8');

        return {
          content: [{
            type: "text",
            text: `✨ 成功记录长期记忆「${cardTitle}」到当前记忆库（${activeKbId}）中。\n内容预览：${params.content}`
          }],
          details: {
            title: cardTitle,
            activeKbId,
            filePath
          }
        };
      } catch (err: any) {
        console.error("save_memory tool error:", err);
        return {
          content: [{
            type: "text",
            text: `❌ 存储记忆失败：${err.message || err}`
          }],
          details: { error: err.message || String(err) }
        };
      }
    }
  });

  // 注册让 Agent 主动检索记忆的工具
  pi.registerTool({
    name: "query_memory",
    label: "查询记忆",
    description: "查阅或搜索之前记录的关于用户偏好、重要事实的长期记忆卡片",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "搜索关键词。如果留空，则列出最近记录的所有记忆卡片" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        const activeKbId = await getActiveKbId(ctx.cwd);
        const conceptsDir = path.join(ctx.cwd, "knowledge_bases", activeKbId, "wiki_core", "concepts");
        
        if (!(await fs.pathExists(conceptsDir))) {
          return {
            content: [{
              type: "text",
              text: `ℹ️ 当前记忆库中尚无任何概念或记忆。`
            }],
            details: { count: 0, reason: "conceptsDir does not exist" }
          };
        }

        const files = await fs.readdir(conceptsDir);
        const matchedMemories: { title: string; content: string; tags: string[] }[] = [];

        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const filePath = path.join(conceptsDir, file);
          const rawContent = await fs.readFile(filePath, 'utf8');
          
          const fmMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
          if (!fmMatch) continue;
          
          const fmText = fmMatch[1];
          const bodyText = fmMatch[2];
          
          let title = file.replace(/\.md$/, '');
          let isMemory = false;
          let tags: string[] = [];

          const titleMatch = fmText.match(/title:\s*(.*)/);
          if (titleMatch) title = titleMatch[1].replace(/['"]/g, '').trim();

          const tagsMatch = fmText.match(/tags:\s*\[(.*?)\]/);
          if (tagsMatch) {
            tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
            if (tags.includes('memory')) {
              isMemory = true;
            }
          }

          if (isMemory) {
            const q = params.query?.trim().toLowerCase();
            const titleMatches = title.toLowerCase().includes(q || '');
            const bodyMatches = bodyText.toLowerCase().includes(q || '');
            
            if (!q || titleMatches || bodyMatches) {
              matchedMemories.push({
                title,
                content: bodyText.trim(),
                tags
              });
            }
          }
        }

        if (matchedMemories.length === 0) {
          return {
            content: [{
              type: "text",
              text: params.query 
                ? `ℹ️ 未找到与「${params.query}」相关的长期记忆。`
                : `ℹ️ 当前记忆库中尚无已记录的长期记忆。`
            }],
            details: { count: 0, query: params.query || "" }
          };
        }

        const memoryLines = matchedMemories.map(m => `### 📌 ${m.title}\n${m.content}`).join('\n\n');
        return {
          content: [{
            type: "text",
            text: `🔍 查询到以下长期记忆：\n\n${memoryLines}`
          }],
          details: { count: matchedMemories.length, query: params.query || "" }
        };
      } catch (err: any) {
        console.error("query_memory tool error:", err);
        return {
          content: [{
            type: "text",
            text: `❌ 查询记忆失败：${err.message || err}`
          }],
          details: { error: err.message || String(err) }
        };
      }
    }
  });

  // 注册让 Agent 创建用户学习错题本/闪卡 (curated_note) 的工具
  pi.registerTool({
    name: "create_study_note",
    label: "创建学习笔记/卡片",
    description: "为用户创建一个用于间隔重复学习 (SM-2) 的复习笔记/闪卡卡片。可以选择关联知识库中的概念卡片。",
    parameters: Type.Object({
      title: Type.String({ description: "简短唯一的笔记标题，例如 导数公式" }),
      content: Type.String({ description: "具体的复习细节、问题或卡片内容" }),
      tags: Type.Optional(Type.Array(Type.String(), { description: "相关标签，系统默认会自动添加 note 标签" })),
      source_card_id: Type.Optional(Type.String({ description: "源知识库概念卡片的 ID（UUID），用于双向关联" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        const activeKbId = await getActiveKbId(ctx.cwd);
        const uuid = Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 6);
        const now = new Date().toISOString();
        
        const noteTitle = params.title.trim();
        const noteFilename = `${slugify(noteTitle)}.md`;
        
        const notesDir = path.join(ctx.cwd, "knowledge_bases", activeKbId, "curated_notes");
        await fs.ensureDir(notesDir);
        
        const filePath = path.join(notesDir, noteFilename);
        
        // Frontmatter
        const fm = {
          id: uuid,
          title: noteTitle,
          tags: Array.from(new Set([...(params.tags || []), "note"])),
          lifecycle: "standard",
          next_review: now,
          stability: 1.0,
          difficulty: 3.0,
          reps: 0,
          created_at: now,
          type: "note",
          source_card_id: params.source_card_id || undefined,
        };
        
        const fmLines = Object.entries(fm).map(([k, v]) => {
          if (v === undefined || v === null) return null;
          if (Array.isArray(v)) {
            if (v.length === 0) return null;
            return `${k}: [${v.map(item => typeof item === 'string' && item.startsWith('#') ? item : `"${item}"`).join(', ')}]`;
          }
          if (typeof v === 'number' || typeof v === 'boolean') {
            return `${k}: ${v}`;
          }
          return `${k}: ${v}`;
        }).filter(Boolean);
        
        const content = `---\n${fmLines.join('\n')}\n---\n\n# ${noteTitle}\n\n${params.content}\n`;
        await fs.writeFile(filePath, content, 'utf8');

        return {
          content: [{
            type: "text",
            text: `✨ 成功为用户创建了学习复习卡片「${noteTitle}」（已关联源卡片：${params.source_card_id || '无'}）到当前记忆库（${activeKbId}）中。`
          }],
          details: {
            title: noteTitle,
            activeKbId,
            filePath,
            source_card_id: params.source_card_id
          }
        };
      } catch (err: any) {
        console.error("create_study_note tool error:", err);
        return {
          content: [{
            type: "text",
            text: `❌ 创建复习卡片失败：${err.message || err}`
          }],
          details: { error: err.message || String(err) }
        };
      }
    }
  });

  // 注册让 Agent 修改自身技能结构的工具
  pi.registerTool({
    name: "write_workflow",
    label: "修改技能工作流",
    description: "写入或修改一个技能的可视化工作流 JSON 并自动生成对应的 SKILL.md 技能定义",
    parameters: Type.Object({
      skillId: Type.String({ description: "技能的唯一ID标识，例如 fetch-and-summarize-news" }),
      workflowData: Type.String({ description: "JSON 格式的工作流节点与边定义（包含 nodes 与 edges 字段）" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const targetDir = path.resolve(ctx.cwd, "skills", params.skillId);
      const jsonPath = path.join(targetDir, "workflow.json");

      await fs.ensureDir(targetDir);
      const data = JSON.parse(params.workflowData);
      await fs.outputJson(jsonPath, data, { spaces: 2 });

      const skillMDDir = path.resolve(ctx.cwd, ".pi", "skills", params.skillId);
      const skillMDPath = path.join(skillMDDir, "SKILL.md");
      await compileWorkflowToSkill(jsonPath, skillMDPath);

      pi.sendUserMessage("/reload", { deliverAs: "followUp" });

      return {
        content: [{
          type: "text",
          text: `工作流已保存至: ${jsonPath}\n并且已成功编译为 Pi 技能文件: ${skillMDPath}\nAgent 会话将在当前回合结束后自动执行 /reload 进行热更新。`
        }],
        details: {
          jsonPath,
          skillMDPath
        }
      };
    }
  });
}
