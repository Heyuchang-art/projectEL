# Snapshot Pi Web UI 设计与架构手册 (原 Desktop 指南)

> **修订说明 (2026-06-28)**：本项目已放弃 Electron 桌面端封装方案，全面转向基于 **Next.js** 的纯 Web 线上架构。本手册已根据最新架构重构。

本手册详述了 `Snapshot Pi` 系统的 Web 界面设计规范、Tailwind/Shadcn 的整合准则，以及 Next.js 前后端分离代理架构。

---

## 1. 核心视觉风格：苹果风玻璃悬浮 (Apple Fluent Glassmorphism)

系统采用轻量悬浮、毛玻璃磨砂（Glassmorphism）、大圆角、流光弥散背景的 Apple Fluent 体验，支持深色与亮色双主题的平滑切换。

### 1.1 双主题玻璃参数规范
系统通过在 HTML 根节点切换 `data-theme="dark"` 或 `data-theme="light"` 进行全局主题管理：

| CSS 变量键名 | 🌑 深色玻璃模式 (Dark Glassmorphism) | ☀️ 亮色玻璃模式 (Light Glassmorphism) |
| :--- | :--- | :--- |
| `--bg-color` | 深空钛灰 (`#08080c`) | 冰川白雾 (`#f2f4f8`) |
| `--panel-bg` | 半透明炭黑 (`rgba(22, 22, 28, 0.5)`) | 半透明牛奶白 (`rgba(255, 255, 255, 0.45)`) |
| `--panel-border` | 极细透光白 (`1px solid rgba(255,255,255,0.08)`) | 极细透光灰 (`1px solid rgba(0,0,0,0.06)`) |
| `--panel-border-active`| 高亮白光边 (`1px solid rgba(255,255,255,0.22)`) | 灰黑压边 (`1px solid rgba(0,0,0,0.16)`) |
| `--text-main` | 极地白 (`#f8fafc`) | 曜石黑 (`#0f172a`) |
| `--text-muted` | 灰蓝 (`#94a3b8`) | 板岩灰 (`#475569`) |
| `--primary` | 极光紫 (`#6366f1`) | 皇家靛蓝 (`#4f46e5`) |
| `--glass-blur` | `blur(20px) saturate(190%)` | `blur(20px) saturate(190%)` |
| `--glass-shadow` | 漫反射深邃投影 `0 12px 40px rgba(0,0,0,0.4)` | 优雅微投影 `0 12px 40px rgba(31,38,135,0.06)` |

### 1.2 背景弥散流光 (Mesh Gradients)
背景层引入后台缓慢流动的弥散渐变球（Mesh Gradients）：
*   使用两到三个带高斯模糊（`filter: blur(80px)`）的彩色半透明圆形 DIV，映射底层的主题基色。
*   配以慢速呼吸帧动画（`animation: floatCircle 20s infinite alternate`），使背景呈现呼吸般的彩色流动，折射在毛玻璃卡片上。
*   **渐变球基色预设**：
    *   *静谧极光* (Default): 青绿 (`#00f2fe`) 与 深靛紫 (`#6366f1`)。
    *   *日落余晖*: 珊瑚橙 (`#f97316`) 与 蔓越莓红 (`#db2777`)。

### 1.3 动效与几何
*   **阻尼弹簧过渡**：Hover、Active 等事件统一采用弹簧过渡曲线：`transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)`。Hover 时卡片轻微上移并软化投影。
*   **圆润轮廓**：外层容器统一使用大圆角 `rounded-[20px]`，内层输入框与按钮统一使用中圆角 `rounded-[12px]`。

---

## 2. UI 布局系统：专注模式与多栏工作区自适应

系统采用**自适应联动布局系统**，通过左侧边栏的活动卡片状态（`activeCards`）进行智能切换。

