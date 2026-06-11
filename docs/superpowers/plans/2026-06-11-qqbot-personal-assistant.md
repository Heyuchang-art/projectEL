# QQ Bot Personal Assistant Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip group-dimension features (quiz, leaderboard, group admin) from QQ Bot while keeping group AI responses and knowledge extraction.

**Architecture:** Remove `qq-quiz-service.ts` entirely. Simplify `qq-adapter.ts` to private-chat-first with passive group AI. Slim `QQBotCard.tsx` to connection status + weak concepts only. Add private `/stats` command.

**Tech Stack:** TypeScript, React, Express

---

## File Map

| Action | File | Responsibility |
|:---|:---|:---|
| Delete | `backend/src/qq-quiz-service.ts` | Remove quiz system entirely |
| Modify | `backend/src/qq-adapter.ts` | Strip group quiz/leaderboard/admin, add private /stats |
| Modify | `backend/src/server.ts` | Remove QuizService init + references |
| Modify | `frontend/src/components/QQBotCard.tsx` | Remove leaderboard/quiz/topics panels |
| Modify | `qq-bot-config.json` | Remove quiz.* and groupSync.* |

---

### Task 1: Delete quiz service + update config

- [ ] **Step 1: Delete qq-quiz-service.ts**

```bash
git rm backend/src/qq-quiz-service.ts
```

- [ ] **Step 2: Update qq-bot-config.json**

Remove `quiz` and `groupSync` blocks:

```json
{
  "enabled": false,
  "wsPath": "/qq/ws",
  "accessToken": "",
  "dedicatedPresetId": "qq-tutor",
  "maxGroupContextMessages": 20,
  "rateLimit": {
    "maxMessages": 5,
    "windowSeconds": 10
  },
  "triggerKeywords": ["@bot", "/ai", "/ask"],
  "rendering": {
    "formulaImageWidth": 800,
    "maxMessageLength": 1500,
    "messageChunkOverlap": 100
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/qq-quiz-service.ts qq-bot-config.json
git commit -m "feat: remove quiz service, simplify QQ bot config

- Delete qq-quiz-service.ts (group quiz/leaderboard system)
- Remove quiz.* and groupSync.* from qq-bot-config.json"
```

### Task 2: Simplify qq-adapter.ts

- [ ] **Step 1: Remove group quiz/admin code**

Remove these interfaces/methods:
- `GroupContext` interface
- `QQAIService.getGroupContext()`, `addMessageToContext()`, `maybeRefineContext()`
- `QQAIService.isQuizActive()`, `submitQuizAnswer()`
- `QQAIService.handleGroupMessage()` (the full AI handler)
- `OneBotMessageHandler.handleGroupMessage()`
- Quiz command cases from `handleCommand()` (/quiz-start, /quiz-stop, /quiz-stats)
- `ChatRefiner` import and instance
- `QuizService` import
- `KnowledgeBaseService` import (from qq-adapter — now only in server.ts)

- [ ] **Step 2: Add private /stats command**

Add to `handleCommand()`:

```typescript
      case '/stats':
        if (groupId) {
          response = 'Personal stats are available in private chat. Send /stats to me directly.';
        } else {
          try {
            const stats = await kbService.getStats();
            response = [
              'Personal Learning Stats',
              '━━━━━━━━━━━━━━━━━━━━━━',
              `Knowledge cards: ${stats.totalCards ?? 'N/A'}`,
              `Review notes:     ${stats.totalNotes ?? 'N/A'}`,
              `Weak concepts:    ${stats.weakConcepts ?? 'N/A'}`,
              `Last review:      ${stats.lastReviewDate ?? 'N/A'}`,
            ].join('\n');
          } catch {
            response = 'Unable to fetch stats. Please try again later.';
          }
        }
        break;
```

- [ ] **Step 3: Keep group AI response + context — simplified**

Replace the removed `handleGroupMessage` in `QQAIService` with a simplified version that:
- Only responds when `@mentioned` or trigger keyword matched (already handled by `OneBotMessageHandler`)
- Adds message to context (keep `addMessageToContext`)
- Calls `collectResponse()` with group context prefix
- Sends response chunks via `sendApiCall('send_group_msg')`

- [ ] **Step 4: Update initQQAdapter signature**

Remove `kbService` parameter. Remove `workspaceCwd` parameter (only needed for quizService).

- [ ] **Step 5: TypeScript compile check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/qq-adapter.ts
git commit -m "feat: simplify QQ adapter to personal assistant

- Remove group quiz/leaderboard/admin code
- Remove quiz command handling
- Remove ChatRefiner import
- Add private /stats command (personal learning stats)
- Keep group AI responses + context + knowledge extraction"
```

### Task 3: Update server.ts

- [ ] **Step 1: Remove QuizService references**

- Remove `QuizService` import
- Remove quizService instantiation
- Remove `quizService.setSendMessage()` callback
- Update `initQQAdapter()` call: remove `kbService` and `workspaceCwd` params

- [ ] **Step 2: Remove ReportGenerator quiz references**

If `qq-report-generator.ts` uses `QuizService` data, remove those sections.

- [ ] **Step 3: TypeScript compile check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "fix: remove QuizService references from server.ts"
```

### Task 4: Simplify QQBotCard.tsx

- [ ] **Step 1: Remove quiz/leaderboard/topics panels**

Remove:
- `report` state and `fetchData`'s report fetching
- "答题统计" section + `TrendMiniChart`
- "活跃排行" section
- "热门话题" section
- `report` type interface `WeeklyReport`
- Footer "更新于" timestamp (report-based)

- [ ] **Step 2: Keep connection status + weak concepts**

Retain:
- Header with start/stop buttons
- Connection status section
- Weak concepts section
- Auto-refresh (30s)

- [ ] **Step 3: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/QQBotCard.tsx
git commit -m "feat: simplify QQBotCard to personal learning view

- Remove leaderboard, quiz stats, hot topics panels
- Keep connection status and weak concepts
- Cleaner personal learning assistant focus"
```

---

## Execution Order

```
Task 1 (delete quiz + config)
  -> Task 2 (qq-adapter.ts rewrite)
    -> Task 3 (server.ts cleanup)
      -> Task 4 (QQBotCard.tsx cleanup)
```

Sequential — each depends on the previous for clean compilation.
