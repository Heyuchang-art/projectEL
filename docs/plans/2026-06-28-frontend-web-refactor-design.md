# 前端 Web 架构重构设计文档 (Frontend Web Refactor Design)

## 1. 背景与目标 (Background & Goals)
现有项目（Vite + React）原计划采用 Electron 封装桌面端。经过重做评估与头脑风暴，为了最大化实现“简单、复用开源模板、快速上线”的目标，决定**彻底放弃 Electron 桌面端封装**，将前端转化为**纯 Web 线上应用**架构。

本设计基于原有的 `ui_and_desktop_guide.md` 视觉与交互规范，将其平移至纯 Web 技术栈中实现。

## 2. 架构与技术选型 (Architecture & Tech Stack)
* **前端框架**：Next.js (基于 App Router)。开箱即用，路由系统完善，生态极其丰富，利于快速集成各种开源高级组件模板。
* **样式与组件库**：Tailwind CSS + Shadcn UI。
* **前后端分离与代理**：
  * 保留原有的 Node.js / Express 独立后端（含 Socket.io）。
  * 纯 Web 模式下跨域问题通过配置 Next.js 的 `next.config.js` 中的 `rewrites`，将前端的 `/api` 和 `/socket.io` 请求无缝反向代理至 Node.js 后端。
* **部署方案**：Vercel（前端） + 云服务器/Railway（后端）。

## 3. 视觉规范 (Visual Guidelines)
全面贯彻 **Apple Fluent Glassmorphism**（苹果风毛玻璃）风格：
* **双主题**：系统级深度整合 Dark / Light Mode 切换。
* **弥散背景**：底层加入慢速呼吸动画的 Mesh Gradients 渐变流光球。
* **组件重塑**：所有 Shadcn 原生组件的硬朗实线边框移除，替换为半透明发光细边框，容器背景替换为带 `backdrop-blur` 属性的毛玻璃材质。

## 4. 核心布局与交互 (Layout & Interactions)
* **两栖自适应布局**：
  1. **专注模式 (Focus Mode)**：极窄侧边栏 (10%) + 居中对话工作区 (60%) + 右侧 Agent 参数面板 (30%)。
  2. **多窗分栏模式 (Workspace Mode)**：打开多个内容面板时，系统无缝转为列式拖拽布局。原右侧参数面板自动隐身，并在 Chat Card 标题栏暴露“设置”抽屉开关，确保主工作区宽度最大化。
* **Slash Command 交互**：
  * 对话输入框通过 Shadcn 的 `Command` Primitive 实现 `/` 快捷键联想。
  * 动态拉取并挂载 `/skill <skillId>`。
  * Chat 视图顶部渲染“技能徽章 (Active Badge)”，可一键取消当前挂载的系统指令。

## 5. 后续计划
撰写详细的 Implementation Plan 并开展 Next.js 框架的初始化与原有前端代码的迁移工作。
