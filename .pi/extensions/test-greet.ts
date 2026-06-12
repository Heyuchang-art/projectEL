import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "向某人打招呼",
    parameters: Type.Object({
      name: Type.String({ description: "要问候的名字" }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `你好，${params.name}！这是自定义工具测试成功 🎉` }],
        details: {},
      };
    },
  });

  console.log("[test-greet] 自定义工具已加载！");
}
