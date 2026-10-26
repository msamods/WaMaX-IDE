import React, { useState } from 'react';
import { Brain as BrainType } from '../../types/ide';
import { Brain, Plus, Check, Sliders, Shield, Zap } from 'lucide-react';

interface Props {
  brains: BrainType[];
  activeBrainId: string;
  onSelectBrain: (id: string) => void;
  onCreateBrain: (brain: Partial<BrainType>) => void;
}

export const BrainStudioPanel: React.FC<Props> = ({
  brains,
  activeBrainId,
  onSelectBrain,
  onCreateBrain
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [model, setModel] = useState('qwen2.5:1.5b');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateBrain({
        name: name.trim(),
        description: description.trim(),
        purpose: description.trim(),
        systemInstructions: systemInstructions.trim(),
        preferredModel: model,
        temperature: 0.5,
        contextBudget: 4096,
        toolPermissions: ['read_file', 'write_file'],
        enabled: true
      });
      setName('');
      setDescription('');
      setSystemInstructions('');
      setShowCreateModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Brain size={14} className="text-cyan-400" />
          <span>AI Brain Studio</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-1 hover:bg-[#161b22] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          title="Create New Brain"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {brains.map(b => {
          const isActive = b.id === activeBrainId;
          return (
            <div
              key={b.id}
              onClick={() => onSelectBrain(b.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                isActive
                  ? 'border-cyan-500/50 bg-[#161b22] shadow-sm shadow-cyan-500/10'
                  : 'border-[#30363d] hover:border-[#8b949e]/50 bg-[#161b22]/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    {b.name}
                    {isActive && (
                      <span className="flex items-center gap-0.5 text-[10px] text-cyan-400 font-normal px-1.5 py-0.2 bg-cyan-950/60 rounded border border-cyan-800">
                        <Check size={10} /> Active
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-[#8b949e] mt-1 line-clamp-2">
                    {b.description || b.purpose}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 text-[10px] text-[#8b949e] border-t border-[#30363d]/60 pt-2">
                <span className="flex items-center gap-1">
                  <Zap size={11} className="text-amber-400" />
                  {b.preferredModel}
                </span>
                <span className="flex items-center gap-1">
                  <Sliders size={11} className="text-blue-400" />
                  T: {b.temperature}
                </span>
                <span className="flex items-center gap-1">
                  <Shield size={11} className="text-emerald-400" />
                  {b.toolPermissions?.length || 0} tools
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Brain size={16} className="text-cyan-400" />
              Create Custom AI Brain
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">Brain Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rust Microservices Architect"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">Purpose & Description</label>
                <input
                  type="text"
                  placeholder="Specialized in memory safety, Tokio async, and Axum..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">System Instructions</label>
                <textarea
                  rows={4}
                  placeholder="Act as a world-class Rust systems engineer..."
                  value={systemInstructions}
                  onChange={e => setSystemInstructions(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">Preferred Model</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="qwen2.5:1.5b">qwen2.5:1.5b (Ultra Fast / Low RAM)</option>
                  <option value="qwen3.5:2b">qwen3.5:2b (Installed on Laptop)</option>
                  <option value="llama3.2:3b">llama3.2:3b (General)</option>
                  <option value="moondream">moondream (Vision AI)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-[#8b949e] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium"
                >
                  Create Brain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
