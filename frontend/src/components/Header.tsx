import React, { useEffect, useState } from 'react';
import { useKnowledgeBase } from '../hooks/useKnowledgeBase';
import { Database, Plus, Trash2 } from 'lucide-react';

export default function Header() {
  const { fetchLibraries, switchLibrary, createLibrary, deleteLibrary } = useKnowledgeBase();
  const [libraries, setLibraries] = useState<string[]>([]);
  const [activeKb, setActiveKb] = useState<string>('default');
  const [loading, setLoading] = useState(false);

  const loadLibraries = async () => {
    try {
      const data = await fetchLibraries();
      setLibraries(data.libraries);
      setActiveKb(data.active);
    } catch (err) {
      console.error('Failed to load libraries:', err);
    }
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  const handleSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const kbId = e.target.value;
    setLoading(true);
    try {
      await switchLibrary(kbId);
      setActiveKb(kbId);
    } catch (err) {
      alert('切换记忆库失败：' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('请输入新记忆库的名称（仅支持英文字母、数字和下划线）：');
    if (!name) return;
    const cleanName = name.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
      alert('名称格式不正确！仅允许字母、数字、下划线和连字符。');
      return;
    }

    setLoading(true);
    try {
      await createLibrary(cleanName);
      await loadLibraries();
      await switchLibrary(cleanName);
      setActiveKb(cleanName);
    } catch (err) {
      alert('创建记忆库失败：' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (activeKb === 'default') {
      alert('默认记忆库「default」不允许删除！');
      return;
    }

    const confirmDel = window.confirm(`警告：确定要彻底删除当前记忆库「${activeKb}」吗？这将删除其下所有的知识卡片、复习笔记和源材料，此操作不可逆！`);
    if (!confirmDel) return;

    setLoading(true);
    try {
      await deleteLibrary(activeKb);
      alert('记忆库删除成功，自动切换回默认记忆库。');
      await loadLibraries();
      setActiveKb('default');
    } catch (err) {
      alert('删除记忆库失败：' + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '56px',
        width: '100%',
        backgroundColor: '#0c0c0c',
        borderBottom: '3px solid #222222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        boxSizing: 'border-box',
        flexShrink: 0
      }}
    >
      {/* Left Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Database size={20} style={{ color: 'var(--secondary)' }} />
        <span
          style={{
            color: '#d1d5db',
            fontWeight: 900,
            fontSize: '15px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '1px'
          }}
        >
          Snapshot Pi <span style={{ color: 'var(--primary)' }}>记忆空间</span>
        </span>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            color: '#888888',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'bold'
          }}
        >
          ACTIVE DATABASE:
        </span>
        
        <select
          value={activeKb}
          onChange={handleSwitch}
          disabled={loading}
          style={{
            backgroundColor: '#111111',
            color: '#d1d5db',
            border: '2px solid #d1d5db',
            padding: '6px 12px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'bold',
            fontSize: '13px',
            boxShadow: '2px 2px 0px #000000',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {libraries.map(lib => (
            <option key={lib} value={lib} style={{ backgroundColor: '#0a0a0a', color: '#d1d5db' }}>
              {lib === 'default' ? 'default (默认库)' : lib}
            </option>
          ))}
        </select>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            backgroundColor: 'var(--primary)',
            color: '#d1d5db',
            border: '2px solid #d1d5db',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            boxShadow: '2px 2px 0px #000000',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'transform 0.1s, box-shadow 0.1s'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translate(1px, 1px)';
            e.currentTarget.style.boxShadow = '1px 1px 0px #000000';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '2px 2px 0px #000000';
          }}
          title="新建记忆库"
        >
          <Plus size={14} />
          新建
        </button>

        {/* Delete Button */}
        {activeKb !== 'default' && (
          <button
            onClick={handleDelete}
            disabled={loading}
            style={{
              backgroundColor: 'var(--accent)',
              color: '#d1d5db',
              border: '2px solid #d1d5db',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              boxShadow: '2px 2px 0px #000000',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'transform 0.1s, box-shadow 0.1s'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translate(1px, 1px)';
              e.currentTarget.style.boxShadow = '1px 1px 0px #000000';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '2px 2px 0px #000000';
            }}
            title="删除当前记忆库"
          >
            <Trash2 size={14} />
            删除
          </button>
        )}
      </div>
    </div>
  );
}
