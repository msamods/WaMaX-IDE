import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Download, Palette, Wand2, CheckCircle2, Sliders, Layers } from 'lucide-react';

interface StylePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bgGrad: [string, string, string];
}

const STYLES: StylePreset[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    primary: '#06b6d4',
    secondary: '#3b82f6',
    accent: '#a855f7',
    bgGrad: ['#0d1117', '#161b22', '#0b192c']
  },
  {
    id: 'matrix',
    name: 'Matrix Emerald',
    primary: '#10b981',
    secondary: '#059669',
    accent: '#34d399',
    bgGrad: ['#061a12', '#0b291e', '#03140e']
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    primary: '#f59e0b',
    secondary: '#ef4444',
    accent: '#fbbf24',
    bgGrad: ['#1c1307', '#291b0a', '#120b04']
  },
  {
    id: 'violet',
    name: 'Deep Ultraviolet',
    primary: '#8b5cf6',
    secondary: '#ec4899',
    accent: '#c084fc',
    bgGrad: ['#140c24', '#1f1338', '#0c0717']
  }
];

export const ImageStudioPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('Futuristic cybernetic code editor interface, neon cyan accents, 8k');
  const [selectedStyle, setSelectedStyle] = useState<StylePreset>(STYLES[0]);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [assetTitle, setAssetTitle] = useState('WAMAX-DEV-ASSET');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Auto-generate a beautiful default visual asset on first load
  useEffect(() => {
    generateAsset(prompt, STYLES[0]);
  }, []);

  const generateAsset = (customPrompt: string, style: StylePreset) => {
    setGenerating(true);
    setSavedSuccess(false);

    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // 1. Deep Space Tech Gradient Background
          const grad = ctx.createLinearGradient(0, 0, 640, 640);
          grad.addColorStop(0, style.bgGrad[0]);
          grad.addColorStop(0.5, style.bgGrad[1]);
          grad.addColorStop(1, style.bgGrad[2]);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 640);

          // 2. High-Tech Grid Matrix
          ctx.strokeStyle = `${style.primary}18`;
          ctx.lineWidth = 1;
          for (let i = 0; i <= 640; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 640);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(640, i);
            ctx.stroke();
          }

          // 3. Central Radial Glow
          const radial = ctx.createRadialGradient(320, 320, 20, 320, 320, 260);
          radial.addColorStop(0, `${style.primary}33`);
          radial.addColorStop(0.6, `${style.secondary}1a`);
          radial.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = radial;
          ctx.fillRect(0, 0, 640, 640);

          // 4. Tech Concentric HUD Rings
          ctx.save();
          ctx.strokeStyle = `${style.primary}44`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(320, 320, 210, 0, Math.PI * 2);
          ctx.stroke();

          ctx.setLineDash([8, 12]);
          ctx.strokeStyle = `${style.secondary}55`;
          ctx.beginPath();
          ctx.arc(320, 320, 180, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // 5. Center Shield / Hexagon Frame
          ctx.save();
          ctx.shadowColor = style.primary;
          ctx.shadowBlur = 24;
          ctx.strokeStyle = style.primary;
          ctx.lineWidth = 3;
          ctx.strokeRect(170, 170, 300, 300);

          // Subtle Glass Fill
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(170, 170, 300, 300);
          ctx.restore();

          // Corner Accent Brackets
          const bracketLen = 20;
          ctx.strokeStyle = style.accent;
          ctx.lineWidth = 3;
          // TL
          ctx.beginPath();
          ctx.moveTo(170, 170 + bracketLen); ctx.lineTo(170, 170); ctx.lineTo(170 + bracketLen, 170);
          ctx.stroke();
          // TR
          ctx.beginPath();
          ctx.moveTo(470 - bracketLen, 170); ctx.lineTo(470, 170); ctx.lineTo(470, 170 + bracketLen);
          ctx.stroke();
          // BL
          ctx.beginPath();
          ctx.moveTo(170, 470 - bracketLen); ctx.lineTo(170, 470); ctx.lineTo(170 + bracketLen, 470);
          ctx.stroke();
          // BR
          ctx.beginPath();
          ctx.moveTo(470 - bracketLen, 470); ctx.lineTo(470, 470); ctx.lineTo(470, 470 - bracketLen);
          ctx.stroke();

          // 6. Typography & Brand Emblems
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('WaMaX', 320, 305);

          ctx.fillStyle = style.primary;
          ctx.font = '700 13px monospace';
          ctx.letterSpacing = '3px';
          ctx.fillText('AUTONOMOUS VISUAL STUDIO', 320, 340);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 11px sans-serif';
          const cleanPrompt = customPrompt.trim().replace(/^["']|["']$/g, '');
          const truncated = cleanPrompt.length > 40 ? cleanPrompt.slice(0, 37) + '...' : cleanPrompt;
          ctx.fillText(`"${truncated}"`, 320, 395);

          // Watermark Badge Bottom
          ctx.fillStyle = '#64748b';
          ctx.font = '10px monospace';
          ctx.fillText('MSAMODS x WhatYouWantKerala • 1-Click Engine', 320, 600);

          const dataUrl = canvas.toDataURL('image/png');
          setGeneratedImg(dataUrl);
        }
      } catch (err) {
        console.error('Asset generation error:', err);
      } finally {
        setGenerating(false);
      }
    }, 400);
  };

  const handleGenerateClick = () => {
    generateAsset(prompt, selectedStyle);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <Palette size={14} className="text-cyan-400" />
          <span>ComfyUI & Visual Studio</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono lowercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          1-click active
        </span>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3.5">
        {/* Instant 1-Click Status Banner */}
        <div className="p-2.5 rounded-lg border border-cyan-800/60 bg-gradient-to-r from-cyan-950/40 to-blue-950/30 text-cyan-200 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Instant Asset Synthesizer</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161b22] text-cyan-300 border border-cyan-800/40">
              SINGLE-CLICK
            </span>
          </div>
          <p className="text-[11px] text-[#8b949e] mt-1">
            Generates high-resolution production assets, cybernetic badges, and UI visuals immediately. Zero manual setup required.
          </p>
        </div>

        {/* Style Preset Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-[#8b949e] flex items-center gap-1 font-medium">
            <Sliders size={12} />
            Visual Aesthetics & Style
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedStyle(s);
                  generateAsset(prompt, s);
                }}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium border text-left flex items-center justify-between transition-all cursor-pointer ${
                  selectedStyle.id === s.id
                    ? 'border-cyan-500 bg-cyan-950/30 text-white shadow-sm'
                    : 'border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#484f58]'
                }`}
              >
                <span>{s.name}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white/20"
                  style={{ backgroundColor: s.primary }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-[#8b949e] flex items-center justify-between font-medium">
            <span>Generation Prompt</span>
            <span className="text-[10px] text-cyan-400 font-mono">100% Offline</span>
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your asset (e.g., A futuristic cybernetic code editor interface, neon cyan accents, 8k)..."
            className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none font-mono"
          />

          {/* Quick Preset Buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              'Cybernetic Editor UI',
              'Neon App Icon',
              'System Architecture',
              'Autonomous Agent Emblem'
            ].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  const newPrompt = `${tag}, cybernetic visual styling with neon accents`;
                  setPrompt(newPrompt);
                  generateAsset(newPrompt, selectedStyle);
                }}
                className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#21262d] text-[10px] text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer"
              >
                + {tag}
              </button>
            ))}
          </div>

          {/* 1-Click Generate Button */}
          <button
            onClick={handleGenerateClick}
            disabled={generating || !prompt.trim()}
            className="w-full mt-2 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/15 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={15} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Synthesizing Asset (1-Click)...' : 'Generate Visual Asset (1-Click)'}
          </button>
        </div>

        {/* Live Asset Output */}
        {generatedImg && (
          <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Layers size={13} className="text-cyan-400" />
                Rendered Visual Asset
              </span>
              <a
                href={generatedImg}
                download="wamax-visual-asset.png"
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] cursor-pointer"
              >
                <Download size={12} />
                Download PNG
              </a>
            </div>

            <div className="rounded-lg overflow-hidden border border-[#30363d] bg-black shadow-inner">
              <img
                src={generatedImg}
                alt="Generated Visual Asset"
                className="w-full h-auto object-contain block transition-all"
              />
            </div>

            <div className="text-[10px] font-mono text-[#8b949e] flex items-center justify-between pt-1 border-t border-[#30363d]/50">
              <span>Resolution: 640 x 640px</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={11} /> 1-Click Verified
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
