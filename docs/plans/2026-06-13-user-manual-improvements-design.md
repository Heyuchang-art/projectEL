# User Manual Improvements Design Document

**Date:** 2026-06-13  
**Topic:** Supplement USER_MANUAL.md content, fix diagrams using Mermaid, and standardize styling/formatting.

---

## 1. Diagrams Redesign (using Mermaid)

All layout and workflow diagrams will be converted to Mermaid charts to prevent monospace font alignment issues with Chinese characters and emojis.

### 1.1 Main Interface Layout
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

### 1.2 ChatCard UI Structure
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

### 1.3 Canvas Workflow Logic
```mermaid
graph TD
    Start(["开始 (例如: qq_message 或 read_file)"]) --> LLM["LLM 调用 (处理文本)"]
    LLM --> Cond{"条件判断<br/>(例如: 是否包含公式)"}
    
    Cond -- True --> KnowWrite["知识库写入 (保存到 Wiki/笔记)"]
    Cond -- False --> End(["结束"])
    
    KnowWrite --> QQPush["QQ推送 (发送结果给用户)"]
    QQPush --> End
```

### 1.4 Knowledge Card Structure
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

---

## 2. Text Content Updates

### 2.1 Chat Card
- Update **Section 2.2** layout description.
- Update **Section 2.6** model select description (dropdown inside header, thinking level dropdown conditional visibility and states: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`).
- Update **Section 2.7** visual model processing details (automatic fallback to visual model for description extraction).

### 2.2 Canvas Card
- Update **Section 3.4** editing actions with hover delete button, keyboard **Delete** key shortcut, and **Ctrl + D** node copy shortcut.
- Update **Section 3.6** validation criteria list.

### 2.3 Knowledge Card
- Update **Section 4.1 & 4.3** with description of Wiki card Markdown formatting (tables, code blocks, lists, quotes, styled bold/links).

### 2.4 Settings Panel (Section 6)
- Remove active model selection from Settings Panel text (Section 6.4).
- Add details on Switch Toggles for providers & models.
- Add details on Key validation checking ("未配置 Key" and "已禁用" status badges).
- Add details on adding models inline (+ 添加模型) and deleting models inline.
- Add details on custom provider wizard (+ 添加自定义服务商).
- Add details on default provider deletion and restoration (Restore button).
- Note that OpenRouter has been removed as a default provider.

---

## 3. Formatting Standards
- Standardize heading levels.
- Fix spacing between Chinese and English text (e.g., "API Key" instead of "APIKey", "Chat 卡" instead of "Chat卡").
- Format tables, code blocks, and warning alerts consistently.
