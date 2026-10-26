import React, { useState } from 'react';
import { MemoryItem } from '../../types/ide';
import { Database, Plus, Search, Tag, Trash2 } from 'lucide-react';

interface Props {
  memories: MemoryItem[];
  onAddMemory: (memory: Partial<MemoryItem>) => void;
  onDeleteMemory: (id: string) => void;
}

export const MemorySystemPanel: React.FC<Props> = ({
  memories,
  onAddMemory,
  onDeleteMemory
}) => {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'preferences' | 'architecture' | 'conventions' | 'decisions' | 'bugs' | 'summaries'>('architecture');

  const filtered = memories.filter(m => {
    const text = `${m.title} ${m.content} ${(m.tags || []).join(' ')}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && content.trim()) {
      onAddMemory({
        title: title.trim(),
        content: content.trim(),
        category,
        scope: 'global',
        tags: [category]
      });
      setTitle('');
      setContent('');
      setShowAdd(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Database size={14} className="text-cyan-400" />
          <span>Persistent Memory</span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="p-1 hover:bg-[#161b22] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          title="Add Memory Item"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-[#30363d] bg-[#161b22]/40">
        <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs">
          <Search size={12} className="text-[#8b949e]" />
          <input
            type="text"
            placeholder="Search memory items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-white focus:outline-none text-[11px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.map(mem => (
          <div
            key={mem.id}
            className="p-2.5 rounded-lg border border-[#30363d] bg-[#161b22]/60 hover:border-[#8b949e]/50 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {mem.category}
                </span>
                <h4 className="text-xs font-semibold text-white mt-1.5">{mem.title}</h4>
              </div>
              <button
                onClick={() => onDeleteMemory(mem.id)}
                className="opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-red-400 transition-opacity p-1"
                title="Delete memory"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <p className="text-[11px] text-[#8b949e] mt-1 leading-relaxed">
              {mem.content}
            </p>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Database size={16} className="text-cyan-400" />
              Store Project Memory
            </h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SQLite Indexing Strategy"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white"
                >
                  <option value="architecture">Architecture</option>
                  <option value="conventions">Conventions</option>
                  <option value="preferences">User Preferences</option>
                  <option value="decisions">Decisions</option>
                  <option value="bugs">Known Bugs</option>
                  <option value="summaries">Summaries</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1">Content</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Details to persist across conversations..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-xs text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-3 py-1.5 text-xs text-[#8b949e] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium"
                >
                  Save Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
