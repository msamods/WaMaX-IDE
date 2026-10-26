import React, { useState, useEffect } from 'react';
import { ActivityBar, ActiveSidebarTab } from './components/ActivityBar';
import { FileExplorer } from './components/Sidebar/FileExplorer';
import { BrainStudioPanel } from './components/Sidebar/BrainStudioPanel';
import { AgentManagerPanel } from './components/Sidebar/AgentManagerPanel';
import { RulesManagerPanel } from './components/Sidebar/RulesManagerPanel';
import { MemorySystemPanel } from './components/Sidebar/MemorySystemPanel';
import { ModelManagerPanel } from './components/Sidebar/ModelManagerPanel';
import { SourceControlPanel } from './components/Sidebar/SourceControlPanel';
import { ImageStudioPanel } from './components/Sidebar/ImageStudioPanel';
import { AutonomousBuilderPanel } from './components/Sidebar/AutonomousBuilderPanel';
import { SettingsPanel } from './components/Sidebar/SettingsPanel';
import { TabBar, OpenTab } from './components/Editor/TabBar';
import { MonacoEditorWrapper } from './components/Editor/MonacoEditorWrapper';
import { ChatPanel } from './components/AIChat/ChatPanel';
import { TerminalPanel } from './components/BottomPanel/TerminalPanel';
import { TopNav } from './components/TopBar/TopNav';
import { ApiGatewayDashboard } from './components/Gateway/ApiGatewayDashboard';
import { api } from './services/api';
import { Brain, Agent, Rule, MemoryItem, ProjectFile, GitStatusInfo, ChatMessage } from './types/ide';

