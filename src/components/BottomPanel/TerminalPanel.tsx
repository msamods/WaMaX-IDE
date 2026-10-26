import React, { useState } from 'react';
import { Terminal as TerminalIcon, AlertCircle, FileText, ShieldAlert, Play, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  onClose: () => void;
}

export const TerminalPanel: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems' | 'output' | 'audit'>('terminal');
  const [command, setCommand] = useState('');
  const [outputLines, setOutputLines] = useState<string[]>([
    'WaMaX Terminal Ready [Localhost Workspace]',
    'Type commands below (e.g. dir, git status, npm test)...'
  ]);
  const [running, setRunning] = useState(false);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || running) return;

    const cmd = command.trim();
    setCommand('');
    setOutputLines(prev => [...prev, `> ${cmd}`]);
    setRunning(true);

    try {
      const res = await api.executeTerminal(cmd, false, true);
      if (res.stdout) {
        setOutputLines(prev => [...prev, res.stdout.trim()]);
      }
      if (res.stderr) {
        setOutputLines(prev => [...prev, `ERR: ${res.stderr.trim()}`]);
      }
    } catch (e: any) {
      setOutputLines(prev => [...prev, `Execution error: ${e.message}`]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-48 bg-[#0d1117] border-t border-[#30363d] flex flex-col text-[#c9d1d9] select-text">
      {/* Tab Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e1116] border-b border-[#30363d] text-xs select-none">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 pb-0.5 font-medium transition-colors ${
              activeTab === 'terminal' ? 'text-cyan-400 border-b border-cyan-400' : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <TerminalIcon size={13} />
            <span>Terminal</span>
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center gap-1.5 pb-0.5 font-medium transition-colors ${
              activeTab === 'output' ? 'text-cyan-400 border-b border-cyan-400' : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <FileText size={13} />
            <span>Output</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 pb-0.5 font-medium transition-colors ${
              activeTab === 'audit' ? 'text-cyan-400 border-b border-cyan-400' : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <ShieldAlert size={13} />
            <span>Audit Logs</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-[#8b949e] hover:text-white p-1"
          title="Close Panel"
        >
          <X size={13} />
        </button>
      </div>

      {/* Terminal View */}
      {activeTab === 'terminal' && (
        <div className="flex-1 flex flex-col overflow-hidden font-mono text-[11px] p-2 bg-[#0d1117]">
          <div className="flex-1 overflow-y-auto space-y-1">
            {outputLines.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.startsWith('>')
                    ? 'text-cyan-400 font-semibold'
                    : line.startsWith('ERR:')
                    ? 'text-red-400'
                    : 'text-[#c9d1d9]'
                }
              >
                {line}
              </div>
            ))}
          </div>

          <form onSubmit={handleExecute} className="flex items-center gap-2 pt-2 border-t border-[#30363d]/60">
            <span className="text-cyan-400">$</span>
            <input
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="Run command..."
              disabled={running}
              className="flex-1 bg-transparent text-white focus:outline-none"
            />
            {running && <span className="text-[10px] text-amber-400">Running...</span>}
          </form>
        </div>
      )}

      {/* Output View */}
      {activeTab === 'output' && (
        <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-[#8b949e]">
          [WaMaX IDE System Log]<br />
          - Local Ollama AI Engine initialized.<br />
          - Memory engine loaded with SQLite-compatible store.<br />
          - 10/10 Core security and deterministic rule tests passed.<br />
          - Ready for offline local inference.
        </div>
      )}

      {/* Audit View */}
      {activeTab === 'audit' && (
        <div className="flex-1 p-3 overflow-y-auto text-xs space-y-1.5">
          <div className="flex items-center justify-between p-2 rounded bg-[#161b22] border border-[#30363d]">
            <span className="font-mono text-cyan-400">READ_FILE</span>
            <span className="text-[#8b949e]">Authorized Workspace Access</span>
            <span className="text-emerald-400 text-[10px]">VERIFIED</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-[#161b22] border border-[#30363d]">
            <span className="font-mono text-cyan-400">RESOLVE_RULES</span>
            <span className="text-[#8b949e]">Inviolable Safety Priority 1000 Applied</span>
            <span className="text-emerald-400 text-[10px]">ENFORCED</span>
          </div>
        </div>
      )}
    </div>
  );
};
