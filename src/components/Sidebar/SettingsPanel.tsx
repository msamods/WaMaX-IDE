import React, { useState } from 'react';
import { Settings, Download, Upload, Shield, Moon, Monitor } from 'lucide-react';

interface Props {
  workspace: string;
  onSwitchWorkspace: (path: string) => void;
}

export const SettingsPanel: React.FC<Props> = ({ workspace, onSwitchWorkspace }) => {
  const [workspaceInput, setWorkspaceInput] = useState(workspace);
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [msg, setMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaceInput.trim() !== workspace) {
      onSwitchWorkspace(workspaceInput.trim());
    }
    setMsg('Settings saved successfully!');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Settings size={14} className="text-cyan-400" />
          <span>Settings</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-3 space-y-4 flex-1 overflow-y-auto">
        <div>
          <label className="text-[11px] text-[#8b949e] block mb-1">Active Workspace Folder</label>
          <input
            type="text"
            value={workspaceInput}
            onChange={e => setWorkspaceInput(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] text-[#8b949e] block mb-1">Ollama API Host</label>
          <input
            type="text"
            value={ollamaUrl}
            onChange={e => setOllamaUrl(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
          />
          <p className="text-[10px] text-[#8b949e] mt-1">
            Default: http://127.0.0.1:11434 (or your LAN laptop IP: http://192.168.1.36:11434)
          </p>
        </div>

        <div className="p-3 rounded-lg border border-[#30363d] bg-[#161b22] space-y-2">
          <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Shield size={14} className="text-emerald-400" />
            Security & Privacy
          </h4>
          <p className="text-[11px] text-[#8b949e]">
            WaMaX IDE is 100% local-first. Zero telemetry, no cloud accounts, and no paid API calls. All code analysis stays strictly on your machine.
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors"
        >
          Save Configuration
        </button>

        {msg && <p className="text-xs text-emerald-400 text-center font-medium">{msg}</p>}
      </form>
    </div>
  );
};
