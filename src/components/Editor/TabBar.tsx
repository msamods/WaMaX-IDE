import React from 'react';
import { X, FileCode } from 'lucide-react';

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
}

interface Props {
  tabs: OpenTab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
}

export const TabBar: React.FC<Props> = ({
  tabs,
  activePath,
  onSelectTab,
  onCloseTab
}) => {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center bg-[#0e1116] border-b border-[#30363d] overflow-x-auto select-none">
      {tabs.map(tab => {
        const isActive = tab.path === activePath;
        return (
          <div
            key={tab.path}
            onClick={() => onSelectTab(tab.path)}
            className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-[#30363d] cursor-pointer shrink-0 transition-colors ${
              isActive
                ? 'bg-[#161b22] text-white font-medium border-t-2 border-t-cyan-400'
                : 'bg-[#0d1117] text-[#8b949e] hover:bg-[#161b22]/60 hover:text-[#c9d1d9]'
            }`}
          >
            <FileCode size={13} className={isActive ? 'text-cyan-400' : 'text-blue-400'} />
            <span className="truncate max-w-[140px]">{tab.name}</span>
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.path);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#30363d] hover:text-white transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
