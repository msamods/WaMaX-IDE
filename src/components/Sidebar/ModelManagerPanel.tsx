import React, { useState } from 'react';
import { Cpu, Download, Check, HardDrive, Zap, Info } from 'lucide-react';

interface Props {
  models: { name: string; sizeMB: number; modified_at: string }[];
  activeModel: string;
  onSelectModel: (name: string) => void;
  systemMetrics?: {
    totalMemMB: number;
    freeMemMB: number;
    usedMemMB: number;
    percentUsed: number;
  };
}

export const ModelManagerPanel: React.FC<Props> = ({
  models,
  activeModel,
  onSelectModel,
  systemMetrics
}) => {
  const [pullInput, setPullInput] = useState('');
  const [pulling, setPulling] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullInput.trim() || pulling) return;
    setPulling(true);
    setStatusMsg(`Downloading ${pullInput.trim()}...`);
    try {
      const res = await fetch('/api/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pullInput.trim() })
      });
      setStatusMsg('Model pulled successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setStatusMsg(`Pull failed: ${e.message}`);
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Cpu size={14} className="text-cyan-400" />
          <span>Local Models (Ollama)</span>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono">
          {models.length} Available
        </span>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* RAM Zero-Waste Note (Addresses User Audio Note 1) */}
        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold">
            <Zap size={13} className="text-emerald-400" />
            <span>Zero-Cost RAM Optimization Active</span>
          </div>
          <p className="text-[10px] text-emerald-200/80 mt-1">
            WaMaX automatically sets <code className="bg-emerald-900/60 px-1 py-0.5 rounded font-mono">keep_alive: 0s</code>. 
            The AI model is unloaded from RAM immediately after generating answers so your laptop stays fast with 0 RAM wasted!
          </p>
        </div>

        {/* System RAM Gauge */}
        {systemMetrics && (
          <div className="p-3 rounded-lg border border-[#30363d] bg-[#161b22]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#8b949e] flex items-center gap-1.5">
                <HardDrive size={13} /> Laptop System Memory
              </span>
              <span className="font-mono text-cyan-400 font-medium">
                {systemMetrics.usedMemMB}MB / {systemMetrics.totalMemMB}MB ({systemMetrics.percentUsed}%)
              </span>
            </div>
            <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden border border-[#30363d]">
              <div
                className={`h-full transition-all ${
                  systemMetrics.percentUsed > 85 ? 'bg-red-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${systemMetrics.percentUsed}%` }}
              />
            </div>
          </div>
        )}

        {/* Model Pull Form */}
        <form onSubmit={handlePull} className="space-y-1.5">
          <label className="text-[11px] text-[#8b949e] block font-medium">Download Open-Weight Model</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="e.g. qwen2.5:1.5b or moondream"
              value={pullInput}
              onChange={e => setPullInput(e.target.value)}
              disabled={pulling}
              className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={pulling}
              className="px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              <Download size={13} />
              {pulling ? 'Pulling...' : 'Pull'}
            </button>
          </div>
          {statusMsg && (
            <p className="text-[10px] text-cyan-400 font-mono mt-1">{statusMsg}</p>
          )}
        </form>

        {/* Installed Models List */}
        <div className="space-y-2 pt-2">
          <label className="text-[11px] text-[#8b949e] block font-medium">Installed Models</label>
          {models.length === 0 ? (
            <div className="p-3 text-xs text-[#8b949e] text-center border border-[#30363d] rounded">
              No models installed in Ollama yet. Pull a model above!
            </div>
          ) : (
            models.map(m => {
              const isActive = m.name === activeModel;
              return (
                <div
                  key={m.name}
                  onClick={() => onSelectModel(m.name)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isActive
                      ? 'border-cyan-500 bg-[#161b22] shadow-sm shadow-cyan-500/10'
                      : 'border-[#30363d] bg-[#161b22]/40 hover:border-[#8b949e]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-white">
                      {m.name}
                    </span>
                    {isActive ? (
                      <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-sans">
                        <Check size={12} /> Default
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#8b949e]">
                        {m.sizeMB} MB
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
