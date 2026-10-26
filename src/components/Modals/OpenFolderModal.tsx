import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Folder,
  ChevronRight,
  HardDrive,
  Home,
  Clock,
  ArrowUp,
  Search,
  Check,
  X,
  Laptop
} from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspace: string;
  onSelectWorkspace: (path: string) => void;
}

export const OpenFolderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentWorkspace,
  onSelectWorkspace
}) => {
  const [browsePath, setBrowsePath] = useState<string>(currentWorkspace);
  const [pathInput, setPathInput] = useState<string>(currentWorkspace);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [subdirs, setSubdirs] = useState<{ name: string; path: string; hasChildren: boolean }[]>([]);
  const [bookmarks, setBookmarks] = useState<{ name: string; path: string }[]>([]);
  const [drives, setDrives] = useState<{ name: string; path: string }[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [nativeOpening, setNativeOpening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolder = async (dir: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.browseWorkspace(dir);
      setBrowsePath(data.currentPath);
      setPathInput(data.currentPath);
      setParentPath(data.parentPath);
      setSubdirs(data.directories || []);
      setBookmarks(data.bookmarks || []);
      setDrives(data.drives || []);
      setRecent(data.recent || []);
    } catch (err: any) {
      setError(err.message || 'Failed to open directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolder(currentWorkspace || '');
    }
  }, [isOpen, currentWorkspace]);

  if (!isOpen) return null;

  const handleOpenCurrent = () => {
    if (browsePath) {
      onSelectWorkspace(browsePath);
      onClose();
    }
  };

  const handleOpenNative = async () => {
    setNativeOpening(true);
    try {
      const res = await api.openNativeFolderDialog();
      if (res && res.success && res.workspace) {
        onSelectWorkspace(res.workspace);
        onClose();
      }
    } catch (e: any) {
      setError(e.message || 'Could not open native folder dialog');
    } finally {
      setNativeOpening(false);
    }
  };

  const filteredDirs = subdirs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Parse path segments for breadcrumbs
  const pathParts = browsePath.split(/[\\/]/).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[#c9d1d9] text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <FolderOpen size={16} className="text-amber-400" />
            <span>Open Folder / Switch Workspace</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Launch & Native Picker Bar */}
        <div className="px-4 py-2.5 bg-[#161b22]/50 border-b border-[#30363d] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#8b949e] font-semibold uppercase tracking-wider mr-1">
              Locations:
            </span>
            {drives.map(d => (
              <button
                key={d.path}
                onClick={() => fetchFolder(d.path)}
                className="px-2 py-0.5 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-[11px] font-mono text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <HardDrive size={11} /> {d.name}
              </button>
            ))}
            {bookmarks.map(b => (
              <button
                key={b.path}
                onClick={() => fetchFolder(b.path)}
                className="px-2 py-0.5 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-[11px] text-[#c9d1d9] flex items-center gap-1 cursor-pointer"
              >
                {b.name === 'Current Workspace' ? (
                  <Clock size={11} className="text-cyan-400" />
                ) : (
                  <Home size={11} className="text-amber-400" />
                )}
                {b.name}
              </button>
            ))}
          </div>

          {/* Native OS Folder Dialog Button */}
          <button
            onClick={handleOpenNative}
            disabled={nativeOpening}
            className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded font-medium flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            title="Open Windows Explorer Folder Browser"
          >
            <Laptop size={13} className={nativeOpening ? 'animate-spin' : ''} />
            {nativeOpening ? 'Opening Windows Dialog...' : 'Native Folder Dialog'}
          </button>
        </div>

        {/* Address Bar & Breadcrumbs */}
        <div className="p-3 border-b border-[#30363d] bg-[#0d1117] space-y-2">
          <div className="flex items-center gap-2">
            {parentPath && (
              <button
                onClick={() => fetchFolder(parentPath)}
                className="p-1.5 rounded bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer"
                title="Go to Parent Directory"
              >
                <ArrowUp size={13} />
              </button>
            )}

            <div className="flex-1 flex items-center bg-[#161b22] border border-[#30363d] rounded px-2 py-1">
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') fetchFolder(pathInput);
                }}
                className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none"
                placeholder="Enter or paste folder path..."
              />
              <button
                onClick={() => fetchFolder(pathInput)}
                className="ml-2 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                Go
              </button>
            </div>
          </div>

          {/* Breadcrumb pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px] font-mono text-[#8b949e]">
            <span className="text-[#6e7681]">Path:</span>
            {pathParts.map((part, index) => {
              const subPath = pathParts.slice(0, index + 1).join('\\');
              const fullSub = browsePath.startsWith('/') ? `/${subPath}` : subPath;
              return (
                <React.Fragment key={index}>
                  <button
                    onClick={() => fetchFolder(fullSub)}
                    className="hover:text-cyan-300 hover:underline cursor-pointer truncate max-w-[120px]"
                  >
                    {part}
                  </button>
                  {index < pathParts.length - 1 && <ChevronRight size={11} className="text-[#484f58] shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Folder Content Listing */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[220px]">
          {/* Subfolder Search Filter */}
          <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-2.5 py-1">
            <Search size={13} className="text-[#8b949e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter subfolders..."
              className="bg-transparent text-white text-xs w-full focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-[#8b949e]">Reading directory contents...</div>
          ) : filteredDirs.length === 0 ? (
            <div className="p-8 text-center text-[#8b949e]">
              No subdirectories found. You can select this folder as your workspace.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filteredDirs.map(dir => (
                <div
                  key={dir.path}
                  onDoubleClick={() => fetchFolder(dir.path)}
                  onClick={() => setPathInput(dir.path)}
                  className={`p-2 rounded-lg border border-[#30363d] bg-[#161b22] hover:bg-[#21262d] hover:border-cyan-500/50 flex items-center justify-between cursor-pointer transition-colors ${
                    pathInput === dir.path ? 'border-cyan-500 bg-cyan-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder size={15} className="text-amber-400 shrink-0" />
                    <span className="truncate font-medium text-white">{dir.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchFolder(dir.path);
                    }}
                    className="text-[#8b949e] hover:text-cyan-400 p-1"
                    title="Enter Folder"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent Workspaces Section */}
          {recent && recent.length > 0 && (
            <div className="pt-2 border-t border-[#30363d]/50 space-y-1">
              <span className="text-[10px] text-[#8b949e] font-semibold uppercase tracking-wider block">
                Recent Workspaces:
              </span>
              <div className="space-y-1">
                {recent.slice(0, 4).map(r => (
                  <button
                    key={r}
                    onClick={() => fetchFolder(r)}
                    className="w-full text-left font-mono text-[11px] text-[#8b949e] hover:text-white px-2 py-1 rounded hover:bg-[#161b22] truncate block cursor-pointer"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#30363d] bg-[#161b22] flex items-center justify-between">
          <div className="text-[11px] text-[#8b949e] font-mono truncate max-w-md">
            Selected: <span className="text-white">{browsePath}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenCurrent}
              className="px-4 py-1.5 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
            >
              <Check size={14} />
              Open This Folder (1-Click)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
