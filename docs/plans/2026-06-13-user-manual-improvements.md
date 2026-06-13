# User Manual Improvements Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Supplement USER_MANUAL.md with the latest refactored features, replace outdated ASCII diagrams with Mermaid charts, and standardize formatting.

**Architecture:** We will systematically update the Markdown file section by section. Outdated ASCII wireframes will be replaced with clean, modern Mermaid diagrams. Subsections will be rewritten to accurately reflect recent Settings Panel and ChatCard header changes.

**Tech Stack:** Markdown, Mermaid

---

### Task 1: Update Section 1 (Quick Start & Layout)

**Files:**
- Modify: `USER_MANUAL.md`

**Step 1: Check Section 1 baseline**
Read lines 1 to 127 in `USER_MANUAL.md` to locate the ASCII diagram in Section 1.6.

**Step 2: Replace ASCII diagram with Mermaid layout chart**
Replace the ASCII diagram in Section 1.6 (lines 105-120) with:
```mermaid
graph TD
    subgraph MainLayout ["系统主界面布局"]
        direction LR
        Sidebar["左侧导航栏 (Sidebar)<br/>- 💬 Chat (对话卡)<br/>- 🎨 Canvas (画布卡)<br/>- 📚 Know. (知识库)<br/>- 🤖 QQ Bot (机器人)<br/>- ⚙️ 设置 (齿轮)"]
        
        subgraph Workspace ["工作区 (Workspace)"]
            direction TB
            Header["顶部控制栏 (切换知识库)"]
            subgraph Cards ["卡片区域 (支持自由拖拽/调整宽度)"]
                ChatCard["对话卡片 (Chat)"]
                CanvasCard["画布卡片 (Canvas)"]
                KnowCard["知识库卡片 (Knowledge)"]
                BotCard["QQ机器人卡片 (QQ Bot)"]
            end
            Header --> Cards
        end
        Sidebar --> Workspace
    end
```

**Step 3: Verify Section 1 changes**
Ensure the layout sections render clean text and the Mermaid block compiles with no syntax errors.

**Step 4: Commit**
```bash
git add USER_MANUAL.md
git commit -m "docs: update section 1 layout diagram in USER_MANUAL.md"
```

---

### Task 2: Update Section 2 (Chat Console)

**Files:**
- Modify: `USER_MANUAL.md`

**Step 1: Locate Section 2 details**
Read lines 128 to 227 in `USER_MANUAL.md` to locate Section 2.2 and Section 2.6.

**Step 2: Update Section 2.2 UI structure and 2.6 model selection text**
1. Replace Section 2.2 ASCII diagram with:
```mermaid
graph TD
    subgraph ChatCardUI ["对话卡片 (Chat) 结构"]
        direction TB
        Header["第一行：卡片头部拖拽栏 (Header)<br/>- 💬 标题 (Xaihi Learning Console)<br/>- 模型选择 (下拉菜单)<br/>- 思考等级 (推理模型显示下拉菜单)<br/>- 🗑️ 清空历史 / ⏹️ 中断 / ❌ 关闭"]
        
        RoleSessionBar["第二行：角色与会话管理栏<br/>- 预设角色选择 (Xaihi / Coder / QQ Tutor)<br/>- 会话管理 (新建 / 切换 / 重命名 / 删除)"]
        
        MessageArea["第三行：消息展示区 (Message Area)<br/>- 渲染 Markdown 格式文本<br/>- 支持深度思考折叠显示 (思考过程)"]
        
        InputArea["第四行：底部输入区 (Input Area)<br/>- 💬 文本输入框 (Enter 发送, Shift+Enter 换行)<br/>- 📎 附件/图片上传按钮<br/>- 🚀 发送按钮"]
        
        Header --> RoleSessionBar --> MessageArea --> InputArea
    end
```
2. Rewrite Section 2.6:
- Instruct users to select the active model directly in the dropdown within the ChatCard header.
- Explain the conditional reasoning selector (`off`/`minimal`/`low`/`medium`/`high`/`xhigh`), which appears only when the selected model supports reasoning.
3. Update Section 2.7 with automatic vision processing description.

**Step 3: Verify Section 2 changes**
Confirm model selection instructions match the actual frontend code.

**Step 4: Commit**
```bash
git add USER_MANUAL.md
git commit -m "docs: update chat card model selector and structure in USER_MANUAL.md"
```

