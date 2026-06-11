import React, { useEffect, useState, useCallback } from 'react';
import { Bot, Wifi, WifiOff, BookOpen, RefreshCw, Play, Square } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api/qq';

interface QQAccount {
  selfId: number;
  nickname: string;
  connectedAt: number;
  online: boolean;
}

interface QQStatus {
  initialized: boolean;
  running: boolean;
  accounts: QQAccount[];
}

interface WeeklyReport {
  generatedAt: string;
  weakestConcepts: { title: string; confidence: number }[];
}

export default function QQBotCard() {
  const [status, setStatus] = useState<QQStatus | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statusRes, reportRes] = await Promise.all([
        fetch(`${API_BASE}/status`),
        fetch(`${API_BASE}/report/weekly`),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (reportRes.ok) setReport(await reportRes.json());
      setLoading(false);
    } catch {
      setError('Failed to fetch QQ bot data');
      setLoading(false);
    }
  }, []);

  const startService = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, running: true } : null);
        setActionError(null);
      } else {
        const msg = data.hint
          ? `${data.error}\n\nFix: ${data.hint}`
          : (data.error || 'Start failed');
        setActionError(msg);
      }
    } catch {
      setActionError('Cannot connect to backend (localhost:3000)\nVerify backend is running: npx tsx backend/src/server.ts');
    }
    setActionLoading(false);
    fetchData();
  };

  const stopService = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, running: false, accounts: [] } : null);
        setActionError(null);
      } else {
        setActionError(data.error || 'Stop failed');
      }
    } catch {
      setActionError('Cannot connect to backend (localhost:3000)');
    }
    setActionLoading(false);
    fetchData();
  };

  const isRunning = status?.running;
  const hasOnlineAccount = status?.accounts?.some((a) => a.online);
  const waitingForLogin = isRunning && !hasOnlineAccount;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleSection = (section: string) => {
    setExpanded((prev) => (prev === section ? null : section));
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c0c0c',
        border: '3px solid #222222',
        boxShadow: '4px 4px 0px #000000',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: '12px',
        color: '#cccccc',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '2px solid #222222',
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '13px' }}>
            QQ Bot
          </span>
          {hasOnlineAccount && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                display: 'inline-block',
              }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {isRunning ? (
            <button
              onClick={stopService}
              disabled={actionLoading}
              style={{
                background: 'none',
                border: '1px solid #ef4444',
                color: '#ef4444',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                padding: '2px 8px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: actionLoading ? 0.5 : 1,
              }}
              title="Stop QQ Service"
            >
              <Square size={10} fill="#ef4444" /> Stop
            </button>
          ) : (
            <button
              onClick={startService}
              disabled={actionLoading}
              style={{
                background: 'none',
                border: '1px solid #22c55e',
                color: '#22c55e',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                padding: '2px 8px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: actionLoading ? 0.5 : 1,
              }}
              title="Start QQ Service"
            >
              <Play size={10} fill="#22c55e" /> Start
            </button>
          )}
          <button
            onClick={fetchData}
            style={{
              background: 'none',
              border: '1px solid #333333',
              color: '#888888',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666666' }}>
            Loading...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(255,0,0,0.1)',
              border: '1px solid #ff3333',
              color: '#ff6666',
              marginBottom: '10px',
            }}
          >
            {error}
          </div>
        )}

        {actionError && (
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(255,165,0,0.1)',
              border: '1px solid #ff9933',
              color: '#ff9933',
              marginBottom: '10px',
              fontSize: '11px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {actionError}
          </div>
        )}

        {waitingForLogin && (
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid #22c55e',
              color: '#22c55e',
              marginBottom: '10px',
              fontSize: '11px',
            }}
          >
            Waiting for QQ login... Scan QR code in the NapCat terminal window.
          </div>
        )}

        {/* Connection Status */}
        <SectionHeader
          icon={<Wifi size={12} />}
          label="Connection Status"
          expanded={expanded === 'status'}
          onToggle={() => toggleSection('status')}
        />
        {expanded === 'status' && (
          <div style={{ marginBottom: '10px' }}>
            {!status?.accounts?.length ? (
              <div style={{ color: '#666666', padding: '6px 0' }}>No QQ accounts connected</div>
            ) : (
              status.accounts.map((acc) => (
                <div
                  key={acc.selfId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 0',
                    borderBottom: '1px solid #1a1a1a',
                  }}
                >
                  {acc.online ? (
                    <Wifi size={12} style={{ color: '#22c55e' }} />
                  ) : (
                    <WifiOff size={12} style={{ color: '#ef4444' }} />
                  )}
                  <span style={{ color: '#ffffff' }}>{acc.selfId}</span>
                  <span style={{ fontSize: '10px', color: acc.online ? '#22c55e' : '#ef4444' }}>
                    {acc.online ? 'Online' : 'Offline'}
                  </span>
                  {acc.nickname && (
                    <span style={{ fontSize: '10px', color: '#888888' }}>({acc.nickname})</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Weak Concepts */}
        <SectionHeader
          icon={<BookOpen size={12} />}
          label="Weak Concepts"
          expanded={expanded === 'weak'}
          onToggle={() => toggleSection('weak')}
        />
        {expanded === 'weak' && (
          <div style={{ marginBottom: '10px' }}>
            {!report || report.weakestConcepts.length === 0 ? (
              <div style={{ color: '#666666', padding: '6px 0' }}>No data</div>
            ) : (
              report.weakestConcepts.map((c) => (
                <div
                  key={c.title}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '3px 0',
                    borderBottom: '1px solid #1a1a1a',
                    fontSize: '11px',
                  }}
                >
                  <span style={{ color: '#dddddd' }}>{c.title}</span>
                  <span style={{ color: '#ff9955' }}>conf. {c.confidence.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: '2px solid #222222',
          fontSize: '10px',
          color: '#555555',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span>Auto-refresh (30s)</span>
        {report && <span>Updated {new Date(report.generatedAt).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  expanded,
  onToggle,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 4px',
        cursor: 'pointer',
        borderBottom: expanded ? '1px solid var(--accent)' : '1px solid transparent',
        marginBottom: expanded ? '4px' : '0',
        transition: 'border-color 0.15s',
      }}
    >
      <span style={{ color: '#888888', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
        ▸
      </span>
      <span style={{ color: '#aaaaaa' }}>{icon}</span>
      <span style={{ color: '#cccccc', fontWeight: 600 }}>{label}</span>
      {badge && <span style={{ fontSize: '10px', color: '#888888', marginLeft: 'auto' }}>{badge}</span>}
    </div>
  );
}
