import React, { useState, useEffect } from 'react';
import {
  Server,
  Key,
  Layers,
  Cpu,
  Gauge,
  ScrollText,
  ShieldAlert,
  BookOpen,
  PlayCircle,
  Settings as SettingsIcon,
  Play,
  Square,
  RotateCw,
  Copy,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Lock,
  Wifi,
  Radio,
  FileCode,
  Terminal,
  Send,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../../services/api';

export type GatewayTab =
  | 'overview'
  | 'keys'
  | 'endpoints'
  | 'access'
  | 'ratelimits'
  | 'logs'
  | 'security'
  | 'docs'
  | 'playground'
  | 'settings';

export const ApiGatewayDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GatewayTab>('overview');
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New Key Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    'chat:completions',
    'models:read'
  ]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(30);
  const [newKeyAllowedModels, setNewKeyAllowedModels] = useState('*');
  const [newKeyAllowedBrains, setNewKeyAllowedBrains] = useState('*');
  const [recentlyCreatedSecret, setRecentlyCreatedSecret] = useState<string | null>(null);

  // LAN confirmation modal state
  const [showLanModal, setShowLanModal] = useState(false);

  // Playground state
  const [playgroundKey, setPlaygroundKey] = useState('');
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState('/api/v2/chat/completions');
  const [playgroundMethod, setPlaygroundMethod] = useState('POST');
  const [playgroundBody, setPlaygroundBody] = useState(
    JSON.stringify(
      {
        model: 'local-default',
        messages: [{ role: 'user', content: 'Hello WaMaX IDE!' }],
        stream: false,
        temperature: 0.7
      },
      null,
      2
    )
  );
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);
  const [playgroundHeaders, setPlaygroundHeaders] = useState<any>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundDuration, setPlaygroundDuration] = useState<number | null>(null);
  const [playgroundStreamOutput, setPlaygroundStreamOutput] = useState('');

  // Logs filter
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [logEndpointFilter, setLogEndpointFilter] = useState('');

  const refreshAll = async () => {
    try {
      const [st, cfg, k, l, s] = await Promise.all([
        api.getGatewayStatus(),
        api.getGatewayConfig(),
        api.getGatewayKeys(),
        api.getGatewayLogs(),
        api.getGatewayStats()
      ]);
      setStatus(st);
      setConfig(cfg);
      setKeys(k || []);
      setLogs(l || []);
      setStats(s || {});
    } catch (e) {
      console.error('Failed to load gateway status:', e);
    }
  };

  useEffect(() => {
    refreshAll();
    const timer = setInterval(refreshAll, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      await api.startGateway();
      await refreshAll();
    } catch (e: any) {
      alert(`Start failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await api.stopGateway();
      await refreshAll();
    } catch (e: any) {
      alert(`Stop failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    try {
      await api.restartGateway();
      await refreshAll();
    } catch (e: any) {
      alert(`Restart failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please enter a key name.');
      return;
    }
    try {
      const created = await api.createGatewayKey({
        name: newKeyName.trim(),
        permissions: newKeyPermissions,
        rateLimitRpm: newKeyRateLimit,
        allowedModels: newKeyAllowedModels.split(',').map((s) => s.trim()),
        allowedBrains: newKeyAllowedBrains.split(',').map((s) => s.trim())
      });
      setRecentlyCreatedSecret(created.rawSecret);
      setPlaygroundKey(created.rawSecret);
      setShowCreateModal(false);
      setNewKeyName('');
      await refreshAll();
    } catch (e: any) {
      alert(`Key creation failed: ${e.message}`);
    }
  };

  const handleRotateKey = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to rotate key "${name}"? The previous secret will stop working immediately.`)) {
      return;
    }
    try {
      const res = await api.rotateGatewayKey(id);
      setRecentlyCreatedSecret(res.rawSecret);
      setPlaygroundKey(res.rawSecret);
      await refreshAll();
    } catch (e: any) {
      alert(`Rotation failed: ${e.message}`);
    }
  };

  const handleRevokeKey = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently revoke key "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.revokeGatewayKey(id);
      await refreshAll();
    } catch (e: any) {
      alert(`Revocation failed: ${e.message}`);
    }
  };

  const handleDeleteKey = async (id: string, name: string) => {
    if (!confirm(`Delete key record "${name}"?`)) return;
    try {
      await api.deleteGatewayKey(id);
      await refreshAll();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleToggleKeyStatus = async (key: any) => {
    const nextStatus = key.status === 'active' ? 'disabled' : 'active';
    try {
      await api.updateGatewayKey(key.id, { status: nextStatus });
      await refreshAll();
    } catch (e: any) {
      alert(`Update failed: ${e.message}`);
    }
  };

  const handleToggleLan = async (enable: boolean) => {
    if (enable) {
      setShowLanModal(true);
    } else {
      await api.updateGatewayConfig({ lanEnabled: false });
      await refreshAll();
    }
  };

  const confirmEnableLan = async () => {
    try {
      await api.updateGatewayConfig({ lanEnabled: true });
      setShowLanModal(false);
      await refreshAll();
    } catch (e: any) {
      alert(`Failed to enable LAN mode: ${e.message}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Playground Execution
  const handlePlaygroundSend = async () => {
    setPlaygroundLoading(true);
    setPlaygroundResponse(null);
    setPlaygroundHeaders(null);
    setPlaygroundStreamOutput('');
    const t0 = Date.now();

    const baseUrl = status?.localBaseUrl || 'http://127.0.0.1:8787/api/v2';
    const cleanUrl = baseUrl.replace(/\/api\/v2$/, '') + playgroundEndpoint;

    let bodyData: any = undefined;
    let isStream = false;

    if (playgroundMethod === 'POST' || playgroundMethod === 'PATCH') {
      try {
        bodyData = JSON.parse(playgroundBody);
        if (bodyData.stream) isStream = true;
      } catch (err) {
        alert('Invalid JSON in request body');
        setPlaygroundLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(cleanUrl, {
        method: playgroundMethod,
        headers: {
          'Content-Type': 'application/json',
          Authorization: playgroundKey ? `Bearer ${playgroundKey.trim()}` : ''
        },
        body: bodyData ? JSON.stringify(bodyData) : undefined
      });

      setPlaygroundDuration(Date.now() - t0);

      // Safe headers collection
      const hdrs: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        if (['content-type', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'].includes(key.toLowerCase())) {
          hdrs[key] = val;
        }
      });
      setPlaygroundHeaders(hdrs);

      if (isStream && res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          full += chunk;
          setPlaygroundStreamOutput(full);
        }
      } else {
        const json = await res.json().catch(() => ({ status: res.statusText }));
        setPlaygroundResponse(json);
      }
    } catch (e: any) {
      setPlaygroundDuration(Date.now() - t0);
      setPlaygroundResponse({ error: { code: 'NETWORK_ERROR', message: e.message } });
    } finally {
      setPlaygroundLoading(false);
      refreshAll();
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Server },
    { id: 'keys', label: 'API Keys', icon: Key, badge: keys.length },
    { id: 'endpoints', label: 'API Endpoints', icon: Layers },
    { id: 'access', label: 'Model & Brain Access', icon: Cpu },
    { id: 'ratelimits', label: 'Rate Limits', icon: Gauge },
    { id: 'logs', label: 'Usage & Logs', icon: ScrollText, badge: logs.length },
    { id: 'security', label: 'Network & Security', icon: ShieldAlert },
    { id: 'docs', label: 'API Documentation', icon: BookOpen },
    { id: 'playground', label: 'Playground', icon: PlayCircle },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  const isRunning = status?.status === 'running';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/20">
            <Radio size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Developer Tools</span>
              <span className="text-[#8b949e]">/</span>
              <span className="font-semibold text-xs text-cyan-400">API Gateway</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                v2
              </span>
            </div>
            <div className="text-[10px] text-[#8b949e]">
              WaMax | Developed By MSAMODS x WhatYouWantKerala
            </div>
          </div>
        </div>

        {/* Server Status & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0d1117] border border-[#30363d] text-xs font-mono">
            <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={isRunning ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
            <span className="text-[#8b949e]">
              ({status?.host || '127.0.0.1'}:{status?.port || 8787})
            </span>
          </div>

          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-xs font-medium transition-colors"
            >
              <Square size={13} />
              Stop Server
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-medium transition-colors"
            >
              <Play size={13} />
              Start Server
            </button>
          )}

          <button
            onClick={handleRestart}
            disabled={loading}
            title="Restart API Gateway"
            className="p-1.5 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9] border border-[#30363d] transition-colors"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Secret Banner Alert if key was just created */}
      {recentlyCreatedSecret && (
        <div className="bg-amber-950/60 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">New Secret Key Generated:</span> Please copy this secret now. It will NEVER be shown again!
              <div className="font-mono bg-black/40 px-2 py-0.5 rounded mt-1 border border-amber-500/30 text-amber-300 select-all inline-block mr-2">
                {recentlyCreatedSecret}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(recentlyCreatedSecret, 'new-secret')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
            >
              {copiedKey === 'new-secret' ? <Check size={13} /> : <Copy size={13} />}
              {copiedKey === 'new-secret' ? 'Copied!' : 'Copy Secret'}
            </button>
            <button
              onClick={() => setRecentlyCreatedSecret(null)}
              className="px-2 py-1 rounded hover:bg-amber-900/50 text-amber-400 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs Bar */}
      <div className="bg-[#161b22] border-b border-[#30363d] flex items-center px-2 overflow-x-auto gap-1 text-xs shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as GatewayTab)}
              className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'border-cyan-400 text-cyan-400 bg-[#0d1117]/60'
                  : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]/40'
              }`}
            >
              <Icon size={14} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#30363d] text-[#c9d1d9] font-mono">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-5 select-text">
        {/* --- 1. OVERVIEW TAB --- */}
        {activeTab === 'overview' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Status & URLs Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b949e] uppercase font-bold tracking-wider">Gateway Status</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {isRunning ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-lg font-bold text-white">
                    {status?.listeningAddress || '127.0.0.1'}:{status?.port || 8787}
                  </div>
                  <div className="text-xs text-[#8b949e] mt-1">
                    Version: <span className="font-mono text-cyan-400">v2</span> • Host Mode: Localhost First
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b949e] uppercase font-bold tracking-wider">Local Base URL</span>
                  <button
                    onClick={() => copyToClipboard(status?.localBaseUrl || 'http://127.0.0.1:8787/api/v2', 'local-url')}
                    className="text-[#8b949e] hover:text-cyan-400"
                    title="Copy URL"
                  >
                    {copiedKey === 'local-url' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="mt-2 font-mono text-xs bg-[#0d1117] p-2 rounded border border-[#30363d] text-cyan-300 truncate">
                  {status?.localBaseUrl || 'http://127.0.0.1:8787/api/v2'}
                </div>
                <div className="text-[11px] text-[#8b949e] mt-1">
                  Accessible only on this device (100% secure loopback)
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b949e] uppercase font-bold tracking-wider">LAN Interface</span>
                  {status?.lanEnabled ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300">
                      LAN ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#21262d] text-[#8b949e]">
                      DISABLED
                    </span>
                  )}
                </div>
                <div className="mt-2 font-mono text-xs bg-[#0d1117] p-2 rounded border border-[#30363d] text-amber-300 truncate">
                  {status?.lanBaseUrl || 'LAN access disabled by default'}
                </div>
                <div className="text-[11px] text-[#8b949e] mt-1">
                  {status?.lanEnabled ? (
                    'Accessible to authorized devices on local Wi-Fi'
                  ) : (
                    <button onClick={() => setShowLanModal(true)} className="text-cyan-400 hover:underline">
                      Enable LAN mode safely...
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics Counter Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                <div className="text-[11px] text-[#8b949e]">Active API Keys</div>
                <div className="text-xl font-bold text-white mt-1">{stats?.activeKeysCount ?? 0}</div>
                <div className="text-[10px] text-[#8b949e]">{keys.length} total keys</div>
              </div>
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                <div className="text-[11px] text-[#8b949e]">Total Requests</div>
                <div className="text-xl font-bold text-cyan-400 mt-1">{stats?.totalRequests ?? 0}</div>
                <div className="text-[10px] text-emerald-400">{stats?.successRequests ?? 0} successful</div>
              </div>
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                <div className="text-[11px] text-[#8b949e]">Errors & Rejections</div>
                <div className="text-xl font-bold text-red-400 mt-1">{stats?.failedRequests ?? 0}</div>
                <div className="text-[10px] text-amber-400">{stats?.rateLimitedRequests ?? 0} rate-limited</div>
              </div>
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                <div className="text-[11px] text-[#8b949e]">Avg Latency</div>
                <div className="text-xl font-bold text-white mt-1">{stats?.avgDurationMs ?? 0} ms</div>
                <div className="text-[10px] text-[#8b949e]">local inference</div>
              </div>
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                <div className="text-[11px] text-[#8b949e]">Inference Semaphore</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {stats?.activeInferences ?? 0} / 1
                </div>
                <div className="text-[10px] text-[#8b949e]">7GB RAM Safe Mode</div>
              </div>
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                <div className="text-[11px] text-[#8b949e]">Default Model</div>
                <div className="text-sm font-bold text-amber-300 mt-1 truncate">qwen2.5:1.5b</div>
                <div className="text-[10px] text-emerald-400">Zero-RAM keep_alive</div>
              </div>
            </div>

            {/* Quick cURL Example Card */}
            <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white flex items-center gap-2">
                  <Terminal size={14} className="text-cyan-400" />
                  Quick Integration Example (OpenAI SDK Compatible)
                </span>
                <span className="text-[11px] text-[#8b949e]">cURL / Bash</span>
              </div>
              <pre className="font-mono text-xs bg-[#0d1117] p-3 rounded border border-[#30363d] text-cyan-300 overflow-x-auto">
{`curl -X POST http://127.0.0.1:8787/api/v2/chat/completions \\
  -H "Authorization: Bearer ${keys[0]?.prefix || 'wmx_live_YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "local-default",
    "messages": [{"role": "user", "content": "Explain Docker in 2 sentences."}],
    "stream": false
  }'`}
              </pre>
            </div>
          </div>
        )}

        {/* --- 2. API KEYS TAB --- */}
        {activeTab === 'keys' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-white">API Keys Management</h2>
                <p className="text-xs text-[#8b949e]">
                  Cryptographically secure keys for authorized external applications (websites, bots, CLI tools).
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors shadow-sm"
              >
                <Plus size={14} />
                Create New API Key
              </button>
            </div>

            {/* Keys Table */}
            <div className="rounded-lg bg-[#161b22] border border-[#30363d] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#21262d] text-[#8b949e] border-b border-[#30363d]">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Key Prefix</th>
                    <th className="px-4 py-2.5">Permissions</th>
                    <th className="px-4 py-2.5">Rate Limit</th>
                    <th className="px-4 py-2.5">Usage</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-[#1f242c] transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">
                        <div>{k.name}</div>
                        {k.description && <div className="text-[10px] text-[#8b949e]">{k.description}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-300">{k.prefix}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {k.permissions.map((p: string) => (
                            <span
                              key={p}
                              className="px-1.5 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[10px] text-[#8b949e]"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#c9d1d9]">{k.rateLimitRpm} rpm</td>
                      <td className="px-4 py-3 text-[#8b949e]">
                        <div>{k.requestCount || 0} reqs</div>
                        <div className="text-[10px]">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleTimeString() : 'Never'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            k.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : k.status === 'disabled'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {k.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {k.status !== 'revoked' && (
                          <>
                            <button
                              onClick={() => handleToggleKeyStatus(k)}
                              className="text-xs text-[#8b949e] hover:text-white"
                              title={k.status === 'active' ? 'Disable Key' : 'Enable Key'}
                            >
                              {k.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleRotateKey(k.id, k.name)}
                              className="text-xs text-amber-400 hover:underline"
                              title="Rotate Key Secret"
                            >
                              Rotate
                            </button>
                            <button
                              onClick={() => handleRevokeKey(k.id, k.name)}
                              className="text-xs text-red-400 hover:underline"
                              title="Permanently Revoke"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteKey(k.id, k.name)}
                          className="text-xs text-[#8b949e] hover:text-red-400 ml-2"
                          title="Delete Record"
                        >
                          <Trash2 size={12} className="inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-[#8b949e]">
                        No API Keys created yet. Click "Create New API Key" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 3. API ENDPOINTS CATALOG --- */}
        {activeTab === 'endpoints' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div>
              <h2 className="font-bold text-base text-white">Supported v2 API Endpoints</h2>
              <p className="text-xs text-[#8b949e]">
                Versioned developer endpoints with strict authentication, deterministic safety rules, and zero RAM waste.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  method: 'GET',
                  path: '/api/v2/health',
                  auth: 'Public',
                  desc: 'Public health status and API version.',
                  res: '{"status": "ok", "service": "WaMaX IDE API", "version": "v2"}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/ready',
                  auth: 'Bearer Key',
                  desc: 'Authenticated readiness verification with system memory metrics.',
                  res: '{"status": "ready", "inference_ready": true, "system": {"memory_usage_percent": 45}}'
                },
                {
                  method: 'POST',
                  path: '/api/v2/chat/completions',
                  auth: 'Bearer Key (chat:completions)',
                  desc: 'OpenAI-compatible chat endpoint. Supports model aliases, brain injection, memory retrieval, and SSE streaming with keep_alive: 0s.',
                  res: '{"id": "chatcmpl-...", "object": "chat.completion", "choices": [{"message": {"role": "assistant", "content": "..."}}]}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/models',
                  auth: 'Bearer Key (models:read)',
                  desc: 'Discover authorized models and aliases (e.g. local-default, qwen2.5:1.5b).',
                  res: '{"object": "list", "data": [{"id": "local-default", "ready": true}]}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/brains',
                  auth: 'Bearer Key (brains:read)',
                  desc: 'List AI brains assigned to the authenticated key.',
                  res: '{"object": "list", "data": [{"id": "brain-master", "name": "WaMaX Master Coding Brain"}]}'
                },
                {
                  method: 'POST',
                  path: '/api/v2/brains/:brainId/chat',
                  auth: 'Bearer Key (brains:chat)',
                  desc: 'Direct chat completion bound to a specific brain persona and instructions.',
                  res: '{"id": "chatcmpl-...", "choices": [{"message": {"content": "..."}}]}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/rules',
                  auth: 'Bearer Key (rules:read)',
                  desc: 'Inspect active global, project, and inviolable safety rules.',
                  res: '{"object": "list", "data": [{"id": "safety-001", "priority": 1000}]}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/agents',
                  auth: 'Bearer Key (agents:read)',
                  desc: 'List available autonomous agents and approval levels.',
                  res: '{"object": "list", "data": [{"id": "agent-coding", "role": "Senior Developer"}]}'
                },
                {
                  method: 'POST',
                  path: '/api/v2/agents/:agentId/tasks',
                  auth: 'Bearer Key (agents:run)',
                  desc: 'Submit task to an agent. Requires approval if destructive.',
                  res: '{"task_id": "task_...", "status": "running"}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/memory/search',
                  auth: 'Bearer Key (memory:read)',
                  desc: 'Keyword search across persistent project memories.',
                  res: '{"object": "list", "data": [{"id": "mem-1", "content": "..."}]}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/images/capabilities',
                  auth: 'Bearer Key (images:generate)',
                  desc: 'Probe local ComfyUI provider status.',
                  res: '{"provider": "ComfyUI (Local)", "available": false}'
                },
                {
                  method: 'GET',
                  path: '/api/v2/openapi.json',
                  auth: 'Public',
                  desc: 'OpenAPI 3.0 specification definition for automatic SDK generation.',
                  res: '{"openapi": "3.0.3", "info": {"title": "WaMaX IDE Developer API"}}'
                }
              ].map((ep) => (
                <div key={ep.path} className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                          ep.method === 'GET'
                            ? 'bg-blue-500/20 text-blue-400'
                            : ep.method === 'POST'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs font-semibold text-white">{ep.path}</span>
                    </div>
                    <span className="text-[11px] text-[#8b949e] font-mono bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
                      {ep.auth}
                    </span>
                  </div>
                  <div className="text-xs text-[#8b949e]">{ep.desc}</div>
                  <div className="font-mono text-[11px] bg-[#0d1117] p-2 rounded border border-[#30363d] text-[#8b949e] truncate">
                    Sample Response: <span className="text-cyan-300">{ep.res}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 4. MODEL & BRAIN ACCESS TAB --- */}
        {activeTab === 'access' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h2 className="font-bold text-base text-white">Model & Brain Access Configuration</h2>
              <p className="text-xs text-[#8b949e]">
                Control which local LLM weights and Brain Studio personas can be queried by external callers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Models Box */}
              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
                <span className="font-bold text-xs text-white flex items-center gap-2">
                  <Cpu size={15} className="text-cyan-400" />
                  Local Model Aliases & Readiness
                </span>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                    <div>
                      <div className="font-mono text-white font-semibold">local-default</div>
                      <div className="text-[10px] text-[#8b949e]">Mapped to qwen2.5:1.5b (1.5B Q4_K_M)</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      READY
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                    <div>
                      <div className="font-mono text-white font-semibold">qwen2.5:1.5b</div>
                      <div className="text-[10px] text-[#8b949e]">Memory: ~986 MB RAM during inference only</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      INSTALLED
                    </span>
                  </div>
                </div>
              </div>

              {/* Brains Box */}
              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
                <span className="font-bold text-xs text-white flex items-center gap-2">
                  <Layers size={15} className="text-purple-400" />
                  Brain Studio Persona Access
                </span>
                <div className="space-y-2 text-xs">
                  {[
                    { id: 'brain-master', name: 'WaMaX Master Coding Brain', role: 'Full-Stack Lead' },
                    { id: 'brain-python', name: 'Python Expert', role: 'Backend & ML' },
                    { id: 'brain-security', name: 'Security Auditor', role: 'Vulnerability Analysis' },
                    { id: 'brain-doubt', name: 'Doubt Solving Mentor', role: 'Step-by-step Explainer' }
                  ].map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white">{b.name}</div>
                        <div className="text-[10px] text-[#8b949e]">ID: {b.id} • {b.role}</div>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-mono">Restricted to Key</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 5. RATE LIMITS TAB --- */}
        {activeTab === 'ratelimits' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-bold text-base text-white">Rate Limiting & Resource Throttling</h2>
              <p className="text-xs text-[#8b949e]">
                Guarantees zero RAM exhaustion on 7GB RAM host systems using active backpressure and concurrency semaphores.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Default Requests Per Minute (RPM) per Key
                  </label>
                  <input
                    type="number"
                    value={config?.rateLimitRpmDefault || 30}
                    onChange={(e) => api.updateGatewayConfig({ rateLimitRpmDefault: parseInt(e.target.value, 10) }).then(refreshAll)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-[#8b949e]">Exceeding requests return HTTP 429 with Retry-After header.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Max Concurrent Local Inference Tasks
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={config?.maxConcurrentInference || 1}
                    onChange={(e) => api.updateGatewayConfig({ maxConcurrentInference: parseInt(e.target.value, 10) }).then(refreshAll)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-emerald-400 font-semibold">Recommended: 1 for 7GB RAM environment.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Max Request Body Size (MB)
                  </label>
                  <input
                    type="number"
                    value={config?.maxBodyMb || 2}
                    onChange={(e) => api.updateGatewayConfig({ maxBodyMb: parseInt(e.target.value, 10) }).then(refreshAll)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-[#8b949e]">Prevents memory denial-of-service from large payloads.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Max Queued Tasks Before Backpressure
                  </label>
                  <input
                    type="number"
                    value={config?.maxQueueLength || 20}
                    onChange={(e) => api.updateGatewayConfig({ maxQueueLength: parseInt(e.target.value, 10) }).then(refreshAll)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-[#8b949e]">Rejects excess work with HTTP 503 rather than exhausting RAM.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 6. USAGE & LOGS TAB --- */}
        {activeTab === 'logs' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-white">Usage & Audit Logs</h2>
                <p className="text-xs text-[#8b949e]">
                  Cryptographically redacted audit trail. Secrets are never stored or exposed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => api.clearGatewayLogs().then(refreshAll)}
                  className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-red-900/40 text-[#8b949e] hover:text-red-300 border border-[#30363d] text-xs transition-colors"
                >
                  Clear Logs
                </button>
                <button
                  onClick={refreshAll}
                  className="p-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white"
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-3 text-xs bg-[#161b22] p-2.5 rounded-lg border border-[#30363d]">
              <span className="text-[#8b949e]">Filter:</span>
              <input
                type="text"
                placeholder="Endpoint..."
                value={logEndpointFilter}
                onChange={(e) => setLogEndpointFilter(e.target.value)}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-white"
              />
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-white"
              >
                <option value="">All Statuses</option>
                <option value="200">200 OK</option>
                <option value="401">401 Unauthorized</option>
                <option value="403">403 Forbidden</option>
                <option value="429">429 Rate Limited</option>
                <option value="500">500 Server Error</option>
              </select>
            </div>

            {/* Logs Table */}
            <div className="rounded-lg bg-[#161b22] border border-[#30363d] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#21262d] text-[#8b949e] border-b border-[#30363d]">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Key Prefix</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Endpoint</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Model/Brain</th>
                    <th className="px-3 py-2">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d] font-mono text-[11px]">
                  {logs
                    .filter((l) => (!logStatusFilter || l.status === parseInt(logStatusFilter, 10)))
                    .filter((l) => (!logEndpointFilter || l.endpoint.includes(logEndpointFilter)))
                    .map((l) => (
                      <tr key={l.id} className="hover:bg-[#1f242c]">
                        <td className="px-3 py-2 text-[#8b949e] whitespace-nowrap">
                          {new Date(l.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2 text-cyan-300">{l.keyPrefix}</td>
                        <td className="px-3 py-2 text-white font-semibold">{l.method}</td>
                        <td className="px-3 py-2 text-[#c9d1d9] truncate max-w-xs">{l.endpoint}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              l.status >= 200 && l.status < 300
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : l.status === 429
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#8b949e]">{l.durationMs}ms</td>
                        <td className="px-3 py-2 text-[#8b949e]">{l.model || l.brain || '—'}</td>
                        <td className="px-3 py-2 text-[#8b949e]">{l.totalTokens ? `${l.totalTokens}t` : '—'}</td>
                      </tr>
                    ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-[#8b949e]">
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 7. NETWORK & SECURITY TAB --- */}
        {activeTab === 'security' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-bold text-base text-white">Network & Security Controls</h2>
              <p className="text-xs text-[#8b949e]">
                Manage network interface binding, LAN access, and security postures.
              </p>
            </div>

            {/* Network Interface Binding */}
            <div className="p-5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Local Area Network (LAN) Access</div>
                  <div className="text-xs text-[#8b949e]">
                    Allow other devices on your home or office Wi-Fi to send requests with valid API keys.
                  </div>
                </div>
                <button
                  onClick={() => handleToggleLan(!status?.lanEnabled)}
                  className={`px-3 py-1.5 rounded font-semibold text-xs transition-colors ${
                    status?.lanEnabled
                      ? 'bg-amber-500 text-black hover:bg-amber-400'
                      : 'bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]'
                  }`}
                >
                  {status?.lanEnabled ? 'LAN Enabled' : 'Enable LAN Access'}
                </button>
              </div>

              {/* Detected Interfaces List */}
              <div className="pt-2 border-t border-[#30363d] space-y-2">
                <div className="text-xs font-semibold text-white">Detected Network Interfaces:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">Loopback Interface (lo)</div>
                      <div className="text-[11px] text-cyan-400">127.0.0.1 (Localhost Only)</div>
                    </div>
                    <span className="text-[10px] text-emerald-400">ACTIVE</span>
                  </div>

                  {(config?.detectedInterfaces || []).map((net: any) => (
                    <div key={net.address} className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                      <div>
                        <div className="text-white font-semibold">{net.name}</div>
                        <div className="text-[11px] text-amber-300">{net.address} (LAN)</div>
                      </div>
                      <span className="text-[10px] text-[#8b949e]">{net.mac}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Security Best Practices Checklist */}
            <div className="p-5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <Lock size={15} className="text-emerald-400" />
                Security Architecture & Enforcement Checklist
              </span>
              <ul className="space-y-2 text-xs text-[#8b949e]">
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Hashed Secrets:</strong> All API keys are stored as SHA-256 hashes and compared using constant-time algorithms.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Zero Secret Exposure:</strong> Raw keys never appear in logs, error responses, or telemetry.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Localhost Default:</strong> Never exposes ports to the public internet automatically.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Resource Safeguards:</strong> 1 concurrent inference limit guarantees the host 7GB RAM won't freeze or crash.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* --- 8. API DOCUMENTATION TAB --- */}
        {activeTab === 'docs' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-white">API Developer Documentation</h2>
                <p className="text-xs text-[#8b949e]">
                  Official client examples and integration guides for WaMaX IDE Developer Gateway.
                </p>
              </div>
              <a
                href={`${status?.localBaseUrl || 'http://127.0.0.1:8787/api/v2'}/openapi.json`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-cyan-400 border border-[#30363d] text-xs font-mono"
              >
                <FileCode size={13} />
                Download openapi.json
              </a>
            </div>

            {/* Python Example */}
            <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
              <span className="font-semibold text-xs text-white">Python (OpenAI SDK Compatible)</span>
              <pre className="font-mono text-xs bg-[#0d1117] p-3 rounded border border-[#30363d] text-cyan-300 overflow-x-auto">
{`from openai import OpenAI

client = OpenAI(
    base_url="${status?.localBaseUrl || 'http://127.0.0.1:8787/api/v2'}",
    api_key="${keys[0]?.prefix || 'wmx_live_YOUR_API_KEY'}"
)

response = client.chat.completions.create(
    model="local-default",
    messages=[{"role": "user", "content": "How do I build microservices in Go?"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")`}
              </pre>
            </div>

            {/* JavaScript / TypeScript Example */}
            <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2">
              <span className="font-semibold text-xs text-white">JavaScript / TypeScript (Fetch)</span>
              <pre className="font-mono text-xs bg-[#0d1117] p-3 rounded border border-[#30363d] text-cyan-300 overflow-x-auto">
{`const response = await fetch('${status?.localBaseUrl || 'http://127.0.0.1:8787/api/v2'}/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer wmx_live_YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'local-default',
    messages: [{ role: 'user', content: 'Explain REST vs GraphQL' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);`}
              </pre>
            </div>
          </div>
        )}

        {/* --- 9. PLAYGROUND TAB --- */}
        {activeTab === 'playground' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div>
              <h2 className="font-bold text-base text-white">Interactive API Playground</h2>
              <p className="text-xs text-[#8b949e]">
                Test endpoints directly with live headers, timing diagnostics, and real streaming tokens.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Request Builder */}
              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3 flex flex-col">
                <span className="font-bold text-xs text-white">Request Configuration</span>

                <div>
                  <label className="block text-[11px] text-[#8b949e] mb-1">API Key for Authorization</label>
                  <input
                    type="password"
                    placeholder="Enter or paste wmx_live_... secret"
                    value={playgroundKey}
                    onChange={(e) => setPlaygroundKey(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-cyan-300 font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={playgroundMethod}
                    onChange={(e) => setPlaygroundMethod(e.target.value)}
                    className="w-24 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-xs text-white font-mono font-bold"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <select
                    value={playgroundEndpoint}
                    onChange={(e) => setPlaygroundEndpoint(e.target.value)}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-xs text-white font-mono"
                  >
                    <option value="/api/v2/chat/completions">/api/v2/chat/completions</option>
                    <option value="/api/v2/models">/api/v2/models</option>
                    <option value="/api/v2/ready">/api/v2/ready</option>
                    <option value="/api/v2/health">/api/v2/health</option>
                    <option value="/api/v2/brains">/api/v2/brains</option>
                    <option value="/api/v2/rules">/api/v2/rules</option>
                    <option value="/api/v2/memory/search">/api/v2/memory/search</option>
                    <option value="/api/v2/images/capabilities">/api/v2/images/capabilities</option>
                  </select>
                </div>

                {playgroundMethod !== 'GET' && (
                  <div className="flex-1 flex flex-col">
                    <label className="block text-[11px] text-[#8b949e] mb-1">Request Body (JSON)</label>
                    <textarea
                      rows={10}
                      value={playgroundBody}
                      onChange={(e) => setPlaygroundBody(e.target.value)}
                      className="w-full flex-1 bg-[#0d1117] border border-[#30363d] rounded p-2.5 text-xs text-cyan-300 font-mono resize-none"
                    />
                  </div>
                )}

                <button
                  onClick={handlePlaygroundSend}
                  disabled={playgroundLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-sm"
                >
                  {playgroundLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {playgroundLoading ? 'Executing Request...' : 'Send Request'}
                </button>
              </div>

              {/* Right Column: Response Viewer */}
              <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">Response Viewer</span>
                  {playgroundDuration !== null && (
                    <span className="text-[11px] font-mono text-[#8b949e]">
                      Duration: <span className="text-white font-bold">{playgroundDuration}ms</span>
                    </span>
                  )}
                </div>

                {/* Response Headers */}
                {playgroundHeaders && (
                  <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] text-[10px] font-mono text-[#8b949e] space-y-0.5">
                    {Object.entries(playgroundHeaders).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-cyan-400">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Response Body */}
                <div className="flex-1 min-h-[260px] bg-[#0d1117] border border-[#30363d] rounded p-3 overflow-y-auto font-mono text-xs text-emerald-300">
                  {playgroundStreamOutput ? (
                    <pre className="whitespace-pre-wrap">{playgroundStreamOutput}</pre>
                  ) : playgroundResponse ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(playgroundResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-[#8b949e] text-center mt-20">
                      Response will appear here after sending request.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 10. SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-bold text-base text-white">Gateway Server Settings</h2>
              <p className="text-xs text-[#8b949e]">
                Port configuration, auto-start behavior, and privacy toggles.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    API Gateway Port (Default: 8787)
                  </label>
                  <input
                    type="number"
                    value={config?.port || 8787}
                    onChange={(e) => api.updateGatewayConfig({ port: parseInt(e.target.value, 10) }).then(refreshAll)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Default Listening Host
                  </label>
                  <input
                    type="text"
                    disabled
                    value={config?.host || '127.0.0.1'}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-[#8b949e] font-mono cursor-not-allowed"
                  />
                  <span className="text-[10px] text-[#8b949e]">Localhost default. Enable LAN from Network tab.</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#30363d] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Auto-start Gateway with WaMaX IDE</div>
                    <div className="text-[11px] text-[#8b949e]">Launch API server in the background whenever IDE starts.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.enabled !== false}
                    onChange={(e) => api.updateGatewayConfig({ enabled: e.target.checked }).then(refreshAll)}
                    className="w-4 h-4 rounded text-cyan-500 bg-[#0d1117]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Record Full Prompt & Completion Payloads in Logs</div>
                    <div className="text-[11px] text-amber-400 font-semibold">
                      Caution: Disabled by default for privacy. Logs only store metadata.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.contentLogging === true}
                    onChange={(e) => api.updateGatewayConfig({ contentLogging: e.target.checked }).then(refreshAll)}
                    className="w-4 h-4 rounded text-cyan-500 bg-[#0d1117]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- CREATE KEY MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Create New API Key</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#8b949e] hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#c9d1d9] mb-1">Key Name / Application Description</label>
                <input
                  type="text"
                  placeholder="e.g. My Website, HR Bot, Mobile App"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#c9d1d9] mb-1">Assigned Permissions</label>
                <div className="grid grid-cols-2 gap-2 p-2 bg-[#0d1117] border border-[#30363d] rounded">
                  {[
                    { id: 'chat:completions', label: 'Chat Completions' },
                    { id: 'models:read', label: 'Models Read' },
                    { id: 'brains:read', label: 'Brains Read' },
                    { id: 'brains:chat', label: 'Brains Chat' },
                    { id: 'rules:read', label: 'Rules Read' },
                    { id: 'agents:read', label: 'Agents Read' },
                    { id: 'agents:run', label: 'Agents Execute' },
                    { id: 'memory:read', label: 'Memory Read' },
                    { id: 'memory:write', label: 'Memory Write' },
                    { id: 'images:generate', label: 'Image Generation' }
                  ].map((p) => (
                    <label key={p.id} className="flex items-center gap-1.5 text-[11px] text-[#8b949e]">
                      <input
                        type="checkbox"
                        checked={newKeyPermissions.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewKeyPermissions([...newKeyPermissions, p.id]);
                          else setNewKeyPermissions(newKeyPermissions.filter((x) => x !== p.id));
                        }}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#c9d1d9] mb-1">Rate Limit (RPM)</label>
                  <input
                    type="number"
                    value={newKeyRateLimit}
                    onChange={(e) => setNewKeyRateLimit(parseInt(e.target.value, 10))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#c9d1d9] mb-1">Allowed Models</label>
                  <input
                    type="text"
                    value={newKeyAllowedModels}
                    onChange={(e) => setNewKeyAllowedModels(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-white font-mono"
                    placeholder="* or qwen2.5:1.5b"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                Generate API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LAN CONFIRMATION MODAL --- */}
      {showLanModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-amber-500/50 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={20} />
              <h3 className="font-bold text-sm text-white">Enable Local Network (LAN) Mode?</h3>
            </div>

            <div className="text-xs text-[#8b949e] space-y-2">
              <p>
                Enabling LAN mode binds the WaMaX API Gateway to <span className="font-mono text-white">0.0.0.0</span> so that other computers or phones on your Wi-Fi network (e.g. <span className="font-mono text-cyan-300">192.168.1.x</span>) can connect.
              </p>
              <div className="p-3 rounded bg-amber-950/40 border border-amber-500/30 text-amber-200 space-y-1">
                <div>⚠️ <strong>Important Security Considerations:</strong></div>
                <div>• HTTP traffic over local Wi-Fi is unencrypted.</div>
                <div>• Only allow trusted devices on your network to communicate with this port.</div>
                <div>• All incoming requests will still strictly require valid API keys (<span className="font-mono">wmx_live_...</span>).</div>
                <div>• Never configure automatic router port forwarding to the public internet.</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
              <button
                onClick={() => setShowLanModal(false)}
                className="px-3 py-1.5 rounded bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] text-xs font-medium"
              >
                Keep Localhost Only
              </button>
              <button
                onClick={confirmEnableLan}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold"
              >
                I Understand, Enable LAN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