---

### Task 3: Update Section 3 (Workflow Canvas)

**Files:**
- Modify: `USER_MANUAL.md`

**Step 1: Check Section 3 baseline**
Read lines 228 to 331 in `USER_MANUAL.md` to locate the flow diagram in Section 3.2.

**Step 2: Replace ASCII diagram and update shortcuts**
1. Replace Section 3.2 ASCII diagram with:
```mermaid
graph TD
    Start(["开始 (例如: qq_message 或 read_file)"]) --> LLM["LLM 调用 (处理文本)"]
    LLM --> Cond{"条件判断<br/>(例如: 是否包含公式)"}
    
    Cond -- True --> KnowWrite["知识库写入 (保存到 Wiki/笔记)"]
    Cond -- False --> End(["结束"])
    
    KnowWrite --> QQPush["QQ推送 (发送结果给用户)"]
    QQPush --> End
```
2. Update Section 3.4: Add hover delete button description and keyboard **Delete** key shortcut. Add **Ctrl + D** node duplicate shortcut.
3. Update Section 3.6: Supplement validation check details (type mismatch, unreachable nodes, missing parameters, infinite loop check).

**Step 3: Verify Section 3 changes**
Check that the flow logic and keyboard shortcuts are documented accurately.

**Step 4: Commit**
```bash
git add USER_MANUAL.md
git commit -m "docs: update canvas workflows and shortcuts in USER_MANUAL.md"
```

---

### Task 4: Update Section 4 (Knowledge Base)

**Files:**
- Modify: `USER_MANUAL.md`

**Step 1: Check Section 4 baseline**
Read lines 332 to 449 in `USER_MANUAL.md` to locate the diagram in Section 4.2.

**Step 2: Replace ASCII diagram and document Markdown support**
1. Replace Section 4.2 ASCII diagram with:
```mermaid
graph TD
    subgraph KnowUI ["知识库卡片 (Knowledge) 结构"]
        direction TB
        Tabs["顶部功能标签<br/>- 知识库浏览器 | 新建卡片 | 归档审核"]
        
        Search["搜索过滤区<br/>- 🔍 搜索卡片内容/标签"]
        
        List["双轨制记忆列表<br/>- Layer 3: Wiki 卡片 (置信度数值、衰减进度条、生命周期状态)<br/>- Layer 2: 人工笔记 (基于 SM-2 算法复习)"]
        
        Tabs --> Search --> List
    end
```
2. Update Section 4.1 & 4.3: Document the Markdown rendering support in Wiki Cards (tables, code blocks, lists, quotes, styled bold/links).

**Step 3: Verify Section 4 changes**
Verify that GFM rendering details are accurate in the wiki description.

**Step 4: Commit**
```bash
git add USER_MANUAL.md
git commit -m "docs: update knowledge base UI diagram and markdown details in USER_MANUAL.md"
```

---

### Task 5: Rewrite Section 6 (System Settings)

**Files:**
- Modify: `USER_MANUAL.md`

**Step 1: Locate Section 6 details**
Read lines 537 to 577 in `USER_MANUAL.md`.

**Step 2: Rewrite Section 6**
Replace Section 6 completely to cover:
- Active model configuration has moved to ChatCard header.
- Switch toggles for enabling/disabling providers and models.
- Key presence checking ("未配置 Key" and "已禁用" badges).
- Collapsible model list display.
- Adding and deleting individual models inline.
- Custom provider creation via form modal.
- Built-in provider deletion and restoration.
- Note that OpenRouter has been removed as a default provider.

**Step 3: Verify Section 6 changes**
Double check settings panel descriptions against `SettingsPanel.tsx`.

**Step 4: Commit**
```bash
git add USER_MANUAL.md
git commit -m "docs: rewrite system settings section in USER_MANUAL.md"
```

---

### Task 6: Final Review & Formatting Pass

**Files:**
- Modify: `USER_MANUAL.md`

**Step 1: Standardize formatting**
Check heading levels, standard spacing between Chinese and English text, list styles, and tables. Ensure no leftover broken ASCII art lines exist.

**Step 2: Run verification**
Read the final file structure and run the project build to ensure no regression or errors.

**Step 3: Commit**
```bash
git add USER_MANUAL.md
git commit -m "docs: complete final formatting pass on USER_MANUAL.md"
```
