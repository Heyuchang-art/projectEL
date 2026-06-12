import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useChat } from '../contexts/ChatContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

export default function SettingsPanel() {
  const { sessionId, fetchActiveModelConfig } = useChat();
  const { setActiveDrawer } = useWorkspace();

  const [providers, setProviders] = useState<any[]>([]);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Custom provider modal states
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [newProviderId, setNewProviderId] = useState('');
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderApi, setNewProviderApi] = useState('openai-completions');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');

  // Inline custom model adding states
  const [addingModelForProvider, setAddingModelForProvider] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelReasoning, setNewModelReasoning] = useState(false);

  // Collapsible model list state (by providerId)
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const fetchModelConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:3000/api/models?sessionId=${sessionId}`);
      const data = await response.json();
      setProviders(data.providers || []);
      setAvailableModels(data.models || []);

      // Initialize API Keys and Base URLs from backend
      const keys: Record<string, string> = {};
      const urls: Record<string, string> = {};
      const visible: Record<string, boolean> = {};

      if (data.providers) {
        data.providers.forEach((p: any) => {
          keys[p.id] = p.configured ? '********' : '';
          urls[p.id] = p.baseUrl || '';
          visible[p.id] = false;
        });
      }
      setApiKeys(keys);
      setBaseUrls(urls);
      setShowKeys(visible);
    } catch (err) {
      console.error('Failed to fetch models config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModelConfig();
  }, [sessionId]);

  const handleDeepSeekAutoFill = () => {
    setBaseUrls(prev => ({ ...prev, deepseek: 'https://api.deepseek.com' }));
  };

  const handleQwenAutoFill = () => {
    setBaseUrls(prev => ({ ...prev, qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }));
  };

  const handleApiKeyChange = (provider: string, val: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: val }));
  };

  const handleBaseUrlChange = (provider: string, val: string) => {
    setBaseUrls(prev => ({ ...prev, [provider]: val }));
  };

  // 1. Add Custom Provider Action
  const handleCreateCustomProvider = async () => {
    if (!newProviderId.trim() || !newProviderName.trim() || !newProviderBaseUrl.trim()) {
      alert('请填写完整的服务商 ID、显示名称与 Base URL');
      return;
    }

    try {
      const payload: any = {
        provider: newProviderId,
        name: newProviderName,
        baseUrl: newProviderBaseUrl,
        api: newProviderApi,
        models: []
      };

      if (newProviderApiKey.trim()) {
        payload.apiKey = newProviderApiKey;
      }

      const response = await fetch('http://localhost:3000/api/models/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '创建自定义服务商失败');
      }

      await fetchModelConfig();
      await fetchActiveModelConfig();
      setShowAddProviderModal(false);

      // Clear states
      setNewProviderId('');
      setNewProviderName('');
      setNewProviderApi('openai-completions');
      setNewProviderBaseUrl('');
      setNewProviderApiKey('');

      confetti({
        particleCount: 50,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#daff3c', '#00f2fe']
      });
    } catch (err: any) {
      alert(`添加服务商失败: ${err.message}`);
    }
  };

  // 2. Delete Provider Action
  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm(`确定要彻底删除模型服务商 ${providerId} 及其关联的所有模型吗？`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/models/provider/${providerId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '删除服务商失败');
      }

      await fetchModelConfig();
      await fetchActiveModelConfig();
    } catch (err: any) {
      alert(`删除服务商失败: ${err.message}`);
    }
  };

  // 3. Add Custom Model Inline
  const handleSaveModel = async (providerId: string) => {
    if (!newModelId.trim() || !newModelName.trim()) {
      alert('请填写完整的模型 ID 与显示名称');
      return;
    }

    try {
      // 获取当前服务商已有的模型列表
      const currentModels = availableModels
        .filter(m => m.provider === providerId)
        .map(m => ({
          id: m.id,
          name: m.name,
          reasoning: m.reasoning,
          input: m.input || ['text'],
          contextWindow: m.contextWindow || 4096,
          maxTokens: m.maxTokens || 4096,
          enabled: m.enabled !== false
        }));

      // 避免重复添加相同 ID 的模型
      if (currentModels.some(m => m.id === newModelId.trim())) {
        alert('该服务商下已存在相同 ID 的模型');
        return;
      }

      const newModel = {
        id: newModelId.trim(),
        name: newModelName.trim(),
        reasoning: newModelReasoning,
        input: ['text'],
        contextWindow: 128000,
        maxTokens: 4096,
        enabled: true
      };

      const updatedModels = [...currentModels, newModel];

      const response = await fetch('http://localhost:3000/api/models/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          models: updatedModels
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '添加模型失败');
      }

      await fetchModelConfig();
      await fetchActiveModelConfig();
      setAddingModelForProvider(null);
    } catch (err: any) {
      alert(`添加模型失败: ${err.message}`);
    }
  };

  // 4. Delete Custom Model Inline
  const handleDeleteModel = async (providerId: string, modelId: string) => {
    if (!confirm(`确定要从该服务商下删除模型 ${modelId} 吗？`)) return;

    try {
      // 获取过滤后的模型列表
      const updatedModels = availableModels
        .filter(m => m.provider === providerId && m.id !== modelId)
        .map(m => ({
          id: m.id,
          name: m.name,
          reasoning: m.reasoning,
          input: m.input || ['text'],
          contextWindow: m.contextWindow || 4096,
          maxTokens: m.maxTokens || 4096,
          enabled: m.enabled !== false
        }));

      const response = await fetch('http://localhost:3000/api/models/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          models: updatedModels
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '删除模型失败');
      }

      await fetchModelConfig();
      await fetchActiveModelConfig();
    } catch (err: any) {
      alert(`删除模型失败: ${err.message}`);
    }
  };

  // 5. Toggle Provider Activation
  const handleToggleProvider = async (providerId: string, enabled: boolean) => {
    try {
      const response = await fetch('http://localhost:3000/api/models/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          enabled: enabled
        })
      });
      if (!response.ok) {
        throw new Error('更新激活状态失败');
      }
      await fetchModelConfig();
      await fetchActiveModelConfig();
    } catch (err: any) {
      alert(`更新激活状态失败: ${err.message}`);
    }
  };

  // 6. Toggle Model Activation Inline
  const handleToggleModel = async (providerId: string, modelId: string, enabled: boolean) => {
    try {
      const updatedModels = availableModels
        .filter(m => m.provider === providerId)
        .map(m => ({
          id: m.id,
          name: m.name,
          reasoning: m.reasoning,
          input: m.input || ['text'],
          contextWindow: m.contextWindow || 4096,
          maxTokens: m.maxTokens || 4096,
          enabled: m.id === modelId ? enabled : (m.enabled !== false)
        }));

      const response = await fetch('http://localhost:3000/api/models/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          models: updatedModels
        })
      });

      if (!response.ok) {
        throw new Error('更新模型状态失败');
      }

      await fetchModelConfig();
      await fetchActiveModelConfig();
    } catch (err: any) {
      alert(`更新模型状态失败: ${err.message}`);
    }
  };

  // 7. Save Provider API Keys & Base URLs globally
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Save keys and baseUrls for each provider
      for (const p of providers) {
        const keyInput = apiKeys[p.id];
        let keyToSend: string | undefined = undefined;
        if (keyInput !== '********') {
          keyToSend = keyInput;
        }

        const urlInput = baseUrls[p.id];
        const isDeepSeek = p.id === 'deepseek';
        const isQwen = p.id === 'qwen';

        const keyEdited = keyInput !== '********';
        const prevProvider = providers.find(prov => prov.id === p.id);
        const urlEdited = urlInput !== (prevProvider?.baseUrl || '');

        if (keyEdited || urlEdited || (isDeepSeek && urlInput) || (isQwen && urlInput)) {
          const payload: any = {
            provider: p.id,
            apiKey: keyToSend,
            baseUrl: urlInput || undefined
          };

          if (isDeepSeek && keyEdited) {
            payload.api = 'openai-completions';
          }
          if (isQwen && keyEdited) {
            payload.api = 'openai-completions';
          }

          const configResponse = await fetch('http://localhost:3000/api/models/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!configResponse.ok) {
            const errData = await configResponse.json();
            throw new Error(errData.error || `配置 ${p.name || p.id} 失败`);
          }
        }
      }

      await fetchModelConfig();
      await fetchActiveModelConfig();
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#00f2fe', '#daff3c', '#ff007f']
      });
      setActiveDrawer(null);
    } catch (err: any) {
      alert(`保存配置失败: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

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

  const isCustomProvider = (providerId: string) => {
    return !['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'openrouter'].includes(providerId);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        加载模型配置中...
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Add Custom Provider Wizard Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '-5px' }}>
        <button
          type="button"
          onClick={() => setShowAddProviderModal(true)}
          className="btn-premium"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
        >
          <Plus size={16} /> 添加自定义模型服务商
        </button>
      </div>

      {/* Provider Details Configuration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 900, textTransform: 'uppercase', color: 'var(--primary)' }}>
          服务商凭证与模型管理
        </h3>

        {providers.map(p => (
          <div 
            key={p.id} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              padding: '16px', 
              background: '#000000', 
              border: '2px solid #222222',
              opacity: (p.enabled !== false && isProviderConfiguredInUI(p.id)) ? 1 : 0.65,
              transition: 'opacity 0.2s ease'
            }}
          >
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
                {p.id === 'deepseek' && (
                  <button 
                    type="button"
                    onClick={handleDeepSeekAutoFill}
                    className="btn-premium btn-secondary"
                    style={{ fontSize: '10px', padding: '4px 8px', boxShadow: 'none' }}
                  >
                    填官方参数
                  </button>
                )}
                {p.id === 'qwen' && (
                  <button 
                    type="button"
                    onClick={handleQwenAutoFill}
                    className="btn-premium btn-secondary"
                    style={{ fontSize: '10px', padding: '4px 8px', boxShadow: 'none' }}
                  >
                    填官方参数
                  </button>
                )}
                {isCustomProvider(p.id) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProvider(p.id)}
                    className="btn-premium btn-secondary"
                    style={{ color: '#ff4d4d', borderColor: '#ff4d4d', padding: '4px 8px', fontSize: '10px', boxShadow: 'none' }}
                  >
                    删除服务商
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>API Key</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showKeys[p.id] ? 'text' : 'password'}
                    value={apiKeys[p.id] || ''}
                    onChange={(e) => handleApiKeyChange(p.id, e.target.value)}
                    placeholder={p.configured ? '已配置 (输入新 Key 覆盖)' : '请输入 API Key'}
                    className="input-premium"
                    style={{ width: '100%', paddingRight: '40px', fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    style={{ 
                      position: 'absolute', 
                      right: '10px', 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showKeys[p.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Base URL (端点)</label>
                <input
                  type="text"
                  value={baseUrls[p.id] || ''}
                  onChange={(e) => handleBaseUrlChange(p.id, e.target.value)}
                  placeholder="默认: 官方默认端点"
                  className="input-premium"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              {/* Models management section */}
              <div style={{ marginTop: '8px', borderTop: '1px solid #222222', paddingTop: '12px' }}>
                <div 
                  onClick={() => setExpandedProviders(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    marginBottom: '8px',
                    userSelect: 'none'
                  }}
                >
                  <h4 style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--primary)', margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '9px', width: '10px', display: 'inline-block' }}>{expandedProviders[p.id] ? '▼' : '▶'}</span>
                    已添加的模型 ({availableModels.filter(m => m.provider === p.id).length})
                  </h4>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', border: '1px solid #333333', padding: '1px 4px', borderRadius: '3px', backgroundColor: '#050505' }}>
                    {expandedProviders[p.id] ? '收起' : '展开'}
                  </span>
                </div>

                {expandedProviders[p.id] && (
                  <>
                    {availableModels.filter(m => m.provider === p.id).length === 0 ? (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                        无模型，请在下方添加模型以开始使用。
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
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
                      </div>
                    )}

                    {/* Add Model Inline form */}
                    {addingModelForProvider === p.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: '#0c0c0c', border: '1px solid #222222', marginTop: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="模型 ID (如: deepseek-chat)"
                            value={newModelId}
                            onChange={e => setNewModelId(e.target.value)}
                            className="input-premium"
                            style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                          />
                          <input
                            type="text"
                            placeholder="显示名称 (如: DeepSeek Chat)"
                            value={newModelName}
                            onChange={e => setNewModelName(e.target.value)}
                            className="input-premium"
                            style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newModelReasoning}
                              onChange={e => setNewModelReasoning(e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            支持 Reasoning (思考深度)
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setAddingModelForProvider(null)}
                              className="btn-premium btn-secondary"
                              style={{ fontSize: '10px', padding: '3px 8px', boxShadow: 'none' }}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveModel(p.id)}
                              className="btn-premium"
                              style={{ fontSize: '10px', padding: '3px 8px', boxShadow: 'none' }}
                            >
                              添加
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingModelForProvider(p.id);
                          setNewModelId('');
                          setNewModelName('');
                          setNewModelReasoning(false);
                        }}
                        className="btn-premium btn-secondary"
                        style={{ fontSize: '10px', padding: '4px 8px', width: '100%', marginTop: '4px', boxShadow: 'none' }}
                      >
                        + 添加模型
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px', 
          borderTop: '2px solid #222222', 
          paddingTop: '20px', 
          marginTop: '10px' 
        }}
      >
        <button
          type="button"
          onClick={() => setActiveDrawer(null)}
          className="btn-premium btn-secondary"
          style={{ padding: '10px 20px' }}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="btn-premium"
          style={{ padding: '10px 20px' }}
        >
          {isSaving ? '保存中...' : '保存并生效'}
        </button>
      </div>

      {/* Custom Provider Wizard Dialog Overlay */}
      {showAddProviderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#0c0c0c',
            border: '3px solid #222222',
            boxShadow: '4px 4px 0px #000000',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #222222', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 900, textTransform: 'uppercase', color: 'var(--primary)' }}>
                添加自定义模型服务商
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProviderModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>服务商唯一标识 (ID)</label>
                <input
                  type="text"
                  placeholder="例如: ollama, localai"
                  value={newProviderId}
                  onChange={e => setNewProviderId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="input-premium"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>显示名称 (Name)</label>
                <input
                  type="text"
                  placeholder="例如: Ollama Local"
                  value={newProviderName}
                  onChange={e => setNewProviderName(e.target.value)}
                  className="input-premium"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>API 协议类型</label>
                <select
                  value={newProviderApi}
                  onChange={e => setNewProviderApi(e.target.value)}
                  className="input-premium"
                  style={{ width: '100%', fontSize: '12px', cursor: 'pointer' }}
                >
                  <option value="openai-completions">openai-completions (OpenAI 兼容)</option>
                  <option value="anthropic-messages">anthropic-messages (Anthropic 兼容)</option>
                  <option value="google-generative">google-generative (Google 兼容)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Base URL (端点)</label>
                <input
                  type="text"
                  placeholder="例如: http://localhost:11434/v1"
                  value={newProviderBaseUrl}
                  onChange={e => setNewProviderBaseUrl(e.target.value)}
                  className="input-premium"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>API Key (密钥，可选)</label>
                <input
                  type="password"
                  placeholder="若不需要可留空"
                  value={newProviderApiKey}
                  onChange={e => setNewProviderApiKey(e.target.value)}
                  className="input-premium"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '2px solid #222222', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowAddProviderModal(false)}
                className="btn-premium btn-secondary"
                style={{ padding: '6px 12px', fontSize: '11px', boxShadow: 'none' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateCustomProvider}
                className="btn-premium"
                style={{ padding: '6px 12px', fontSize: '11px', boxShadow: 'none' }}
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

    </form>
  );
}
