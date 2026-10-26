import React, { useRef, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';

interface Props {
  path: string;
  content: string;
  onChange: (val: string) => void;
  onSave: () => void;
}

const getLanguage = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
};

export const MonacoEditorWrapper: React.FC<Props> = ({
  path,
  content,
  onChange,
  onSave
}) => {
  const editorRef = useRef<any>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;

    // Ctrl+S / Cmd+S save binding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#161b22] overflow-hidden">
      {/* Breadcrumb path bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#0d1117] border-b border-[#30363d] text-[11px] text-[#8b949e] font-mono">
        <span className="truncate">{path}</span>
        <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800">
          {getLanguage(path).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <Editor
          height="100%"
          language={getLanguage(path)}
          value={content}
          theme="vs-dark"
          onChange={val => onChange(val || '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            renderWhitespace: 'selection',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true }
          }}
        />
      </div>

      {/* Editor Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#0e1116] border-t border-[#30363d] text-[10px] text-[#8b949e] font-mono">
        <div className="flex items-center gap-3">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
        <div className="flex items-center gap-2 text-cyan-400">
          <span>Press Ctrl+S to save</span>
        </div>
      </div>
    </div>
  );
};
