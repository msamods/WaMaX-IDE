import React, { useState, useEffect } from 'react';
import {
  Wand2,
  FolderSync,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  ChevronRight,
  Eye,
  RefreshCw,
  Terminal,
  Check
} from 'lucide-react';
import { api } from '../../services/api';

interface DetectedSource {
  source: string;
  name: string;
  detected: boolean;
  fileCount: number;
  files: string[];
}

export const AutonomousBuilderPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'build' | 'import'>('build');

  // Import State
  const [sources, setSources] = useState<DetectedSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [scanning, setScanning] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  // Builder State
  const [prompt, setPrompt] = useState('Build a Node.js REST API with JWT authentication and test suite');
  const [autonomyLevel, setAutonomyLevel] = useState<'plan_only' | 'approval_required' | 'autonomous'>('autonomous');
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Initial Scan
  const scanSources = async () => {
    setScanning(true);
    try {
      const data = await api.scanBuilderContext();
      if (data && data.sources) {
        setSources(data.sources);
        const initialSelected: Record<string, boolean> = {};
        data.sources.forEach((s: DetectedSource) => {
          if (s.detected) initialSelected[s.source] = true;
        });
        setSelectedSources(initialSelected);
      }
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    scanSources();
  }, []);

  // Poll active session if in progress
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const session = await api.getBuilderSession(pollingId);
        setCurrentSession(session);
        if (session.status === 'completed' || session.status === 'failed' || session.status === 'waiting_approval') {
          setIsBuilding(false);
          if (session.status !== 'waiting_approval') {
            setPollingId(null);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [pollingId]);

  const handleImport = async () => {
    const toImport = Object.keys(selectedSources).filter((k) => selectedSources[k]);
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const res = await api.importBuilderContext(toImport);
      setImportResult(res);
    } catch (e: any) {
      alert(`Import error: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handlePreview = async (sourceId: string) => {
    try {
      const res = await api.previewBuilderSource(sourceId);
      setPreviewData(res);
    } catch (e: any) {
      alert(`Preview failed: ${e.message}`);
    }
  };

  const handleStartSession = async () => {
    if (!prompt.trim()) return;
    setIsBuilding(true);
    setCurrentSession(null);
    try {
      const res = await api.startBuilderSession({
        prompt,
        autonomyLevel,
        allowedTools: ['file_writer', 'terminal_runner', 'git_committer']
      });
      if (res && res.session) {
        setCurrentSession(res.session);
        setPollingId(res.session.id);
      }
    } catch (e: any) {
      alert(`Failed to start builder session: ${e.message}`);
      setIsBuilding(false);
    }
  };

  const handleApprove = async () => {
    if (!currentSession) return;
    try {
      await api.approveBuilderSession(currentSession.id);
      setIsBuilding(true);
      setPollingId(currentSession.id);
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    }
  };

  const STEPS = [
    'Inspect project structure',
    'Load rules & memories',
    'Generate implementation plan',
    'Identify files & tools',
    'Generate code changes',
    'Apply workspace changes',
    'Execute permitted commands',
    'Run test suite',
    'Diagnose & fix errors',
    'Produce final report'
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Wand2 size={14} className="text-cyan-400" />
          <span>WaMaX Autonomous Builder</span>
        </div>
        <div className="flex bg-[#161b22] rounded p-0.5 border border-[#30363d]">
          <button
            onClick={() => setActiveTab('build')}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
              activeTab === 'build' ? 'bg-cyan-600 text-white font-medium' : 'text-[#8b949e]'
            }`}
          >
            Build
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
              activeTab === 'import' ? 'bg-cyan-600 text-white font-medium' : 'text-[#8b949e]'
            }`}
          >
            Import Context
          </button>
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        {/* TAB 1: BUILD */}
        {activeTab === 'build' && (
          <div className="space-y-3">
            {/* Task Prompt */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[#8b949e] block font-medium">Autonomous Goal & Specification</label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to autonomously build, test, and verify..."
                className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none font-mono"
              />
            </div>

            {/* Autonomy Level */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[#8b949e] block font-medium">Autonomy Level</label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'plan_only', label: 'Plan Only' },
                    { id: 'approval_required', label: 'Approval Req.' },
                    { id: 'autonomous', label: 'Autonomous' }
                  ] as const
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => setAutonomyLevel(lvl.id)}
                    className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
                      autonomyLevel === lvl.id
                        ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-semibold'
                        : 'border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleStartSession}
              disabled={isBuilding || !prompt.trim()}
              className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/10 cursor-pointer disabled:opacity-50"
            >
              <Play size={13} className={isBuilding ? 'animate-spin' : ''} />
              {isBuilding ? 'Autonomous Builder Running...' : 'Execute 10-Step Autonomous Build (1-Click)'}
            </button>

            {/* Active Session Stepper & Live Status */}
            {currentSession && (
              <div className="mt-3 p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Execution Status</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                      currentSession.status === 'completed'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : currentSession.status === 'waiting_approval'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : currentSession.status === 'failed'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse'
                    }`}
                  >
                    {currentSession.status.replace('_', ' ')}
                  </span>
                </div>

                {/* 10-Step Stepper */}
                <div className="space-y-1 border-t border-[#30363d] pt-2">
                  {STEPS.map((stepName, idx) => {
                    const stepNum = idx + 1;
                    const isDone = currentSession.step > stepNum || currentSession.status === 'completed';
                    const isCurrent = currentSession.step === stepNum && currentSession.status === 'running';

                    return (
                      <div key={stepNum} className="flex items-center gap-2 text-[11px]">
                        {isDone ? (
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        ) : isCurrent ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-[#484f58] text-[9px] flex items-center justify-center text-[#8b949e] shrink-0 font-mono">
                            {stepNum}
                          </div>
                        )}
                        <span
                          className={`${
                            isDone ? 'text-[#c9d1d9]' : isCurrent ? 'text-cyan-400 font-semibold' : 'text-[#8b949e]'
                          }`}
                        >
                          {stepName}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Approval Prompt */}
                {currentSession.status === 'waiting_approval' && (
                  <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                      <AlertTriangle size={14} />
                      <span>Approval Required to Apply Changes</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80">
                      Plan generated ({currentSession.plan?.length || 0} steps). Ready to apply changes to workspace.
                    </p>
                    <button
                      onClick={handleApprove}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      Approve & Execute (1-Click)
                    </button>
                  </div>
                )}

                {/* Changed Files */}
                {currentSession.changedFiles && currentSession.changedFiles.length > 0 && (
                  <div className="border-t border-[#30363d] pt-2 space-y-1">
                    <div className="text-[11px] font-semibold text-[#8b949e] flex items-center gap-1">
                      <FileCode size={12} className="text-cyan-400" />
                      Generated / Modified Files ({currentSession.changedFiles.length})
                    </div>
                    <div className="bg-[#0d1117] rounded p-2 max-h-24 overflow-y-auto space-y-0.5">
                      {currentSession.changedFiles.map((f: string) => (
                        <div key={f} className="text-[10px] font-mono text-emerald-400">
                          + {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Results */}
                {currentSession.testResults && (
                  <div className="border-t border-[#30363d] pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Test Suite Verification</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          currentSession.testResults.passed
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {currentSession.testResults.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Final Report */}
                {currentSession.finalReport && (
                  <div className="border-t border-[#30363d] pt-2 space-y-1">
                    <div className="text-[11px] font-semibold text-cyan-400">Final Execution Report</div>
                    <div className="bg-[#0d1117] p-2 rounded text-[11px] text-[#c9d1d9] leading-relaxed max-h-32 overflow-y-auto">
                      {currentSession.finalReport}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IMPORT EXISTING AI CONTEXT */}
        {activeTab === 'import' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-lg border border-cyan-800/50 bg-cyan-950/20 text-cyan-200 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <ShieldCheck size={14} className="text-cyan-400" />
                <span>Zero Secret Leak Guarantee</span>
              </div>
              <p className="text-[11px] text-[#8b949e] mt-1 leading-relaxed">
                Automatically detects Claude Code, Gemini CLI, Antigravity, and Project Rules. Secrets (API keys,
                tokens, credentials) are strictly excluded. Original files are never modified.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#8b949e]">Detected AI Tool Contexts</span>
              <button
                onClick={scanSources}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} />
                Rescan
              </button>
            </div>

            <div className="space-y-2">
              {sources.map((s) => (
                <div
                  key={s.source}
                  className="p-2.5 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-between"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={!!selectedSources[s.source]}
                      disabled={!s.detected}
                      onChange={(e) =>
                        setSelectedSources((prev) => ({ ...prev, [s.source]: e.target.checked }))
                      }
                      className="rounded border-[#30363d] text-cyan-600 focus:ring-0 bg-[#0d1117]"
                    />
                    <div>
                      <div className="text-xs font-medium text-white flex items-center gap-1.5">
                        {s.name}
                        {s.detected ? (
                          <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Found ({s.fileCount})
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 rounded bg-[#0d1117] text-[#8b949e]">Not Installed</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8b949e] font-mono">{s.source}</div>
                    </div>
                  </label>

                  {s.detected && (
                    <button
                      onClick={() => handlePreview(s.source)}
                      className="p-1.5 rounded hover:bg-[#21262d] text-[#8b949e] hover:text-cyan-400 cursor-pointer"
                      title="Preview Sanitized Rules"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={importing || Object.values(selectedSources).every((v) => !v)}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
            >
              <FolderSync size={13} className={importing ? 'animate-spin' : ''} />
              {importing ? 'Importing Context...' : 'Import Selected Context (Preserves Originals)'}
            </button>

            {/* Import Results Banner */}
            {importResult && (
              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 text-xs space-y-1">
                <div className="font-semibold text-white flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Import Complete!
                </div>
                <div className="text-[11px] text-emerald-300">
                  Imported {importResult.importedRules} rules & {importResult.importedMemories} memory items.
                </div>
              </div>
            )}

            {/* Preview Modal / Drawer */}
            {previewData && (
              <div className="p-3 rounded-lg bg-[#161b22] border border-cyan-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-400">Context Preview: {previewData.source}</span>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="text-[#8b949e] hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-[11px] text-[#8b949e]">
                  Parsed Rules: {previewData.rules?.length || 0} | Memories: {previewData.memories?.length || 0}
                </div>
                <div className="bg-[#0d1117] p-2 rounded max-h-36 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                  {previewData.rules?.map((r: any, i: number) => (
                    <div key={i} className="border-b border-[#30363d]/50 pb-1">
                      <div className="text-cyan-300 font-semibold">{r.name}</div>
                      <div className="text-[#8b949e] truncate">{r.pattern}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
