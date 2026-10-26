import React, { useState } from 'react';
import { GitStatusInfo } from '../../types/ide';
import { GitBranch, Check, Plus, RefreshCw, FileCode } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  gitStatus: GitStatusInfo | null;
  onRefresh: () => void;
}

export const SourceControlPanel: React.FC<Props> = ({ gitStatus, onRefresh }) => {
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim() || committing) return;
    setCommitting(true);
    setStatusMsg('');
    try {
      await api.commitGit(commitMsg.trim());
      setCommitMsg('');
      setStatusMsg('Committed successfully!');
      onRefresh();
    } catch (e: any) {
      setStatusMsg(`Commit error: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  };

  const modified = gitStatus?.modified || [];
  const untracked = gitStatus?.untracked || [];
  const staged = gitStatus?.staged || [];
  const allChanges = [...modified, ...untracked];

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <GitBranch size={14} className="text-cyan-400" />
          <span>Source Control</span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-[#161b22] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          title="Refresh Git Status"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        {/* Branch Info */}
        <div className="flex items-center gap-2 p-2 rounded bg-[#161b22] border border-[#30363d] text-xs text-white">
          <GitBranch size={13} className="text-cyan-400" />
          <span className="font-mono text-[11px] font-semibold">{gitStatus?.branch || 'main'}</span>
          {gitStatus?.clean && (
            <span className="text-[10px] text-emerald-400 ml-auto flex items-center gap-1">
              <Check size={11} /> Clean
            </span>
          )}
        </div>

        {/* Commit Message Box */}
        <form onSubmit={handleCommit} className="space-y-1.5">
          <textarea
            rows={2}
            placeholder="Message (Ctrl+Enter to commit)"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            disabled={committing || allChanges.length === 0}
            className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={committing || allChanges.length === 0 || !commitMsg.trim()}
            className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Check size={13} />
            {committing ? 'Committing...' : 'Commit Changes'}
          </button>
          {statusMsg && <p className="text-[10px] text-cyan-400">{statusMsg}</p>}
        </form>

        {/* Changes List */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#8b949e] uppercase">
            <span>Changes ({allChanges.length})</span>
          </div>

          {allChanges.length === 0 ? (
            <div className="py-4 text-xs text-[#8b949e] text-center">
              No uncommitted changes
            </div>
          ) : (
            allChanges.map(file => (
              <div
                key={file}
                className="flex items-center justify-between py-1 px-2 rounded hover:bg-[#161b22] text-xs text-[#c9d1d9]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileCode size={12} className="text-amber-400 shrink-0" />
                  <span className="truncate">{file}</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-semibold">M</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
