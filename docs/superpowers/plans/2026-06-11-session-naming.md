# Session Naming & Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to name sessions at creation time and rename existing sessions from the ChatCard UI.

**Architecture:** Three-layer change — backend adds `name` to create endpoint and a new rename endpoint; ChatContext gets `createSession(name, presetId)` and `renameSession(id, name)`; ChatCard gets a popover for new-session naming and an inline rename trigger. Session names are persisted via `SessionManager.appendSessionInfo(name)` in the SDK.

**Tech Stack:** TypeScript, React, Express, Pi Coding Agent SDK (SessionManager)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/server.ts` | Modify | Add `name` param to `POST /api/sessions/create`; add `PUT /api/sessions/:id/rename` |
| `frontend/src/contexts/ChatContext.tsx` | Modify | Update `createSession` signature; add `renameSession`; add `renamingSessionId` state; expose in context |
| `frontend/src/components/ChatCard.tsx` | Modify | New-session popover card; rename trigger button + inline input |

---

### Task 1: Backend — Accept name on session create

**Files:**
- Modify: `backend/src/server.ts:623-639`

- [ ] **Step 1: Add `name` to POST /api/sessions/create**

Replace the `POST /api/sessions/create` handler (lines 623-639) with:

```typescript
// 2. 新建会话
app.post("/api/sessions/create", async (req, res) => {
  const { presetId, sessionId, name } = req.body;
  const sId = sessionId || randomUUID();
  try {
    const session = await getOrCreateSession(sId, presetId);
    if (name && name.trim()) {
      session.sessionManager.appendSessionInfo(name.trim());
    }
    res.json({
      success: true,
      sessionId: sId,
      presetId,
      model: session.model?.id,
      thinkingLevel: session.thinkingLevel
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: accept optional name param on POST /api/sessions/create"
```

---

### Task 2: Backend — Add rename session endpoint

**Files:**
- Modify: `backend/src/server.ts` (after the delete endpoint, around line 682)

- [ ] **Step 1: Add PUT /api/sessions/:id/rename**

Insert after the delete session endpoint (after line 682):

```typescript
// 重命名会话
app.put("/api/sessions/:id/rename", async (req, res) => {
  const sessionId = req.params.id;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "名称不能为空" });
  }
  try {
    // Ensure session is loaded (may be on disk but not in memory)
    const session = await getOrCreateSession(sessionId);
    session.sessionManager.appendSessionInfo(name.trim());
    res.json({ success: true, sessionId, name: name.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: add PUT /api/sessions/:id/rename endpoint"
```

---

### Task 3: Frontend Context — Update createSession, add renameSession

**Files:**
- Modify: `frontend/src/contexts/ChatContext.tsx`

- [ ] **Step 1: Update the ChatContextProps interface**

Find the `ChatContextProps` interface (around line 47-74) and update `createSession` signature and add `renameSession`:

```typescript
interface ChatContextProps {
  // ... existing props unchanged ...
  createSession: (name?: string, presetId?: string) => Promise<void>;
  renameSession: (sessionId: string, name: string) => Promise<void>;
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Update createSession function**

Replace the existing `createSession` function (lines 537-557) with:

```typescript
const createSession = async (name?: string, presetId?: string) => {
  try {
    const newSessionId = `session-${Date.now()}`;
    const body: any = { sessionId: newSessionId, presetId };
    if (name && name.trim()) {
      body.name = name.trim();
    }
    const response = await fetch('http://localhost:3000/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.success) {
      await fetchSessions();
      setSessionId(newSessionId);
      setActivePresetId(presetId || null);
      if (data.thinkingLevel) setThinkingLevel(data.thinkingLevel);
      if (data.model) setActiveModel(data.model);
    }
  } catch (err) {
    console.error('Failed to create session:', err);
    alert('创建会话失败，请检查网络连接或后端服务是否正常。');
  }
};
```

- [ ] **Step 3: Add renameSession function**

Add after `deleteSession` (after line 577):

```typescript
const renameSession = async (sId: string, name: string) => {
  if (!name.trim()) return;
  try {
    const response = await fetch(`http://localhost:3000/api/sessions/${sId}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await response.json();
    if (data.success) {
      await fetchSessions();
    }
  } catch (err) {
    console.error('Failed to rename session:', err);
    alert('重命名会话失败，请检查网络连接或后端服务是否正常。');
  }
};
```

- [ ] **Step 4: Expose renameSession in context provider value**

In the `<ChatContext.Provider value={{...}}>` block (around lines 596-624), add `renameSession`:

```typescript
return (
  <ChatContext.Provider value={{
    // ... existing entries ...
    createSession,
    renameSession,   // <-- add this
    deleteSession,
    // ... rest unchanged ...
  }}>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/ChatContext.tsx
git commit -m "feat: add name param to createSession, add renameSession to ChatContext"
```

---

### Task 4: Frontend UI — New-session popover in ChatCard

**Files:**
- Modify: `frontend/src/components/ChatCard.tsx`

- [ ] **Step 1: Add popover state and renameSession to destructuring**

At the top of the `ChatCard` component (line 7-28), add `renameSession` to the destructured context and add local state for the popover:

```typescript
export default function ChatCard() {
  const {
    messages,
    inputText,
    setInputText,
    isStreaming,
    activeModel,
    thinkingLevel,
    selectedAttachments,
    sessionId,
    sessions,
    presets,
    activePresetId,
    sendMessage,
    abort,
    clearSession,
    uploadAttachment,
    removeAttachment,
    switchSession,
    createSession,
    deleteSession,
    renameSession,        // <-- add this
  } = useChat();

  const { toggleCard } = useWorkspace();

  // New-session popover state
  const [showNewSessionPopover, setShowNewSessionPopover] = React.useState(false);
  const [newSessionName, setNewSessionName] = React.useState('');
  const [newSessionPresetId, setNewSessionPresetId] = React.useState('');
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  // Close popover on outside click
  React.useEffect(() => {
    if (!showNewSessionPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowNewSessionPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewSessionPopover]);
```

- [ ] **Step 2: Add handlers for popover actions**

Add after the `useEffect` for keyboard shortcuts (after line 86):

```typescript
const handleCreateWithName = () => {
  createSession(newSessionName || undefined, newSessionPresetId || undefined);
  setShowNewSessionPopover(false);
  setNewSessionName('');
  setNewSessionPresetId('');
};

const handleOpenNewSessionPopover = () => {
  setNewSessionName('');
  setNewSessionPresetId(activePresetId || '');
  setShowNewSessionPopover(true);
};
```

- [ ] **Step 3: Replace the "新建" button with popover**

Find the "新建" button (around lines 257-275) and replace it with:

```tsx
{/* New Session Button with Popover */}
<div style={{ position: 'relative' }} ref={popoverRef}>
  <button
    onClick={handleOpenNewSessionPopover}
    style={{
      backgroundColor: '#000000',
      border: '2px solid #333333',
      color: '#ffffff',
      fontSize: '10px',
      fontFamily: 'var(--font-mono)',
      padding: '2px 6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      boxShadow: '1px 1px 0px #ffffff'
    }}
    title="新建会话"
  >
    <Plus size={10} /> 新建
  </button>

  {showNewSessionPopover && (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: '0',
      marginTop: '6px',
      backgroundColor: '#0c0c0c',
      border: '2px solid #ffffff',
      boxShadow: '4px 4px 0px #000000',
      padding: '12px',
      zIndex: 200,
      minWidth: '220px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#ffffff', fontWeight: 'bold' }}>
        新建会话
      </span>
      <input
        type="text"
        value={newSessionName}
        onChange={(e) => setNewSessionName(e.target.value)}
        placeholder="输入名称（可选）"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateWithName();
          if (e.key === 'Escape') setShowNewSessionPopover(false);
        }}
        style={{
          backgroundColor: '#000000',
          border: '2px solid #333333',
          color: '#ffffff',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          padding: '6px 8px',
          outline: 'none',
          width: '100%'
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>预设:</span>
        <select
          value={newSessionPresetId}
          onChange={(e) => setNewSessionPresetId(e.target.value)}
          style={{
            backgroundColor: '#000000',
            border: '2px solid #333333',
            color: '#ffffff',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 4px',
            outline: 'none',
            cursor: 'pointer',
            flex: 1
          }}
        >
          <option value="">(无预设)</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowNewSessionPopover(false)}
          style={{
            backgroundColor: '#000000',
            border: '2px solid #333333',
            color: '#ffffff',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            cursor: 'pointer'
          }}
        >
          取消
        </button>
        <button
          onClick={handleCreateWithName}
          style={{
            backgroundColor: 'var(--primary)',
            border: '2px solid #ffffff',
            color: '#000000',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'bold',
            padding: '2px 8px',
            cursor: 'pointer',
            boxShadow: '2px 2px 0px #ffffff'
          }}
        >
          创建
        </button>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatCard.tsx
git commit -m "feat: add new-session naming popover in ChatCard"
```

---

### Task 5: Frontend UI — Rename button in ChatCard header

**Files:**
- Modify: `frontend/src/components/ChatCard.tsx`

- [ ] **Step 1: Add rename state**

Add after the existing popover state (after the `useEffect` for outside-click added in Task 4):

```typescript
// Rename state
const [isRenaming, setIsRenaming] = React.useState(false);
const [renameValue, setRenameValue] = React.useState('');
const renameInputRef = React.useRef<HTMLInputElement | null>(null);
```

- [ ] **Step 2: Add rename handler**

```typescript
const handleStartRename = () => {
  const currentSession = sessions.find((s: any) => s.id === sessionId);
  setRenameValue(currentSession?.name || '');
  setIsRenaming(true);
  setTimeout(() => renameInputRef.current?.focus(), 50);
};

const handleSubmitRename = () => {
  if (renameValue.trim()) {
    renameSession(sessionId, renameValue.trim());
  }
  setIsRenaming(false);
};

const handleCancelRename = () => {
  setIsRenaming(false);
};
```

- [ ] **Step 3: Replace the session selector area with inline rename**

Find the session selector line (around lines 234-254) — the "会话:" label + `<select>` combination. Replace the whole block from "会话:" label through the select element with:

```tsx
{/* Session Switcher with Rename */}
<span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>会话:</span>
{isRenaming ? (
  <>
    <input
      ref={renameInputRef}
      type="text"
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmitRename();
        if (e.key === 'Escape') handleCancelRename();
      }}
      style={{
        backgroundColor: '#000000',
        border: '2px solid var(--primary)',
        color: '#ffffff',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        padding: '2px 4px',
        outline: 'none',
        maxWidth: '150px'
      }}
    />
    <button
      onClick={handleSubmitRename}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        color: 'var(--success)',
        cursor: 'pointer',
        fontSize: '12px',
        padding: '0 2px'
      }}
      title="确认"
    >
      ✓
    </button>
    <button
      onClick={handleCancelRename}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        color: 'var(--error)',
        cursor: 'pointer',
        fontSize: '12px',
        padding: '0 2px'
      }}
      title="取消"
    >
      ✕
    </button>
  </>
) : (
  <>
    <select
      value={sessionId}
      onChange={(e) => switchSession(e.target.value)}
      style={{
        backgroundColor: '#000000',
        border: '2px solid #333333',
        color: '#ffffff',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        padding: '2px 4px',
        borderRadius: '0',
        outline: 'none',
        cursor: 'pointer',
        maxWidth: '150px'
      }}
    >
      {sessions.map((s: any) => (
        <option key={s.id} value={s.id}>{s.name || s.id}</option>
      ))}
    </select>
    <button
      onClick={handleStartRename}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        color: '#555555',
        cursor: 'pointer',
        fontSize: '11px',
        padding: '0 2px',
        display: 'flex',
        alignItems: 'center'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--secondary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#555555'; }}
      title="重命名会话"
    >
      ✎
    </button>
  </>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatCard.tsx
git commit -m "feat: add inline session rename in ChatCard header"
```

---

### Task 6: Integration test — verify end-to-end flow

- [ ] **Step 1: Start backend and test create with name**

```bash
# In one terminal:
cd backend && npx tsx src/server.ts

# In another terminal, test create with name:
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-named-session","name":"我的测试会话"}'
```

Expected response:
```json
{"success":true,"sessionId":"test-named-session","presetId":null,...}
```

- [ ] **Step 2: Verify name appears in sessions list**

```bash
curl http://localhost:3000/api/sessions
```

Expected: The response includes the test session with `"name":"我的测试会话"`.

- [ ] **Step 3: Test rename**

```bash
curl -X PUT http://localhost:3000/api/sessions/test-named-session/rename \
  -H "Content-Type: application/json" \
  -d '{"name":"重命名后的会话"}'
```

Expected response:
```json
{"success":true,"sessionId":"test-named-session","name":"重命名后的会话"}
```

- [ ] **Step 4: Test rename with empty name (should fail)**

```bash
curl -X PUT http://localhost:3000/api/sessions/test-named-session/rename \
  -H "Content-Type: application/json" \
  -d '{"name":"  "}'
```

Expected: HTTP 400 with `{"error":"名称不能为空"}`

- [ ] **Step 5: Clean up test session**

```bash
curl -X DELETE http://localhost:3000/api/sessions/test-named-session
```

- [ ] **Step 6: Frontend smoke test**

Start the frontend dev server and verify:
1. Click "新建" → popover appears with name input and preset selector
2. Type a name, click "创建" → new session appears in dropdown with the given name
3. Click outside the popover → popover closes
4. Click ✎ next to session dropdown → inline input replaces dropdown
5. Type new name, press Enter → session renamed in dropdown
6. Press Escape during rename → cancels, restores dropdown

```bash
cd frontend && npx vite
```

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "test: verify session naming & rename end-to-end"
```
