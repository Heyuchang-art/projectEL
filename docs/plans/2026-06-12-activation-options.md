# Provider and Model Activation Toggles Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement switch toggles in the Settings Panel for enabling/disabling provider and model configurations, and ensure unconfigured providers default to disabled with robust backend fallback.

**Architecture:** Frontend implements a retro-styled React inline Switch component replacing the checkboxes, dynamically validation API Key presence. Backend validates activation status on fallback selection and session creation.

**Tech Stack:** React (TypeScript), Node.js (TypeScript), Express, Socket.IO

---

### Task 1: Backend Fallback Logic & Default Activation Configuration

**Files:**
- Modify: `backend/src/server.ts:74-84` (Add logic to filter by enabled/configured status)
- Modify: `backend/src/server.ts:150-177` (Add active status checks on session startup)

**Step 1: Write helper function and update fallback model method**

Replace lines 74-84 in [server.ts](file:///c:/Users/lisky/Desktop/projectEL/backend/src/server.ts) with:

```typescript
  // Helper to check if a model and its provider are active and enabled
  function isModelAndProviderEnabled(provider: string, modelId: string): boolean {
    let modelsConfig: any = { providers: {} };
    try {
      if (fs.existsSync(modelsJsonPath)) {
        modelsConfig = fs.readJsonSync(modelsJsonPath);
      }
    } catch (err) {}
    if (!modelsConfig.providers) {
      modelsConfig.providers = {};
    }

    const authStatus = modelRegistry.getProviderAuthStatus(provider);
    const isConfigured = authStatus.configured || !!authStatus.source;
    if (!isConfigured) return false;

    const pConfig = modelsConfig.providers?.[provider] || {};
    const providerEnabled = pConfig.enabled !== undefined ? pConfig.enabled : true;
    if (!providerEnabled) return false;

    const customModel = pConfig.models?.find((cm: any) => cm.id === modelId);
    const isModelEnabled = customModel?.enabled !== undefined ? customModel.enabled : true;
    return isModelEnabled;
  }

  // 查找一个本地已配置 API key 且已启用的可用模型作为保底
  function getConfiguredFallbackModel(): any {
    const allModels = modelRegistry.getAll();
    for (const m of allModels) {
      if (isModelAndProviderEnabled(m.provider, m.id)) {
        return m;
      }
    }
    // If absolutely nothing is active/enabled, fallback to the first model registry entry
    return allModels[0];
  }
```

**Step 2: Update session final checks**

Replace lines 150-177 in [server.ts](file:///c:/Users/lisky/Desktop/projectEL/backend/src/server.ts) with:

```typescript
    // 检查该会话当前模型是否已配置凭证且已启用，否则采用已配置且已启用的可用模型作为保底
    if (!session.model || !isModelAndProviderEnabled(session.model.provider, session.model.id)) {
      const fallback = getConfiguredFallbackModel();
      console.log(`[Session FinalCheck] Session model missing or disabled for session ${sessionId}, setting fallback to ${fallback?.provider}/${fallback?.id}`);
      if (fallback) {
        try {
          await session.setModel(fallback);
        } catch (err) {
          console.error(`Failed to set fallback model for session ${sessionId}:`, err);
        }
      }
    }
```

**Step 3: Compile and verify backend**

Run: `npm run build --workspace=backend`
Expected: Command completes successfully with zero compilation errors.

**Step 4: Commit backend changes**

```bash
git add backend/src/server.ts
git commit -m "feat(backend): check active and configured status on fallback model selection"
```

---

### Task 2: Update UI Toggles in SettingsPanel

**Files:**
- Modify: `frontend/src/components/SettingsPanel.tsx:375-385` (Add key-checking function)
- Modify: `frontend/src/components/SettingsPanel.tsx:422-438` (Provider checkbox replacement with switch)
- Modify: `frontend/src/components/SettingsPanel.tsx:527-550` (Model checkbox replacement with switch)

**Step 1: Add API key check function to SettingsPanel**

Before `const isCustomProvider = ...` in [SettingsPanel.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/SettingsPanel.tsx), add:

```typescript
  const isProviderConfiguredInUI = (providerId: string) => {
    const currentKey = apiKeys[providerId];
    const originalProvider = providers.find(p => p.id === providerId);
    
    if (currentKey === undefined) {
      return originalProvider?.configured || false;
    }
    
    if (currentKey === '********') {
      return true;
    }
    
    return currentKey.trim() !== '';
  };
```

**Step 2: Replace Provider Checkbox with Switch Toggle**

Replace the header layout of the provider list (around line 422-438 in [SettingsPanel.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/SettingsPanel.tsx)):

```tsx
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'var(--font-mono)', color: (p.enabled !== false && isProviderConfiguredInUI(p.id)) ? '#d1d5db' : 'var(--text-muted)' }}>
                  {(p.name || p.id).toUpperCase()}
                </span>
                {(!isProviderConfiguredInUI(p.id) || p.enabled === false) && (
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', border: '1px solid var(--text-muted)', padding: '0 2px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                    {!isProviderConfiguredInUI(p.id) ? '未配置 Key' : '已禁用'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Switch for Provider activation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>服务商启用状态</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
                    <input
                      type="checkbox"
                      checked={p.enabled !== false && isProviderConfiguredInUI(p.id)}
                      onChange={(e) => {
                        if (!isProviderConfiguredInUI(p.id)) {
                          alert('请先输入 API Key 才可以启用服务商');
                          return;
                        }
                        handleToggleProvider(p.id, e.target.checked);
                      }}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      position: 'relative',
                      width: '36px',
                      height: '20px',
                      backgroundColor: (p.enabled !== false && isProviderConfiguredInUI(p.id)) ? 'var(--primary)' : '#222222',
                      borderRadius: '10px',
                      transition: 'background-color 0.2s ease',
                      border: '2px solid #333333'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        left: (p.enabled !== false && isProviderConfiguredInUI(p.id)) ? '18px' : '2px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: (p.enabled !== false && isProviderConfiguredInUI(p.id)) ? '#000000' : '#888888',
                        borderRadius: '50%',
                        transition: 'left 0.2s ease'
                      }} />
                    </div>
                  </label>
                </div>
```

**Step 3: Replace Model Checkbox with Switch Toggle**

Replace the model row item (around line 527-550 in [SettingsPanel.tsx](file:///c:/Users/lisky/Desktop/projectEL/frontend/src/components/SettingsPanel.tsx)):

```tsx
                    {availableModels.filter(m => m.provider === p.id).map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0c0c0c', padding: '6px 10px', border: '1px solid #222222', opacity: (m.enabled !== false && p.enabled !== false) ? 1 : 0.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: (m.enabled !== false && p.enabled !== false) ? '#ffffff' : 'var(--text-muted)' }}>
                            {m.name} <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>({m.id})</span>
                            {m.reasoning && <span style={{ marginLeft: '6px', color: 'var(--primary)', fontSize: '8px', border: '1px solid var(--primary)', padding: '0px 2px' }}>Reasoning</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {/* Switch for Model activation */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>模型启用状态</span>
                            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
                              <input
                                type="checkbox"
                                checked={m.enabled !== false}
                                onChange={(e) => handleToggleModel(p.id, m.id, e.target.checked)}
                                style={{ display: 'none' }}
                              />
                              <div style={{
                                position: 'relative',
                                width: '32px',
                                height: '18px',
                                backgroundColor: m.enabled !== false ? 'var(--primary)' : '#222222',
                                borderRadius: '9px',
                                transition: 'background-color 0.2s ease',
                                border: '2px solid #333333'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  top: '1px',
                                  left: m.enabled !== false ? '15px' : '1px',
                                  width: '12px',
                                  height: '12px',
                                  backgroundColor: m.enabled !== false ? '#000000' : '#888888',
                                  borderRadius: '50%',
                                  transition: 'left 0.2s ease'
                                }} />
                              </div>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(p.id, m.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
```

**Step 4: Compile and verify frontend**

Run: `npm run build --workspace=frontend`
Expected: Command completes successfully with zero compilation errors.

**Step 5: Commit frontend changes**

```bash
git add frontend/src/components/SettingsPanel.tsx
git commit -m "feat(frontend): replace checkboxes with switch toggles in settings panel"
```
