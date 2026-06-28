# QQ Bot Personal Learning Assistant Refactor

> 状态: ✅ 已确认
> 日期: 2026-06-11
> 目标: 移除群维度功能（测验/排行/群管），保留群聊AI回复+知识提取，强化个人学习助理定位

---

## 一、需求背景

当前 `qq-adapter.ts`（1204行）在 `84c72a6` 提交时引入了完整的群聊机器人功能（测验系统、排行榜、群管理）。但项目定位是**个人学习智能助理**，群聊应仅用于被动 AI 回复和知识提取，不需要群维度的测验竞争、排行和管理功能。

## 二、变更清单

### 2.1 删除文件

| 文件 | 说明 |
|:---|:---|
| `backend/src/qq-quiz-service.ts` | 群测验系统（463行），含 SM-2 出题、评分、排行榜、群维度统计 |

### 2.2 修改文件

| 文件 | 变更 |
|:---|:---|
| `backend/src/qq-adapter.ts` | 删除所有测验/排行/群管代码，新增私聊 `/stats` 个人统计 |
| `backend/src/server.ts` | 移除 quizService 初始化、群测验路由、report-generator 中排行榜相关 |
| `frontend/src/components/QQBotCard.tsx` | 删除"活跃排行""热门话题""答题统计"面板，保留"连接状态""薄弱知识点" |
| `qq-bot-config.json` | 删除 `quiz.*` 和 `groupSync.*` 配置项 |

### 2.3 不修改文件

| 文件 | 原因 |
|:---|:---|
| `backend/src/qq-renderer.ts` | 公式渲染，与群/私聊无关 |
| `backend/src/qq-chat-refiner.ts` | 群聊知识提取，保留 |
| `backend/src/qq-logger.ts` | 日志系统，保留 |
| `napcat/` | NapCat Shell 部署，本次不涉及 |

## 三、qq-adapter.ts 详细变更

### 3.1 删除（~400行）

```
接口/类型:
  - GroupContext 接口 (L103-111)
  - groupSync 配置字段

类/方法:
  - QQAIService:
      - getGroupContext()
      - addMessageToContext()
      - maybeRefineContext()
      - isQuizActive()
      - submitQuizAnswer()
      - handleGroupMessage() — 完整群聊 AI 处理
      - buildContextPrefix()
  - OneBotMessageHandler:
      - handleGroupMessage() — 完整群消息路由

命令:
  - /quiz-start, /quiz-stop, /quiz-stats
  - /stats (群维度版)

依赖:
  - ChatRefiner 实例
  - QuizService 实例
  - KnowledgeBaseService（quizService 依赖）
```

### 3.2 保留

```
- QQConnection 类（WebSocket 连接管理）
- QQWebSocketServer 类（WS 服务器）
- OneBotMessageHandler:
    - handlePrivateMessage() — 私聊消息处理
    - checkRateLimit()
- QQAIService:
    - handlePrivateMessage() — 私聊 AI 回复
    - handleCommand() — 仅保留 /help, /stats（新个人版）
    - collectResponse() — 流式 AI 响应收集
    - getSessionId(), runQueue()
- markdownToPlainText(), chunkMessage()
- sanitizeInput(), getFriendlyErrorMessage()
- 所有 OneBot 协议类型
```

### 3.3 新增私聊 `/stats`

用户在与 Bot 私聊中发送 `/stats`，返回个人学习概览：

```
Personal Learning Stats
━━━━━━━━━━━━━━━━━━━━━━
Knowledge cards: 42
Review notes:     8
Weak concepts:    3
Last review:      2026-06-10
```

数据来源：`KnowledgeBaseService` 的统计 API（`GET /api/knowledge/stats`），通过 `kbService.getStats()` 获取。

## 四、QQBotCard.tsx 详细变更

### 删除的面板

```
- SectionHeader: "答题统计" + TrendMiniChart
- SectionHeader: "活跃排行" + leaderboard list
- SectionHeader: "热门话题" + topic tags
```

### 保留的面板

```
- Header: QQ Bot 监控 (+ 在线状态指示灯 + 启停按钮)
- SectionHeader: "连接状态" + 账号列表
- SectionHeader: "薄弱知识点" + 置信度列表
```

### 面板布局（最终）

```
┌──────────────────────────────────┐
│ QQ Bot 监控        ●在线  ■停止  │
├──────────────────────────────────┤
│ ▸ 连接状态                       │
│   QQ 123456  在线 (昵称)         │
│                                  │
│ ▸ 薄弱知识点                     │
│   动态规划      置信度 0.12      │
│   红黑树        置信度 0.18      │
├──────────────────────────────────┤
│ 自动刷新 (30s)    更新于 14:30   │
└──────────────────────────────────┘
```

## 五、qq-bot-config.json 变更

```json
// 删除以下配置项:
{
  "quiz": {
    "enabled": true,
    "questionsPerRound": 3,
    "xpPerGrade": { "0": 0, "1": 1, "2": 3, "3": 5, "4": 10 }
  },
  "groupSync": {
    "enabled": true,
    "allowedGroupIds": []
  }
}

// 保留:
{
  "enabled": false,
  "wsPath": "/qq/ws",
  "accessToken": "",
  "dedicatedPresetId": "qq-tutor",
  "maxGroupContextMessages": 20,
  "rateLimit": { "maxMessages": 5, "windowSeconds": 10 },
  "triggerKeywords": ["@bot", "/ai", "/ask"],
  "rendering": {
    "formulaImageWidth": 800,
    "maxMessageLength": 1500,
    "messageChunkOverlap": 100
  }
}
```

`maxGroupContextMessages` 保留——用于群聊知识提取时截取上下文窗口。

## 六、server.ts 变更

- 删除 `QuizService` 实例化 + 依赖注入
- 删除 `quizService.setSendMessage()` 回调
- 简化 `handleCommand()` → 仅 `/help` + `/stats`（个人版）
- `initQQAdapter()` 参数：移除 `kbService`（不再需要传给 quizService）

## 七、不包含的变更

- ❌ NapCat 部署流程
- ❌ qq-renderer.ts, qq-chat-refiner.ts, qq-logger.ts
- ❌ 前端布局/样式重构
- ❌ Pi Agent / 知识库 / 工作流模块

---

*设计版本: 2026-06-11*