### 2.1 专注模式 (Focus Mode)
当左侧边栏仅启用了 `chat` 卡片时（`activeCards` 长度为 1 且仅含 `chat`），系统自动进入专注模式。布局锁定为标准的 **Google AI Studio 三栏布局**：
*   **左栏 (Sidebar - 10% 宽度)**：超窄悬浮磨砂玻璃条，提供核心功能的开关切换。
*   **中栏 (Chat Workspace - 60% 宽度)**：包括会话列表与对话流主视窗。底部采用高度自适应的 **输入胶囊 (Input Capsule)**，集成 Token 统计及多模态图片上传。
*   **右栏 (Parameter Panel - 30% 宽度)**：常驻显示 **Session 参数调节面板**（AgentSettingsCard），提供 System Instructions、模型切换以及 Temperature 等滑块。

### 2.2 工作区模式 (Workspace Mode)
当启用了 `chat` 以外的任何卡片时（例如并排开启 `chat` 与 `canvas` 画布），系统无缝切换到 **Workspace 多列拖拽分栏布局**：
*   **主工作区**：占据剩余全部宽度，各卡片以列为单位排列，允许用户自由拖拽、关闭及调整列宽。
*   **卡片内参数抽屉**：为了避免挤占多栏分栏的宝贵宽度，原本常驻在右侧的 30% 参数面板会在主页面隐藏。在 Chat Card 的标题栏右侧会增加一个 🎚️ **“参数”** 展开按钮。点击后，直接在内部右侧滑出一个**卡片内侧面板抽屉 (Inside-Card Drawer)**，供用户配置当前会话。

### 2.3 聊天框 Slash Command (/) 与 Skill 激活机制
为提升交互效率，系统在输入胶囊上方集成了 Slash Command 联想功能：
*   **唤起与联想面板**：当用户在输入框键入 `/` 时，上方弹出悬浮式毛玻璃联想菜单（基于 Shadcn `Command` 组件）。
*   **选项列表与检索**：动态请求后端 `/api/workflows` 接口，列出所有可用技能，支持过滤选取。
*   **执行与激活行为**：选中技能命令自动补全 `/skill <skillId>`。后端解析后将 `SKILL.md` 注入 System Context。
*   **激活状态反馈 (Skill Badge)**：挂载技能后，聊天视窗右上角高亮显示活动技能徽章（如：`Active Skill: daily-briefing (x)`）。点击 `(x)` 退载。

---

## 3. Next.js 架构与 Tailwind/Shadcn UI 基础集成规范

本系统已摒弃 Vite 与 Electron，采用纯 Web 的 Next.js (App Router) 架构。

### 3.1 依赖安装与项目初始化
在 `frontend` 目录使用 Next.js 构建环境：
```bash
npx create-next-app@latest .
npm install tailwindcss postcss autoprefixer
npx shadcn-ui@latest init
```

### 3.2 Next.js 反向代理配置 (解决跨域)
在 `frontend/next.config.mjs` 中配置 `rewrites`，将所有前端 `/api` 和 Socket 请求代理到现有的 Node.js 后端服务器（假设运行在 3000 端口）：
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*' 
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3000/socket.io/:path*'
      }
    ]
  }
};
export default nextConfig;
```

### 3.3 变量与全局样式整合
在 `frontend/tailwind.config.ts` 中将 CSS 主题变量绑定至 Tailwind 实用类：
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-color)",
        panel: "var(--panel-bg)",
        primary: "var(--primary)",
      }
    }
  }
};
export default config;
```

### 3.4 Shadcn UI 组件改造 (适配毛玻璃)
所有导入的 Shadcn UI 原子组件（如 `components/ui/dialog.tsx` 等）需进行微调，以贴合系统的毛玻璃设计基调：
*   **替换硬边框**：将默认边框类（如 `border-border` 或 `border-slate-200`）替换为动态发光半透明边框，例如直接使用 `border-[var(--panel-border)]`。
*   **背景透光与模糊**：在弹出层容器或卡片容器中添加 `bg-[var(--panel-bg)] backdrop-blur-md`，以保障背景穿透磨砂效果。
