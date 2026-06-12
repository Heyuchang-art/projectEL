# Model Decoupling and Custom Provider Management Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Decouple models from presets and sessions, add model/thinking level selectors directly in the ChatCard header, and refactor the settings page to support custom providers and inline model addition/deletion.

**Architecture:**
1. Remove `modelConfig` from `skills/agent-presets.json`.
2. Refactor `backend/src/server.ts` to remove preset-model validation and preset-model initialization.
3. Expose `availableModels` in `frontend/src/contexts/ChatContext.tsx`.
4. Replace the static model metadata text in `frontend/src/components/ChatCard.tsx` with inline dropdowns.
5. Refactor `frontend/src/components/SettingsPanel.tsx` to remove the active model select card, support inline model list addition/deletion, and add custom providers.

**Tech Stack:** React, TypeScript, Node.js, Express, Socket.io, fs-extra.

---

### Task 1: Decouple agent presets config

**Files:**
- Modify: `skills/agent-presets.json`

**Step 1: Write the failing test**
*Note: Since presets are configuration-only files, we will verify that the JSON is valid and does not contain `modelConfig` after modification.*

**Step 2: Run verification**
Verify file existence:
`test -f skills/agent-presets.json`

**Step 3: Write minimal implementation**
Modify `skills/agent-presets.json` to remove the `"modelConfig"` block from all presets.
For example, for the first preset (Xaihi):
```diff
   {
     "id": "xaihi",
     "name": "Xaihi",
     "description": "使用启发式的引导式追问，启发自主思考，绝不直接给出标准答案。",
-    "modelConfig": {
-      "provider": "deepseek",
-      "modelId": "deepseek-v4-flash",
-      "thinkingLevel": "high"
-    },
     "systemPrompt": "...",
```
Repeat for all presets in `skills/agent-presets.json`.

**Step 4: Run test to verify it passes**
Verify JSON syntax validity:
Run: `node -e "JSON.parse(require('fs').readFileSync('skills/agent-presets.json', 'utf8'))"`
Expected: Executes without syntax errors.

**Step 5: Commit**
```bash
git add skills/agent-presets.json
git commit -m "chore: remove modelConfig from agent presets"
```

---

### Task 2: Refactor backend preset model logic

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Write the failing test**
We will verify that server compilation succeeds and the preset endpoints do not check for or set `modelConfig`.

**Step 2: Run verification**
Verify backend workspace compilation:
`npm run build --workspace=backend`

**Step 3: Write minimal implementation**
1. In `backend/src/server.ts:148-197`, remove the `activePresetId` model config initialization block completely:
```typescript
    // REMOVE THIS SECTION:
    const activePresetId = sessionPresets.get(sessionId);
    if (activePresetId && !sessionFile) {
       ...
    }
```
2. In `backend/src/server.ts:730-740` (inside `POST /api/agents` route), remove the check that auto-injects `modelConfig` from `getConfiguredFallbackModel()`.
3. In `backend/src/server.ts:762-771` (inside `PUT /api/agents/:id` route), remove the check that auto-injects `modelConfig` from `getConfiguredFallbackModel()`.

**Step 4: Run test to verify it passes**
Run backend build check:
Run: `npm run build --workspace=backend`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/server.ts
git commit -m "refactor: remove preset model validation and initialization in backend"
```

---

### Task 3: Expose availableModels in ChatContext

**Files:**
- Modify: `frontend/src/contexts/ChatContext.tsx`

**Step 1: Write the failing test**
Ensure type definitions compilation succeeds after adding the new context state.

**Step 2: Run verification**
Run: `npm run build --workspace=frontend`

**Step 3: Write minimal implementation**
1. Add `availableModels` to `ChatContextProps` interface:
```typescript
export interface ChatContextProps {
  ...
  activeModel: string;
  availableModels: any[]; // <--- ADD THIS
  thinkingLevel: string;
  ...
}
```
2. In `ChatProvider`, initialize `availableModels` state:
```typescript
  const [activeModel, setActiveModel] = useState('获取中...');
  const [availableModels, setAvailableModels] = useState<any[]>([]); // <--- ADD THIS
  const [thinkingLevel, setThinkingLevel] = useState('medium');
```
3. Update `fetchActiveModelConfig` to save the models array returned from backend:
```typescript
  const fetchActiveModelConfig = async (overrideSessionId?: string) => {
    const sid = overrideSessionId || sessionId;
    try {
      const response = await fetch(`http://localhost:3000/api/models?sessionId=${sid}`);
      const data = await response.json();
      if (data.activeModel) setActiveModel(data.activeModel);
      if (data.thinkingLevel) setThinkingLevel(data.thinkingLevel);
      if (data.models) setAvailableModels(data.models); // <--- ADD THIS
    } catch (err) {
      console.error('Failed to fetch models config:', err);
    }
  };
```
4. Expose `availableModels` in the provider value object:
```typescript
    <ChatContext.Provider value={{
      ...
      activeModel,
      availableModels, // <--- ADD THIS
      thinkingLevel,
      ...
    }}>
