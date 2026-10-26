import React, { useState, useRef, useEffect } from 'react';
import { Brain, Agent, ChatMessage } from '../../types/ide';
import {
  Send,
  Square,
  Bot,
  User,
  Sparkles,
  Paperclip,
  Copy,
  Check,
  Code2,
  Bug,
  HelpCircle,
  FileCheck,
  ChevronDown
} from 'lucide-react';

interface Props {
  brains: Brain[];
  activeBrainId: string;
  onSelectBrain: (id: string) => void;
  agents: Agent[];
  activeAgentId?: string;
  onSelectAgent: (id: string) => void;
  models: { name: string }[];
  activeModel: string;
  onSelectModel: (model: string) => void;
  activeFilePath?: string;
  activeFileContent?: string;
  onInsertCodeIntoEditor: (code: string) => void;
  onSendChat: (message: string, attachedCode?: string) => Promise<void>;
  messages: ChatMessage[];
  isStreaming: boolean;
  onCancelStream: () => void;
}

export const ChatPanel: React.FC<Props> = ({
  brains,
  activeBrainId,
  onSelectBrain,
  agents,
  activeAgentId,
  onSelectAgent,
  models,
  activeModel,
  onSelectModel,
  activeFilePath,
  activeFileContent,
  onInsertCodeIntoEditor,
  onSendChat,
  messages,
  isStreaming,
  onCancelStream
}) => {
  const [input, setInput] = useState('');
  const [attachCurrentFile, setAttachCurrentFile] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const codeAttachment = attachCurrentFile && activeFileContent ? activeFileContent : undefined;
    onSendChat(input.trim(), codeAttachment);
    setInput('');
  };

  const handleQuickDoubt = (promptText: string) => {
    const codeAttachment = activeFileContent ? activeFileContent : undefined;
    onSendChat(promptText, codeAttachment);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-l border-[#30363d] text-[#c9d1d9] select-text">
      {/* Top Controls Bar */}
      <div className="p-2 border-b border-[#30363d] bg-[#161b22] space-y-1.5 select-none">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Sparkles size={14} className="text-cyan-400" />
            WaMaX AI Assistant
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 font-mono">
            Local Ollama
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {/* Brain Selector */}
          <div>
            <select
              value={activeBrainId}
              onChange={e => onSelectBrain(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1 text-white focus:outline-none focus:border-cyan-400 truncate"
              title="Select AI Brain"
            >
              {brains.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div>
            <select
              value={activeModel}
              onChange={e => onSelectModel(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1 text-white focus:outline-none focus:border-cyan-400 truncate font-mono"
              title="Select Model"
            >
              {models.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Doubt Solver Quick Action Pills */}
      <div className="flex items-center gap-1.5 p-2 border-b border-[#30363d] bg-[#0e1116] overflow-x-auto text-[11px] select-none shrink-0">
        <button
          onClick={() => handleQuickDoubt('Explain the open code file in simple terms for a beginner.')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] text-cyan-300 border border-[#30363d] shrink-0"
        >
          <HelpCircle size={12} /> Explain Code
        </button>
        <button
          onClick={() => handleQuickDoubt('Analyze the open code file for bugs, errors, and unhandled edge cases.')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] text-amber-300 border border-[#30363d] shrink-0"
        >
          <Bug size={12} /> Fix Bugs
        </button>
        <button
          onClick={() => handleQuickDoubt('Refactor this code for cleaner architecture and better performance.')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] text-purple-300 border border-[#30363d] shrink-0"
        >
          <Code2 size={12} /> Refactor
        </button>
        <button
          onClick={() => handleQuickDoubt('Generate comprehensive unit tests for this file.')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] text-emerald-300 border border-[#30363d] shrink-0"
        >
          <FileCheck size={12} /> Write Tests
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8b949e] space-y-2 select-none">
            <Bot size={36} className="text-cyan-400/40" />
            <h4 className="text-sm font-medium text-white">WaMaX Local AI Ready</h4>
            <p className="text-xs max-w-xs leading-relaxed">
              Ask any coding doubt, attach files, review patches, or request refactoring. Zero cloud calls, 100% private.
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1.5 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-[#8b949e]">
                {msg.role === 'user' ? (
                  <>
                    <span>You</span>
                    <User size={12} className="text-cyan-400" />
                  </>
                ) : (
                  <>
                    <Bot size={12} className="text-emerald-400" />
                    <span className="font-medium text-emerald-400">WaMaX AI</span>
                    <span className="font-mono text-[9px] text-[#8b949e]">({msg.modelUsed || activeModel})</span>
                  </>
                )}
              </div>

              {/* Thinking details if any */}
              {msg.thinking && (
                <details className="w-full text-[11px] bg-[#161b22]/50 border border-[#30363d] rounded p-2 text-[#8b949e]">
                  <summary className="cursor-pointer text-[10px] text-cyan-400 font-mono">
                    Model Reasoning Process
                  </summary>
                  <pre className="mt-1 font-mono text-[10px] whitespace-pre-wrap">{msg.thinking}</pre>
                </details>
              )}

              {/* Message Content Bubble */}
              <div
                className={`p-3 rounded-xl text-xs max-w-[95%] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-tr-none'
                    : 'bg-[#161b22] border border-[#30363d] text-[#c9d1d9] rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {/* Actions for Assistant Messages */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#30363d]/60 text-[10px] text-[#8b949e]">
                    <button
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    {msg.content.includes('```') && (
                      <button
                        onClick={() => {
                          const codeMatch = msg.content.match(/```(?:\w+)?\n([\s\S]*?)```/);
                          if (codeMatch && codeMatch[1]) {
                            onInsertCodeIntoEditor(codeMatch[1].trim());
                          }
                        }}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors ml-auto"
                      >
                        <Code2 size={11} />
                        <span>Insert into Editor</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 animate-thinking">
            <Bot size={14} />
            <span>WaMaX AI is generating response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#30363d] bg-[#161b22]">
        {activeFilePath && (
          <div className="flex items-center justify-between mb-2 text-[10px] bg-[#0d1117] px-2 py-1 rounded border border-[#30363d]">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#8b949e] hover:text-white">
              <input
                type="checkbox"
                checked={attachCurrentFile}
                onChange={e => setAttachCurrentFile(e.target.checked)}
                className="rounded border-[#30363d] bg-[#161b22] text-cyan-500"
              />
              <Paperclip size={11} className="text-cyan-400" />
              <span>Attach {activeFilePath} to prompt</span>
            </label>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask a doubt, request a code patch, or refactor... (Enter to send)"
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none font-sans"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onCancelStream}
              className="px-3 bg-red-600/80 hover:bg-red-600 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
              title="Stop generation"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
              title="Send message"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
