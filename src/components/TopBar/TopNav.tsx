import React from 'react';
import { Play, Sparkles, Terminal, HardDrive, Cpu, FolderOpen } from 'lucide-react';

interface Props {
  workspace: string;
  activeModel: string;
  ollamaOnline: boolean;
  onToggleTerminal: () => void;
  systemMetrics?: {
    usedMemMB: number;
    totalMemMB: number;
    percentUsed: number;
  };
}

export const TopNav: React.FC<Props> = ({
  workspace,
  activeModel,
  ollamaOnline,
  onToggleTerminal,
  systemMetrics
}) => {
  return (
    <div className="h-9 bg-[#0e1116] border-b border-[#30363d] flex items-center justify-between px-3 select-none z-10">
      {/* Left: Brand & Workspace */}
      <div className="flex items-center gap-3">
        <span className="font-bold text-xs tracking-wide bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          WaMaX IDE
        </span>
        <a
          href="https://github.com/msamods"
          target="_blank"
          rel="noreferrer"
          className="hidden lg:flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono bg-[#161b22] px-2 py-0.5 rounded border border-[#30363d] transition-colors"
          title="Developed By MSAMODS x WhatYouWantKerala"
        >
          <span className="text-[#8b949e]">by</span>
          <span className="font-semibold text-cyan-300">MSAMODS</span>
          <span className="text-[#8b949e]">x</span>
          <span className="text-amber-300">WhatYouWantKerala</span>
        </a>
        <div className="flex items-center gap-1.5 text-xs text-[#8b949e] font-mono bg-[#161b22] px-2 py-0.5 rounded border border-[#30363d] max-w-xs truncate" title={workspace}>
          <FolderOpen size={12} className="text-amber-400 shrink-0" />
          <span className="truncate">{workspace.split(/[\\/]/).pop()}</span>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="hidden md:flex items-center">
        <button
          className="flex items-center gap-2 px-3 py-1 bg-[#161b22] border border-[#30363d] rounded-md text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
          onClick={() => {}}
        >
          <span>Search files, commands, symbols...</span>
          <kbd className="px-1 py-0.2 bg-[#0d1117] border border-[#30363d] rounded text-[10px] font-mono">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: RAM & Engine Status */}
      <div className="flex items-center gap-3 text-xs">
        {systemMetrics && (
          <div className="flex items-center gap-1 text-[11px] text-[#8b949e] font-mono">
            <HardDrive size={12} />
            <span>RAM: {systemMetrics.percentUsed}%</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[11px] font-mono">
          <div className={`w-2 h-2 rounded-full ${ollamaOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-red-400'}`} />
          <span className="text-white">{activeModel}</span>
        </div>

        <button
          onClick={onToggleTerminal}
          className="p-1.5 rounded hover:bg-[#161b22] text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
          title="Toggle Terminal"
        >
          <Terminal size={14} />
        </button>
      </div>
    </div>
  );
};
