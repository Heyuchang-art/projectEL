import React, { useRef, useEffect } from 'react';
import { Cpu, Send, Paperclip, XCircle, X, Trash2, Plus, FileText } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import MarkdownMessage from './MarkdownMessage';

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
    renameSession
  } = useChat();

  const { toggleCard } = useWorkspace();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // New-session popover state
  const [showNewSessionPopover, setShowNewSessionPopover] = React.useState(false);
  const [newSessionName, setNewSessionName] = React.useState('');
  const [newSessionPresetId, setNewSessionPresetId] = React.useState('');
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  // Rename state
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState('');
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);

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

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitChat = () => {
    if (!isStreaming) {
      formRef.current?.requestSubmit();
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitChat();
    }
  };

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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        textInputRef.current?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        submitChat();
        return;
      }

      if (event.key === 'Escape' && isStreaming) {
        event.preventDefault();
        abort();
        return;
      }

      if (!isTypingTarget && event.key === '/') {
        event.preventDefault();
        textInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [abort, isStreaming]);

  return (
    <div 
      className="glass-panel" 
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        height: '100%',
        backgroundColor: '#0c0c0c',
        border: '3px solid #222222',
        boxShadow: '4px 4px 0px #000000',
        transform: 'none' // Override hover translation for the full workspace layout stability
      }}
    >
      {/* Card Header (Drag Handle) */}
      <div 
        className="card-drag-header"
        style={{ 
          padding: '12px 16px', 
          borderBottom: '3px solid #222222', 
          backgroundColor: '#000000',
          cursor: 'grab'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#ffffff' }}>
              💬 Xaihi Learning Console
            </h2>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              <span>模型: <strong style={{ color: 'var(--secondary)' }}>{activeModel}</strong></span>
              <span>思考: <strong style={{ color: 'var(--primary)' }}>{thinkingLevel}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={clearSession}
              disabled={isStreaming}
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#000000',
                border: '2px solid #222222',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                opacity: isStreaming ? 0.5 : 1,
                transition: 'all 0.1s ease'
              }}
              onMouseEnter={(e) => {
                if (!isStreaming) {
                  e.currentTarget.style.borderColor = 'var(--secondary)';
                  e.currentTarget.style.color = 'var(--secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isStreaming) {
                  e.currentTarget.style.borderColor = '#222222';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              title="清空当前对话历史"
            >
              <Trash2 size={14} />
            </button>
            {isStreaming ? (
              <button 
                onClick={abort} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--error)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'bold'
                }}
              >
                <XCircle size={14} /> 中断
              </button>
            ) : (
              <button
                onClick={() => toggleCard('chat')}
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#000000',
                  border: '2px solid #222222',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--error)';
                  e.currentTarget.style.color = 'var(--error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#222222';
                  e.currentTarget.style.color = '#ffffff';
                }}
                title="隐藏聊天窗口"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Multi-Session & Presets Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
          {/* Preset Selector */}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>预设:</span>
          <select 
            value={activePresetId || ''} 
            onChange={(e) => {
              const val = e.target.value;
              createSession(undefined, val || undefined);
            }}
            style={{
              backgroundColor: '#000000',
              border: '2px solid #333333',
              color: '#ffffff',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 4px',
              borderRadius: '0',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">(无预设)</option>
            {presets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
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
              >✓</button>
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
              >✕</button>
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
              >✎</button>
            </>
          )}

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

          {/* Delete Session Button */}
          {sessions.length > 1 && sessionId !== 'default-session' && (
            <button
              onClick={() => deleteSession(sessionId)}
              style={{
                backgroundColor: '#000000',
                border: '2px solid var(--error)',
                color: 'var(--error)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                cursor: 'pointer',
                boxShadow: '1px 1px 0px var(--error)'
              }}
              title="删除当前会话"
            >
              删除
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '340px', color: 'var(--text-muted)', padding: '20px' }}>
            <Cpu size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.6' }}>
              欢迎来到 AI 学习控制台！您在此处可以同 Xaihi 智能体直接对话。上传图像将触发 Qwen 识图子智能体进行前端细节识别，之后主模型会据此作出解答。
            </p>
          </div>
        )}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const isTool = m.role === 'toolCall' || m.role === 'toolResult';
          const isSubagent = m.role === 'custom' && m.customType && m.customType.startsWith('subagent-');

          if (isSubagent) {
            const status = m.customType === 'subagent-status' ? 'working' : m.customType === 'subagent-result' ? 'done' : 'error';
            const color = status === 'working' ? 'var(--secondary)' : status === 'done' ? 'var(--success)' : 'var(--error)';
            
            return (
              <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '90%', display: 'flex', flexDirection: 'column', margin: '6px 0' }}>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  🤖 子智能体 (QWEN VISION AGENT)
                </span>
                <div 
                  style={{
                    padding: '12px',
                    backgroundColor: '#000000',
                    border: `2px solid ${color}`,
                    boxShadow: `3px 3px 0px ${color}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: '#ffffff'
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          }

          return (
            <div 
              key={m.id} 
              style={{ 
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Message Header */}
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px', textAlign: isUser ? 'right' : 'left' }}>
                {m.role === 'user' ? 'YOU' : m.role === 'assistant' ? 'XAIHI AGENT' : 'SYSTEM'}
              </span>
              
              {/* Message Content */}
              <div 
                className="chat-message-content"
                style={{
                  padding: '12px 14px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  backgroundColor: isUser ? '#000000' : '#111111',
                  border: isUser 
                    ? '2px solid var(--secondary)' 
                    : isTool 
                      ? '2px dashed #333333'
                      : '2px solid #222222',
                  boxShadow: isUser 
                    ? '3px 3px 0px var(--secondary)' 
                    : isTool 
                      ? 'none'
                      : '3px 3px 0px #000000',
                  color: isTool 
                    ? (m.isError ? 'var(--error)' : 'var(--secondary)')
                    : 'var(--text-main)'
                }}
              >
                {m.role === 'assistant' ? <MarkdownMessage text={m.text} /> : m.text}
                {isStreaming && !isUser && m.role === 'assistant' && <span className="typing-cursor"></span>}
                
                {/* User Attachment Images */}
                {isUser && m.images && m.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {m.images.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={`data:${img.mimeType};base64,${img.data}`} 
                        alt="uploaded" 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '140px', 
                          border: '2px solid #222222',
                          boxShadow: '3px 3px 0px #000000' 
                        }} 
                      />
                    ))}
                  </div>
                )}
                {isUser && m.attachments && m.attachments.length > 0 && (
                  <div className="chat-attachment-list">
                    {m.attachments.map((attachment) => (
                      <div key={attachment.id} className="chat-attachment-chip">
                        <FileText size={13} />
                        <span>{attachment.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div 
        style={{ 
          borderTop: '3px solid #222222', 
          padding: '14px 16px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px',
          backgroundColor: '#000000'
        }}
      >
        {/* Upload previews */}
        {selectedAttachments.length > 0 && (
          <div className="chat-upload-preview">
            {selectedAttachments.map((attachment, idx) => (
              <div key={attachment.id} className="chat-upload-item">
                {attachment.kind === 'image' && attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="chat-upload-thumb"
                  />
                ) : (
                  <div className="chat-upload-file">
                    <FileText size={16} />
                    <span>{attachment.name}</span>
                    <small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small>
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'var(--error)',
                    border: '1px solid #000000',
                    width: '16px',
                    height: '16px',
                    color: '#000000',
                    fontSize: '10px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <form ref={formRef} onSubmit={sendMessage} style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={uploadAttachment} 
            multiple 
            style={{ display: 'none' }} 
          />

          {/* Paperclip Button */}
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="btn-premium btn-secondary" 
            style={{ 
              padding: '12px', 
              boxShadow: 'none',
              border: '2px solid #222222'
            }}
          >
            <Paperclip size={16} />
          </button>

          {/* Text Input */}
          <textarea
            ref={textInputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? "正在推理分析中..." : "向智能体提问（可附加文件）..."}
            className="input-premium"
            style={{ flex: 1, fontSize: '12px', minHeight: '44px', maxHeight: '130px', resize: 'vertical', lineHeight: 1.5 }}
          />

          {/* Send Button */}
          <button type="submit" disabled={isStreaming} className="btn-premium">
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
