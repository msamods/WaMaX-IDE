import React, { useState } from 'react';
import { Rule } from '../../types/ide';
import { Scale, Plus, Check, ShieldCheck, Eye } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  rules: Rule[];
  onToggleRule: (ruleId: string, enabled: boolean) => void;
  onCreateRule: (rule: Partial<Rule>) => void;
}

export const RulesManagerPanel: React.FC<Props> = ({
  rules,
  onToggleRule,
  onCreateRule
}) => {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewResult, setPreviewResult] = useState<string>('');
  const [testingTask, setTestingTask] = useState('Refactor the user authentication flow');

  const handleTestResolution = async () => {
    try {
      const res = await api.resolveRules({ taskInstruction: testingTask });
      setPreviewResult(res.resolvedPrompt || 'No prompt generated');
      setShowPreviewModal(true);
    } catch (e: any) {
      alert(`Error resolving rules: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Scale size={14} className="text-cyan-400" />
          <span>Rules Engine</span>
        </div>
        <button
          onClick={handleTestResolution}
          title="Preview Resolved Rules"
          className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800 hover:bg-cyan-900/80 transition-colors lowercase"
        >
          <Eye size={11} /> preview
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Safety Inviolable Alert */}
        <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-800/40 text-red-300">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck size={14} className="text-red-400 shrink-0" />
            <span>Safety Constraints (Inviolable)</span>
          </div>
          <p className="text-[10px] text-red-200/80 mt-1">
            Path traversal defense, secret protection, destructive action approvals are locked with Priority 1000.
          </p>
        </div>

        {/* User & Project Rules */}
        {rules.map(rule => (
          <div
            key={rule.id}
            className={`p-3 rounded-lg border transition-all ${
              rule.enabled
                ? 'border-[#30363d] bg-[#161b22]'
                : 'border-[#21262d] bg-[#161b22]/20 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  {rule.name}
                  <span className="text-[9px] font-mono px-1 py-0.2 bg-[#0d1117] border border-[#30363d] rounded text-cyan-400">
                    P:{rule.priority}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 bg-[#0d1117] border border-[#30363d] rounded text-slate-400 uppercase">
                    {rule.scope}
                  </span>
                </h4>
                <p className="text-[11px] text-[#8b949e] mt-1">
                  {rule.description || rule.content}
                </p>
              </div>
              <button
                onClick={() => onToggleRule(rule.id, !rule.enabled)}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  rule.enabled
                    ? 'bg-cyan-500 border-cyan-400 text-black'
                    : 'border-[#30363d] bg-transparent'
                }`}
              >
                {rule.enabled && <Check size={12} strokeWidth={3} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 max-w-2xl w-full shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Scale size={16} className="text-cyan-400" />
                Resolved Rules Preview (Precedence Order)
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-[#8b949e] hover:text-white text-xs"
              >
                Close
              </button>
            </div>
            <div className="my-3">
              <label className="text-[11px] text-[#8b949e] block mb-1">Simulate Task Instruction:</label>
              <input
                type="text"
                value={testingTask}
                onChange={e => setTestingTask(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white"
              />
            </div>
            <pre className="flex-1 overflow-y-auto bg-[#0d1117] p-3 rounded border border-[#30363d] text-[11px] font-mono text-cyan-200/90 whitespace-pre-wrap select-text">
              {previewResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
