import React, { useState } from 'react';
import { ProjectFile } from '../../types/ide';
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  FilePlus,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface Props {
  tree: ProjectFile[];
  workspace: string;
  onSelectFile: (path: string) => void;
  activeFilePath?: string;
  onRefresh: () => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (path: string) => void;
}

const FileItem: React.FC<{
  item: ProjectFile;
  level: number;
  onSelectFile: (path: string) => void;
  activeFilePath?: string;
  onDeleteFile: (path: string) => void;
}> = ({ item, level, onSelectFile, activeFilePath, onDeleteFile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = activeFilePath === item.path;

  if (item.isDirectory) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-[#161b22] cursor-pointer text-xs rounded text-[#8b949e] hover:text-[#c9d1d9] select-none"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {isOpen ? (
            <FolderOpen size={14} className="text-amber-400 shrink-0" />
          ) : (
            <Folder size={14} className="text-amber-400 shrink-0" />
          )}
          <span className="truncate">{item.name}</span>
        </div>
        {isOpen && item.children && (
          <div>
            {item.children.map(child => (
              <FileItem
                key={child.path}
                item={child}
                level={level + 1}
                onSelectFile={onSelectFile}
                activeFilePath={activeFilePath}
                onDeleteFile={onDeleteFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectFile(item.path)}
      className={`group flex items-center justify-between py-1 px-2 text-xs rounded cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-[#1f242c] text-cyan-400 font-medium'
          : 'text-[#c9d1d9] hover:bg-[#161b22] hover:text-white'
      }`}
      style={{ paddingLeft: `${level * 12 + 20}px` }}
    >
      <div className="flex items-center gap-1.5 truncate">
        <FileCode size={13} className="text-[#58a6ff] shrink-0" />
        <span className="truncate">{item.name}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete ${item.name}?`)) onDeleteFile(item.path);
        }}
        className="opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-red-400 transition-opacity p-0.5"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

export const FileExplorer: React.FC<Props> = ({
  tree,
  workspace,
  onSelectFile,
  activeFilePath,
  onRefresh,
  onCreateFile,
  onDeleteFile
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <span className="truncate" title={workspace}>Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreating(!isCreating)}
            title="New File"
            className="p-1 hover:bg-[#161b22] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={onRefresh}
            title="Refresh Explorer"
            className="p-1 hover:bg-[#161b22] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="p-2 border-b border-[#30363d] bg-[#161b22]">
          <input
            type="text"
            placeholder="filename.ts"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            autoFocus
            className="w-full bg-[#0d1117] border border-[#30363d] text-xs rounded px-2 py-1 text-white focus:outline-none focus:border-cyan-400"
          />
        </form>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="p-4 text-xs text-[#8b949e] text-center">
            No files in workspace
          </div>
        ) : (
          tree.map((item) => (
            <FileItem
              key={item.path}
              item={item}
              level={0}
              onSelectFile={onSelectFile}
              activeFilePath={activeFilePath}
              onDeleteFile={onDeleteFile}
            />
          ))
        )}
      </div>
    </div>
  );
};