export const App: React.FC = () => {
  // Sidebar state
  const [activeSidebarTab, setActiveSidebarTab] = useState<ActiveSidebarTab>('explorer');

  // Workspace & Files
  const [workspace, setWorkspace] = useState<string>('');
  const [fileTree, setFileTree] = useState<ProjectFile[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Bottom panel
  const [showBottomPanel, setShowBottomPanel] = useState<boolean>(true);

  // Entities
  const [brains, setBrains] = useState<Brain[]>([]);
  const [activeBrainId, setActiveBrainId] = useState<string>('brain-coding');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string>('agent-coding');
  const [rules, setRules] = useState<Rule[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [models, setModels] = useState<{ name: string; sizeMB: number; modified_at: string }[]>([]);
  const [activeModel, setActiveModel] = useState<string>('qwen2.5:1.5b');
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);

  // System & Health
  const [ollamaOnline, setOllamaOnline] = useState<boolean>(false);
  const [systemMetrics, setSystemMetrics] = useState<any>(null);

  // AI Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Initial Data Load
  const refreshAll = async () => {
    try {
      const health = await api.getHealth();
      setWorkspace(health.workspace || '');
      setOllamaOnline(health.ollama || false);
      setSystemMetrics(health.system || null);

      const treeData = await api.getFileTree();
      setFileTree(treeData.tree || []);

      const brainList = await api.getBrains();
      setBrains(brainList);
      if (brainList.length && !activeBrainId) setActiveBrainId(brainList[0].id);

      const agentList = await api.getAgents();
      setAgents(agentList);

      const ruleList = await api.getRules();
      setRules(ruleList);

      const memList = await api.getMemories();
      setMemories(memList);

      const modelList = await api.getModels();
      setModels(modelList);
      if (modelList.length && !modelList.some(m => m.name === activeModel)) {
        setActiveModel(modelList[0].name);
      }

      const git = await api.getGitStatus();
      setGitStatus(git);
    } catch (e) {
      console.error('Error refreshing data:', e);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // File Selection
  const handleSelectFile = async (filePath: string) => {
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }
    try {
      const data = await api.readFile(filePath);
      const newTab: OpenTab = {
        path: filePath,
        name: filePath.split(/[\\/]/).pop() || filePath,
        content: data.content,
        isDirty: false
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabPath(filePath);
    } catch (e: any) {
      alert(`Could not open file: ${e.message}`);
    }
  };

  const handleCloseTab = (filePath: string) => {
    const remaining = openTabs.filter(t => t.path !== filePath);
    setOpenTabs(remaining);
    if (activeTabPath === filePath) {
      setActiveTabPath(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  };

  const handleEditorContentChange = (newContent: string) => {
    if (!activeTabPath) return;
    setOpenTabs(prev =>
      prev.map(t => (t.path === activeTabPath ? { ...t, content: newContent, isDirty: true } : t))
    );
  };

  const handleSaveActiveFile = async () => {
    const activeTab = openTabs.find(t => t.path === activeTabPath);
    if (!activeTab) return;
    try {
      await api.writeFile(activeTab.path, activeTab.content);
      setOpenTabs(prev =>
        prev.map(t => (t.path === activeTab.path ? { ...t, isDirty: false } : t))
      );
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`);
    }
  };

  const handleCreateFile = async (fileName: string) => {
    try {
      await api.writeFile(fileName, '');
      const treeData = await api.getFileTree();
      setFileTree(treeData.tree || []);
      handleSelectFile(fileName);
    } catch (e: any) {
      alert(`Failed to create file: ${e.message}`);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      await api.deleteFile(filePath);
      handleCloseTab(filePath);
      const treeData = await api.getFileTree();
      setFileTree(treeData.tree || []);
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  // Chat Submission
  const handleSendChat = async (messageText: string, attachedCode?: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    };

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      thinking: '',
      timestamp: Date.now(),
      modelUsed: activeModel
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await api.chatStream(
        {
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          brainId: activeBrainId,
          agentId: activeAgentId,
          model: activeModel,
          attachedContext: attachedCode,
          targetFile: activeTabPath || undefined
        },
        chunk => {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              if (chunk.content) last.content += chunk.content;
              if (chunk.thinking) last.thinking += chunk.thinking;
            }
            return next;
          });
        },
        controller.signal
      );
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            last.content += `\n[Local AI Error: ${e.message}. Ensure Ollama is running.]`;
          }
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  const handleCancelStream = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsStreaming(false);
    }
  };

  const handleInsertCodeIntoEditor = (code: string) => {
    if (!activeTabPath) return;
    handleEditorContentChange(code);
  };

  const activeTab = openTabs.find(t => t.path === activeTabPath);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Top Bar */}
      <TopNav
        workspace={workspace}
        activeModel={activeModel}
        ollamaOnline={ollamaOnline}
        onToggleTerminal={() => setShowBottomPanel(!showBottomPanel)}
        systemMetrics={systemMetrics}
      />

      {/* Main IDE Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Activity Bar */}
        <ActivityBar
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
        />

        {/* Primary Sidebar (Hidden when viewing full Developer Gateway) */}
        {activeSidebarTab !== 'gateway' && (
          <div className="w-64 bg-[#0d1117] border-r border-[#30363d] flex flex-col shrink-0 overflow-hidden">
          {activeSidebarTab === 'explorer' && (
            <FileExplorer
              tree={fileTree}
              workspace={workspace}
              onSelectFile={handleSelectFile}
              activeFilePath={activeTabPath || undefined}
              onRefresh={refreshAll}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
            />
          )}
          {activeSidebarTab === 'brains' && (
            <BrainStudioPanel
              brains={brains}
              activeBrainId={activeBrainId}
              onSelectBrain={setActiveBrainId}
              onCreateBrain={async b => {
                await api.createBrain(b);
                const list = await api.getBrains();
                setBrains(list);
              }}
            />
          )}
          {activeSidebarTab === 'agents' && (
            <AgentManagerPanel
              agents={agents}
              activeAgentId={activeAgentId}
              onSelectAgent={setActiveAgentId}
              onToggleApproval={async (id, current) => {
                await api.updateAgent(id, { requireApproval: !current });
                const list = await api.getAgents();
                setAgents(list);
              }}
            />
          )}
          {activeSidebarTab === 'rules' && (
            <RulesManagerPanel
              rules={rules}
              onToggleRule={async (id, enabled) => {
                await api.updateRule(id, { enabled });
                const list = await api.getRules();
                setRules(list);
              }}
              onCreateRule={async r => {
                await api.createRule(r);
                const list = await api.getRules();
                setRules(list);
              }}
            />
          )}
          {activeSidebarTab === 'memory' && (
            <MemorySystemPanel
              memories={memories}
              onAddMemory={async m => {
                await api.createMemory(m);
                const list = await api.getMemories();
                setMemories(list);
              }}
              onDeleteMemory={async id => {
                await api.deleteMemory(id);
                const list = await api.getMemories();
                setMemories(list);
              }}
            />
          )}
          {activeSidebarTab === 'models' && (
            <ModelManagerPanel
              models={models}
              activeModel={activeModel}
              onSelectModel={setActiveModel}
              systemMetrics={systemMetrics}
            />
          )}
          {activeSidebarTab === 'git' && (
            <SourceControlPanel
              gitStatus={gitStatus}
              onRefresh={async () => {
                const s = await api.getGitStatus();
                setGitStatus(s);
              }}
            />
          )}
          {activeSidebarTab === 'builder' && <AutonomousBuilderPanel />}
          {activeSidebarTab === 'images' && <ImageStudioPanel />}
          {activeSidebarTab === 'settings' && (
            <SettingsPanel
              workspace={workspace}
              onSwitchWorkspace={async p => {
                await fetch('/api/workspace', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: p })
                });
                refreshAll();
              }}
            />
          )}
        </div>
      )}

      {/* Center: Developer Tools API Gateway OR Editor + Bottom Panel */}
      {activeSidebarTab === 'gateway' ? (
        <ApiGatewayDashboard />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-[#161b22] overflow-hidden">
          <TabBar
            tabs={openTabs}
            activePath={activeTabPath}
            onSelectTab={setActiveTabPath}
            onCloseTab={handleCloseTab}
          />

          <div className="flex-1 overflow-hidden relative">
            {activeTab ? (
              <MonacoEditorWrapper
                path={activeTab.path}
                content={activeTab.content}
                onChange={handleEditorContentChange}
                onSave={handleSaveActiveFile}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#8b949e] select-none space-y-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-cyan-400 font-bold text-lg">
                  W
                </div>
                <h3 className="text-sm font-semibold text-white">WaMaX IDE</h3>
                <p className="text-xs text-[#8b949e]">Select a file from the Explorer or ask the AI assistant</p>
                <div className="flex gap-2 text-[11px] text-[#8b949e] font-mono">
                  <span>Ctrl+K : Command Palette</span>
                  <span>•</span>
                  <span>Ctrl+S : Save</span>
                </div>
              </div>
            )}
          </div>

          {showBottomPanel && (
            <TerminalPanel onClose={() => setShowBottomPanel(false)} />
          )}
        </div>
      )}

        {/* Right: AI Chat & Doubt Solving Panel */}
        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <ChatPanel
            brains={brains}
            activeBrainId={activeBrainId}
            onSelectBrain={setActiveBrainId}
            agents={agents}
            activeAgentId={activeAgentId}
            onSelectAgent={setActiveAgentId}
            models={models}
            activeModel={activeModel}
            onSelectModel={setActiveModel}
            activeFilePath={activeTab?.path}
            activeFileContent={activeTab?.content}
            onInsertCodeIntoEditor={handleInsertCodeIntoEditor}
            onSendChat={handleSendChat}
            messages={messages}
            isStreaming={isStreaming}
            onCancelStream={handleCancelStream}
          />
        </div>
      </div>
    </div>
  );
};
