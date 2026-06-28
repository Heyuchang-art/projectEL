# Session Naming & Rename — Design Spec

> 2026-06-11 | Status: approved  
> Scope: Session naming on create + rename existing sessions

---

## Problem

1. New sessions get auto-generated names like `session-1718123456789` or "(新会话)"
2. Users have no way to name a session at creation time
3. Users have no way to rename an existing session

## Design

### 1. Create Session with Name

**UI**: Click "新建" button → lightweight Popover card appears below the button:

```
┌──────────────────────────┐
│  新建会话                │
│  ┌────────────────────┐  │
│  │ 输入名称...        │  │
│  └────────────────────┘  │
│  预设: [下拉选择器]      │
│  [取消]          [创建]  │
└──────────────────────────┘
```

- Name input is optional — if empty, defaults to "新会话"
- Selecting a preset fills the name placeholder with the preset's name
- "创建" triggers `createSession(name, presetId)`
- Click outside or "取消" closes the popover

### 2. Rename Existing Session

**UI**: Pencil/edit icon next to the session name in ChatCard header. Click → inline text input replaces the session dropdown temporarily:

```
会话: [我的会话 ▼] [✎]
         ↓ 点击编辑图标
会话: [____________] [✓] [✕]  ← inline input, Enter/✓ saves, Esc/✕ cancels
```

### 3. Backend API Changes

**`POST /api/sessions/create`** — add optional `name`:
```json
{ "sessionId": "...", "presetId": "...", "name": "我的会话" }
```

Backend writes name into session header/metadata via `SessionManager`.

**`PUT /api/sessions/:id/rename`** — new endpoint:
```json
{ "name": "新名称" }
```

Updates the session name in the session manager and on disk.

### 4. Files Touched

| File | Change |
|------|--------|
| `backend/src/server.ts` | Add `name` to `/api/sessions/create`; add `PUT /api/sessions/:id/rename` |
| `frontend/src/contexts/ChatContext.tsx` | `createSession(name?, presetId?)`; new `renameSession(id, name)` |
| `frontend/src/components/ChatCard.tsx` | New-session popover; rename icon + inline input |

### 5. Error Handling

- Empty name → default to "新会话" on create, no-op on rename
- Rename non-existent session → 404, show toast
- Network error → alert (matches existing pattern in ChatContext)

---

*Approved: 2026-06-11*