```

**Step 4: Run test to verify it passes**
Run: `npm run build --workspace=frontend`
Expected: PASS

**Step 5: Commit**
```bash
git add frontend/src/contexts/ChatContext.tsx
git commit -m "feat: expose availableModels in ChatContext"
```

---

### Task 4: Replace header metadata with inline selectors in ChatCard

**Files:**
- Modify: `frontend/src/components/ChatCard.tsx`

**Step 1: Write the failing test**
Ensure JSX compilation succeeds after introducing the inline `<select>` tags in the header.

**Step 2: Run verification**
Run: `npm run build --workspace=frontend`

**Step 3: Write minimal implementation**
1. In `ChatCard.tsx`, destructure `availableModels` and `selectModel` from `useChat()`:
```typescript
  const { 
    messages, 
    activeModel, 
    availableModels, // <--- ADD THIS
    thinkingLevel, 
    isStreaming, 
    clearSession, 
    presets, 
    activePresetId, 
    createSession,
    selectModel // <--- ADD THIS
  } = useChat();
```
2. Locate the static spans:
```typescript
<span>模型: <strong style={{ color: 'var(--secondary)' }}>{activeModel}</strong></span>
<span>思考: <strong style={{ color: 'var(--primary)' }}>{thinkingLevel}</strong></span>
```
3. Replace them with:
```typescript
{/* Inline selectors for Model & Thinking Level */}
<span style={{ display: 'inline-flex', alignItems: 'center' }}>
  模型: 
  <select
    value={activeModel}
    onChange={async (e) => {
      const selectedId = e.target.value;
      const model = availableModels.find(m => m.id === selectedId);
      if (model) {
        const nextThinking = model.reasoning ? thinkingLevel : 'off';
        await selectModel(model.provider, model.id, nextThinking);
      }
    }}
    style={{
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--secondary)',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      fontWeight: 'bold',
      cursor: 'pointer',
      outline: 'none',
      padding: '0 2px',
      margin: '0',
    }}
  >
    {availableModels.map(m => (
      <option key={m.id} value={m.id} style={{ backgroundColor: '#000000', color: '#ffffff' }}>
        {m.name}
      </option>
    ))}
  </select>
</span>

{(() => {
  const activeModelObj = availableModels.find(m => m.id === activeModel);
  const currentModelSupportsReasoning = activeModelObj ? activeModelObj.reasoning : false;
  
  if (!currentModelSupportsReasoning) return null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      思考: 
      <select
        value={thinkingLevel}
        onChange={async (e) => {
          const level = e.target.value;
          const model = availableModels.find(m => m.id === activeModel);
          if (model) {
            await selectModel(model.provider, model.id, level);
          }
        }}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 'bold',
          cursor: 'pointer',
          outline: 'none',
          padding: '0 2px',
          margin: '0',
        }}
      >
        <option value="off" style={{ backgroundColor: '#000000', color: '#ffffff' }}>off</option>
        <option value="minimal" style={{ backgroundColor: '#000000', color: '#ffffff' }}>minimal</option>
        <option value="low" style={{ backgroundColor: '#000000', color: '#ffffff' }}>low</option>
        <option value="medium" style={{ backgroundColor: '#000000', color: '#ffffff' }}>medium</option>
        <option value="high" style={{ backgroundColor: '#000000', color: '#ffffff' }}>high</option>
        <option value="xhigh" style={{ backgroundColor: '#000000', color: '#ffffff' }}>xhigh</option>
      </select>
    </span>
  );
})()}
```

**Step 4: Run test to verify it passes**
Run: `npm run build --workspace=frontend`
Expected: PASS

**Step 5: Commit**
```bash
git add frontend/src/components/ChatCard.tsx
git commit -m "feat: make model and thinking level interactive inline selectors in ChatCard header"
```

---

### Task 5: Refactor Settings Panel and Custom Provider Management

**Files:**
- Modify: `frontend/src/components/SettingsPanel.tsx`

**Step 1: Write the failing test**
Verify build compilation after major form layout rewrites.

**Step 2: Run verification**
Run: `npm run build --workspace=frontend`

**Step 3: Write minimal implementation**
1. **Remove Model Activation Select Section**:
   Remove the first card container `<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '2px solid #222222', padding: '16px', backgroundColor: '#000000' }}>` which contains active model/thinking dropdowns (lines 250-310).
2. **Implement Inline Model List & Addition/Deletion under each Provider**:
   Inside each provider card rendering (`providers.map(p => ...)`):
   - Add a list display of currently configured models for that provider (filtered from `availableModels`).
   - Add a delete icon/button next to each model. Clicking it calls an API action to remove the model from that provider in `.pi/models.json` via `/api/models/configure`.
   - Add a small "+ 添加模型" (+ Add Model) inline toggle button. When clicked, display form inputs: Model ID, Display Name, and Reasoning capability (checkbox). When submitted, it pushes the model to the provider's `models` array and saves it.
3. **Implement "+ 添加自定义服务商" (+ Add Custom Provider) Button & Modal**:
   - Add a button at the top of the providers list.
   - On click, show an overlay/modal with fields: Provider ID, Name, API Protocol (`openai-completions` or `anthropic-messages`), Base URL, API Key.
   - Upon clicking "Confirm", construct the provider config, send a configuration payload to `/api/models/configure`, refresh lists, and close modal.

**Step 4: Run test to verify it passes**
Run: `npm run build --workspace=frontend`
Expected: PASS

**Step 5: Commit**
```bash
git add frontend/src/components/SettingsPanel.tsx
git commit -m "feat: refactor SettingsPanel with inline model management and custom provider wizard"
```

---

### Task 6: Build and End-to-End Verification Check

**Files:**
- Test: Run verification commands across workspace

**Step 1: Run overall workspace build check**
Run: `npm run build --workspace=backend && npm run build --workspace=frontend`
Expected: Success

**Step 2: Commit**
```bash
git commit --allow-empty -m "build: confirm full clean build passes"
```
