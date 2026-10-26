import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

export const ImageStudioPanel: React.FC = () => {
  const [comfyAvailable, setComfyAvailable] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [prompt, setPrompt] = useState('');

  const checkComfy = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/comfy/status');
      const data = await res.json();
      setComfyAvailable(data.available || false);
    } catch {
      setComfyAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkComfy();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <ImageIcon size={14} className="text-cyan-400" />
          <span>ComfyUI Image Studio</span>
        </div>
        <button
          onClick={checkComfy}
          className="p-1 hover:bg-[#161b22] rounded text-[#8b949e] hover:text-[#c9d1d9]"
          title="Refresh ComfyUI Status"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        {!comfyAvailable ? (
          <div className="p-3 rounded-lg border border-amber-800/50 bg-amber-950/20 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-amber-400">
              <AlertCircle size={15} />
              <span>ComfyUI Not Running Locally</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/80">
              ComfyUI image generation is an optional module. Your WaMaX code IDE and AI chat function 100% offline without it.
            </p>
            <div className="bg-[#0d1117] p-2 rounded text-[10px] font-mono text-cyan-300">
              git clone https://github.com/comfyanonymous/ComfyUI<br />
              python main.py --listen 127.0.0.1 --port 8188
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-emerald-800/50 bg-emerald-950/20 text-emerald-300 text-xs">
            ComfyUI detected and connected on port 8188!
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[11px] text-[#8b949e] block font-medium">Generation Prompt</label>
          <textarea
            rows={3}
            placeholder="A futuristic cybernetic code editor interface, neon cyan accents, 8k..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={!comfyAvailable}
            className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none disabled:opacity-40"
          />
          <button
            disabled={!comfyAvailable || !prompt.trim()}
            className="w-full py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Sparkles size={13} />
            Generate Visual Asset
          </button>
        </div>
      </div>
    </div>
  );
};
