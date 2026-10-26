import React from 'react';
import { Agent } from '../../types/ide';
import { Bot, Shield, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

interface Props {
  agents: Agent[];
  activeAgentId?: string;
  onSelectAgent: (id: string) => void;
  onToggleApproval: (agentId: string, current: boolean) => void;
}

export const AgentManagerPanel: React.FC<Props> = ({
  agents,
  activeAgentId,
  onSelectAgent,
  onToggleApproval
}) => {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Bot size={14} className="text-cyan-400" />
          <span>Agent Manager</span>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800">
          {agents.length} Active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {agents.map(agent => {
          const isActive = agent.id === activeAgentId;
          return (
            <div
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? 'border-cyan-500/60 bg-[#161b22] shadow-sm shadow-cyan-500/10'
                  : 'border-[#30363d] bg-[#161b22]/40 hover:border-[#8b949e]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                    <Bot size={13} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">{agent.name}</h4>
                    <span className="text-[10px] text-[#8b949e] uppercase font-mono">
                      Role: {agent.role}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Selected
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#8b949e] mb-2.5 line-clamp-2">
                {agent.description}
              </p>

              {/* Tools & Permissions */}
              <div className="flex flex-wrap gap-1 mb-2">
                {agent.allowedTools.map(t => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.5 bg-[#0d1117] border border-[#30363d] rounded text-[#8b949e] font-mono"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Approval Safeguard Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#30363d]/60 text-[10px]">
                <span className="text-[#8b949e] flex items-center gap-1">
                  <Shield size={11} className={agent.requireApproval ? 'text-amber-400' : 'text-slate-500'} />
                  Approval on Actions
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleApproval(agent.id, agent.requireApproval);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    agent.requireApproval
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                      : 'bg-[#21262d] text-[#8b949e] hover:text-white'
                  }`}
                >
                  {agent.requireApproval ? 'Enforced' : 'Auto'}
                </button>
              </div>

              {/* Audit count */}
              {agent.auditLog && agent.auditLog.length > 0 && (
                <div className="mt-2 text-[10px] text-slate-500">
                  {agent.auditLog.length} audited actions recorded
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
