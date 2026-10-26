import React from 'react';
import {
  Files,
  Search,
  GitBranch,
  Brain,
  Bot,
  Scale,
  Database,
  Cpu,
  Image as ImageIcon,
  Radio,
  Settings
} from 'lucide-react';

export type ActiveSidebarTab = 
  | 'explorer' 
  | 'search' 
  | 'git' 
  | 'brains' 
  | 'agents' 
  | 'rules' 
  | 'memory' 
  | 'models' 
  | 'images'
  | 'gateway'
  | 'settings';

interface Props {
  activeTab: ActiveSidebarTab;
  setActiveTab: (tab: ActiveSidebarTab) => void;
}

export const ActivityBar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const topButtons = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search Workspace' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'gateway', icon: Radio, label: 'Developer Tools → API Gateway' },
    { id: 'brains', icon: Brain, label: 'AI Brain Studio' },
    { id: 'agents', icon: Bot, label: 'Agent Manager' },
    { id: 'rules', icon: Scale, label: 'Rules Engine' },
    { id: 'memory', icon: Database, label: 'AI Memory System' },
    { id: 'models', icon: Cpu, label: 'Local Models (Ollama)' },
    { id: 'images', icon: ImageIcon, label: 'ComfyUI Image Studio' }
  ];

  return (
    <div className="w-12 bg-[#0e1116] border-r border-[#30363d] flex flex-col justify-between items-center py-2 shrink-0 z-20">
      <div className="flex flex-col gap-1 w-full items-center">
        {/* WaMaX Logo */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 mb-3 text-xs tracking-wider cursor-pointer">
          W
        </div>

        {topButtons.map(btn => {
          const Icon = btn.icon;
          const isActive = activeTab === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => setActiveTab(btn.id as ActiveSidebarTab)}
              title={btn.label}
              className={`w-10 h-10 rounded-md flex items-center justify-center relative transition-colors ${
                isActive 
                  ? 'text-cyan-400 bg-[#161b22]' 
                  : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]/50'
              }`}
            >
              <Icon size={19} />
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-cyan-400 rounded-r" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 w-full items-center">
        <button
          onClick={() => setActiveTab('settings')}
          title="Settings"
          className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
            activeTab === 'settings' 
              ? 'text-cyan-400 bg-[#161b22]' 
              : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]/50'
          }`}
        >
          <Settings size={19} />
        </button>
      </div>
    </div>
  );
};
