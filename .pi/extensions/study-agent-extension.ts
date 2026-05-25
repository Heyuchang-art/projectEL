import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import fs from "fs-extra";
import path from "path";
import { compileWorkflowToSkill } from "./compiler.js";
import { completeSimple } from "@earendil-works/pi-ai";

export default function (pi: ExtensionAPI) {
  // 监听用户输入事件，用于自动拦截并调用 Qwen 子智能体识图
  pi.on("input", async (event, ctx) => {
    if (event.images && event.images.length > 0) {
      try {
        // 1. 寻找可用的识图模型
        // 优先寻找用户配置的 qwen 识图模型，如果失败，则遍历所有支持 image 且已配置的 model
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
              // 排除在系统环境中存在 Anthropic/Google 代理 key 但 baseUrl 未重定向导致直连报错的情况
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

        // 2. 发送识图子智能体正在运行的交互式消息给前端
        pi.sendMessage({
          customType: "subagent-status",
          content: `🤖 **识图子智能体**：检测到上传 of 图片，正在调用 ${visionModel.name || visionModel.id} 进行图像分析和细节提取...`,
          display: true,
          details: { status: "working", agent: visionModel.provider }
        });

        // 3. 构建子智能体的对话上下文
        const content = [
          { 
            type: "text" as const, 
            text: "请详细描述用户上传的这张或多张图片。你的描述将被传递给另一个主大语言模型（如 DeepSeek），以便它能够根据你的描述准确解答用户的问题。因此，请聚焦于图片的细节、文字、结构、颜色和关键信息，并客观、清晰、结构化地进行描述。" 
          },
          ...event.images.map(img => ({
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

        // 4. 调用识图模型进行推理
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

        // 如果文本内容为空，尝试回退到 thinking 内容
        if (!description.trim() && thinkingContent.trim()) {
          description = thinkingContent;
        }

        if (!description.trim()) {
          const diag = `stopReason=${assistantMessage.stopReason}, error=${assistantMessage.errorMessage || 'none'}, contentBlocks=${assistantMessage.content.map(c => c.type).join(',') || 'empty'}`;
          throw new Error(`${visionModel.name || visionModel.id} 子智能体返回了空的图像描述 [诊断: ${diag}]`);
        }

        // 5. 发送识别成功的交互式消息给前端
        pi.sendMessage({
          customType: "subagent-result",
          content: `🤖 **${visionModel.name || visionModel.id} 识图子智能体**分析完成！\n\n**图片详细描述：**\n${description}`,
          display: true,
          details: { status: "done", agent: visionModel.provider, result: description }
        });

        // 6. 将分析结果注入到用户原问题中，传给 DeepSeek，同时清除 images 防止 DeepSeek 识图报错
        const transformedText = `[${visionModel.name || visionModel.id} 图像分析子智能体提供的图片描述]
${description}

---

[用户的原问题]
${event.text}`;

        return {
          action: "transform" as const,
          text: transformedText,
          images: [] // 清空 images，避免 text-only 的 DeepSeek 报错
        };

      } catch (err: any) {
        console.error("Vision subagent error:", err);
        pi.sendMessage({
          customType: "subagent-error",
          content: `❌ **识图子智能体执行出错**：${err.message || err}`,
          display: true,
          details: { status: "error", agent: "vision", error: err.message }
        });
        
        // 发生错误时，为了保证流程不中断，我们继续但不附带图片以防止报错
        return {
          action: "transform" as const,
          text: `[识图子智能体运行出错：${err.message || err}]\n\n${event.text}`,
          images: []
        };
      }
    }

    return { action: "continue" as const };
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
      // 目标存储 workflow.json 的位置 (在工作区 skills 目录)
      const targetDir = path.resolve(ctx.cwd, "skills", params.skillId);
      const jsonPath = path.join(targetDir, "workflow.json");

      // 1. 确保目录存在并写入 workflow.json
      await fs.ensureDir(targetDir);
      const data = JSON.parse(params.workflowData);
      await fs.outputJson(jsonPath, data, { spaces: 2 });

      // 2. 编译为 SKILL.md 并保存至工作区本地的 .pi/skills/ 目录下
      const skillMDDir = path.resolve(ctx.cwd, ".pi", "skills", params.skillId);
      const skillMDPath = path.join(skillMDDir, "SKILL.md");
      await compileWorkflowToSkill(jsonPath, skillMDPath);

      // 3. 重要：通过发送 followUp 消息让内核执行 `/reload` 重新加载新技能
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
