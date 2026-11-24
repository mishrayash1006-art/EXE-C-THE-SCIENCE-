import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Mic,
  Radio,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import { SimulationCase, SimulationTelemetry } from '../types/studio';

interface InfographicsViewProps {
  cases: SimulationCase[];
  activeCase: SimulationCase;
  onSelectCase: (caseId: string) => void;
  params: Record<string, number>;
  telemetry: SimulationTelemetry;
  lastSnapshotDataUrl: string | null;
  onOpenVoiceDrawer: () => void;
}

const CaseSchematicSvg: React.FC<{ caseId: string; params: Record<string, number> }> = ({
  caseId,
  params,
}) => {
  if (caseId === 'planetary-gearbox') {
    const sunTeeth = params.sunTeeth ?? 18;
    const ringTeeth = params.ringTeeth ?? 54;
    const ratio = (1 + ringTeeth / Math.max(6, sunTeeth)).toFixed(2);
    return (
      <svg viewBox="0 0 420 220" className="w-full h-52 bg-[#090D16] rounded-lg border border-slate-800">
        <circle cx="150" cy="110" r="82" fill="none" stroke="#334155" strokeWidth="10" strokeDasharray="8 4" />
        <circle cx="150" cy="110" r="26" fill="#0EA5E9" fillOpacity="0.22" stroke="#38BDF8" strokeWidth="2.5" />
        {[0, 120, 240].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const px = 150 + Math.cos(rad) * 53;
          const py = 110 + Math.sin(rad) * 53;
          return (
            <g key={deg}>
              <circle cx={px} cy={py} r="19" fill="#F59E0B" fillOpacity="0.18" stroke="#FBBF24" strokeWidth="2" />
              <line x1="150" y1="110" x2={px} y2={py} stroke="#64748B" strokeWidth="1.5" strokeDasharray="3 3" />
            </g>
          );
        })}
        <text x="260" y="65" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono, monospace">
          Sun Teeth: {sunTeeth}
        </text>
        <text x="260" y="90" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono, monospace">
          Ring Teeth: {ringTeeth}
        </text>
        <text x="260" y="120" fill="#38BDF8" fontSize="13" fontWeight="600" fontFamily="JetBrains Mono, monospace">
          Ratio i = {ratio} : 1
        </text>
        <text x="260" y="148" fill="#FBBF24" fontSize="11" fontFamily="JetBrains Mono, monospace">
          120° Balanced Carrier
        </text>
      </svg>
    );
  }

  if (caseId === 'navier-stokes-airfoil') {
    const aoa = params.angleAttack ?? 6.5;
    return (
      <svg viewBox="0 0 420 220" className="w-full h-52 bg-[#090D16] rounded-lg border border-slate-800">
        {[-50, -25, 0, 25, 50].map((dy, i) => (
          <path
            key={i}
            d={`M 20 ${110 + dy} Q 180 ${88 + dy - aoa * 0.9}, 395 ${112 + dy + aoa * 0.5}`}
            fill="none"
            stroke={i === 2 ? '#38BDF8' : '#334155'}
            strokeWidth={i === 2 ? '2.2' : '1.5'}
          />
        ))}
        <g transform={`translate(200, 110) rotate(${-aoa})`}>
          <path
            d="M -75 0 C -45 -28, 25 -22, 85 2 C 25 12, -45 14, -75 0 Z"
            fill="#1E293B"
            stroke="#FBBF24"
            strokeWidth="2"
          />
          <line x1="-90" y1="0" x2="105" y2="0" stroke="#64748B" strokeDasharray="4 3" />
        </g>
        <text x="20" y="28" fill="#38BDF8" fontSize="11" fontFamily="JetBrains Mono, monospace">
          α = {aoa.toFixed(1)}° · V∞ = {params.flowVelocity ?? 48} m/s
        </text>
      </svg>
    );
  }

  if (caseId === 'lorentz-cyclotron') {
    const bField = params.bField ?? 2.4;
    const radius = Math.max(12, Math.min(34, 48 / bField));
    return (
      <svg viewBox="0 0 420 220" className="w-full h-52 bg-[#090D16] rounded-lg border border-slate-800">
        <ellipse cx="210" cy="110" rx="145" ry="68" fill="none" stroke="#334155" strokeWidth="14" />
        <ellipse cx="210" cy="110" rx="145" ry="68" fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="6 6" />
        <circle cx="210" cy="110" r={radius} fill="none" stroke="#FBBF24" strokeWidth="2.5" />
        <circle cx={210 + radius} cy="110" r="5" fill="#FBBF24" />
        <text x="22" y="28" fill="#38BDF8" fontSize="11" fontFamily="JetBrains Mono, monospace">
          B = {bField.toFixed(1)} T · F = q(E + v × B)
        </text>
      </svg>
    );
  }

  if (caseId === 'fem-truss-bridge') {
    const loadKn = params.loadKn ?? 180;
    const youngs = params.youngsGpa ?? 210;
    const sag = Math.min(26, (loadKn / Math.max(70, youngs)) * 12);
    return (
      <svg viewBox="0 0 420 220" className="w-full h-52 bg-[#090D16] rounded-lg border border-slate-800">
        <path
          d={`M 35 155 Q 210 ${155 + sag} 385 155`}
          fill="none"
          stroke="#94A3B8"
          strokeWidth="3"
        />
        <path
          d={`M 95 75 Q 210 ${75 + sag * 0.8} 325 75`}
          fill="none"
          stroke="#38BDF8"
          strokeWidth="2.5"
        />
        <path
          d={`M 35 155 L 95 75 L 155 ${155 + sag * 0.7} L 210 ${75 + sag * 0.8} L 265 ${155 + sag * 0.7} L 325 75 L 385 155`}
          fill="none"
          stroke="#FBBF24"
          strokeWidth="2"
        />
        <line x1="210" y1="24" x2="210" y2={68 + sag * 0.6} stroke="#F87171" strokeWidth="2.5" />
        <polygon points={`204,${60 + sag * 0.6} 216,${60 + sag * 0.6} 210,${72 + sag * 0.6}`} fill="#F87171" />
        <text x="22" y="28" fill="#38BDF8" fontSize="11" fontFamily="JetBrains Mono, monospace">
          P = {loadKn} kN · E = {youngs} GPa
        </text>
      </svg>
    );
  }

  if (caseId === 'kepler-three-body') {
    const ecc = params.eccentricity ?? 0.18;
    const rx = 140;
    const ry = Math.max(45, 90 * (1 - ecc * 0.55));
    return (
      <svg viewBox="0 0 420 220" className="w-full h-52 bg-[#090D16] rounded-lg border border-slate-800">
        <ellipse cx="210" cy="112" rx={rx} ry={ry} fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="5 4" />
        <circle cx={210 - ecc * 65} cy="112" r="18" fill="#F59E0B" fillOpacity="0.25" stroke="#FBBF24" strokeWidth="2" />
        <circle cx={210 + rx * 0.78} cy={112 - ry * 0.58} r="10" fill="#38BDF8" />
        <polygon points="150,48 158,58 142,58" fill="#34D399" />
        <text x="22" y="28" fill="#38BDF8" fontSize="11" fontFamily="JetBrains Mono, monospace">
          e = {ecc.toFixed(2)} · M₂/M₁ = {(params.massRatio ?? 0.35).toFixed(2)}
        </text>
      </svg>
    );
  }

  const gain = params.elevationGain ?? 2.2;
  return (
    <svg viewBox="0 0 420 220" className="w-full h-52 bg-[#090D16] rounded-lg border border-slate-800">
      <rect x="192" y="26" width="36" height="14" rx="3" fill="#FBBF24" />
      {[-95, -48, 0, 48, 95].map((dx, i) => (
        <line
          key={i}
          x1="210"
          y1="40"
          x2={210 + dx}
          y2={152 - Math.abs(i - 2) * 12 * gain * 0.45}
          stroke="#38BDF8"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      ))}
      <path
        d={`M 25 180 Q 100 ${160 - gain * 14}, 175 ${145 - gain * 8} T 300 ${150 - gain * 12} T 395 178`}
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2.5"
      />
      <text x="22" y="28" fill="#38BDF8" fontSize="11" fontFamily="JetBrains Mono, monospace">
        Steps = {params.raySteps ?? 64} · Gain = {gain.toFixed(1)}x
      </text>
    </svg>
  );
};

export const InfographicsView: React.FC<InfographicsViewProps> = ({
  cases,
  activeCase,
  onSelectCase,
  params,
  telemetry,
  lastSnapshotDataUrl,
  onOpenVoiceDrawer,
}) => {
  const [tutorPrompt, setTutorPrompt] = useState(
    `Explain the practical physical intuition behind ${activeCase.title} and how to optimize its C++20 solver.`
  );
  const [groundingMode, setGroundingMode] = useState<'none' | 'search' | 'maps'>('none');
  const [tutorResponse, setTutorResponse] = useState<string>('');
  const [tutorSources, setTutorSources] = useState<{ title: string; uri: string; type: 'web' | 'maps' }[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaAnalysis, setMediaAnalysis] = useState<string>('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Reactive SVG curve plot geometry
  const curvePaths = useMemo(() => {
    const pts = telemetry.curveSeries;
    if (!pts.length) return { p1: '', p2: '', minY: 0, maxY: 1 };
    const allY = pts.flatMap((p) => [p.y1, p.y2]);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY, minY + 0.001);
    const w = 420;
    const h = 160;
    const pad = 16;

    const mapPoint = (idx: number, val: number) => {
      const x = pad + (idx / Math.max(1, pts.length - 1)) * (w - pad * 2);
      const y = h - pad - ((val - minY) / (maxY - minY)) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const p1 = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapPoint(i, p.y1)}`).join(' ');
    const p2 = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapPoint(i, p.y2)}`).join(' ');
    return { p1, p2, minY, maxY };
  }, [telemetry.curveSeries]);

  const handleAskTutor = async () => {
    setTutorLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${tutorPrompt}\n\nActive Case: ${activeCase.title}\nGoverning Equation: ${activeCase.governingEquation}\nCurrent Parameters: ${JSON.stringify(params)}`,
          groundingMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate explanation');
      setTutorResponse(data.text || '');
      setTutorSources(data.sources || []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Explanation request failed');
    } finally {
      setTutorLoading(false);
    }
  };

  const handleGenerateTts = async () => {
    setTtsLoading(true);
    setAiError(null);
    try {
      const script = `${activeCase.title}. ${activeCase.summary} Key equation: ${activeCase.governingEquation}. ${
        activeCase.concepts[0]?.keyTakeaway ?? ''
      }`;
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voiceName: 'Kore' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TTS failed');
      setTtsAudioUrl(data.audioDataUrl);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to synthesize audio narration');
    } finally {
      setTtsLoading(false);
    }
  };

  const handleToggleMicTranscribe = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = String(reader.result || '').split(',')[1];
          if (!b64) return;
          try {
            const res = await fetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: b64, mimeType: 'audio/webm' }),
            });
            const data = await res.json();
            if (data.transcript) setTutorPrompt(data.transcript);
          } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Transcription error');
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  };

  const handleAnalyzeMedia = async (dataUrl?: string) => {
    const targetUrl = dataUrl || lastSnapshotDataUrl;
    if (!targetUrl) return;
    setMediaLoading(true);
    setAiError(null);
    try {
      const [meta, b64] = targetUrl.split(',');
      const mimeType = meta.match(/data:(.*?);/)?.[1] || 'image/png';
      const res = await fetch('/api/gemini/analyze-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64: b64,
          mimeType,
          prompt: `Inspect this 3D CAD/simulation render for ${activeCase.title} and explain the geometric features and physics forces visible.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Media analysis failed');
      setMediaAnalysis(data.analysis || '');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Media inspection failed');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const nextMsgs: { role: 'user' | 'model'; text: string }[] = [
      ...chatMessages,
      { role: 'user', text: chatInput.trim() },
    ];
    setChatMessages(nextMsgs);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMsgs,
          context: `${activeCase.title} (${activeCase.domain}), equation: ${activeCase.governingEquation}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setChatMessages([...nextMsgs, { role: 'model', text: data.text || '' }]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setChatLoading(false);
    }
  };

  const visualAsset =
    activeCase.infographicImage || '/src/assets/images/metal_machined_texture_1795497634409.jpg';

  return (
    <div className="flex-1 overflow-y-auto bg-[#0B0F17] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Topic Selector Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">
              Topic {activeCase.indexLabel} · {activeCase.domain}
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-100 mt-1">
              {activeCase.title} — Concept Infographics
            </h1>
            <p className="text-sm text-slate-400 mt-1">{activeCase.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select infographic topic"
              value={activeCase.id}
              onChange={(e) => onSelectCase(e.target.value)}
              className="rounded-lg bg-[#121B2B] border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-400 cursor-pointer"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.indexLabel} — {c.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleGenerateTts}
              disabled={ttsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer disabled:opacity-50"
            >
              <Volume2 className="w-4 h-4 text-sky-400" />
              <span>{ttsLoading ? 'Synthesizing...' : 'Narrate Concept'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenVoiceDrawer}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>Live Voice Coach</span>
            </button>
          </div>
        </div>

        {ttsAudioUrl && (
          <div className="rounded-xl bg-[#111827] border border-sky-500/30 p-3 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-sky-300">Concept Audio Briefing</span>
            <audio controls src={ttsAudioUrl} className="h-8 flex-1 max-w-md" />
          </div>
        )}

        {/* Infographic Nodes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {activeCase.infographicNodes.map((node) => (
            <div key={node.label} className="rounded-xl bg-[#111827] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">{node.label}</div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-100 tabular-nums">
                {node.value} <span className="text-xs font-normal text-sky-400">{node.unit}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{node.detail}</div>
            </div>
          ))}
        </div>

        {/* Visual Schematic + Live Curve Plot + Scientific Illustration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Interactive Parameter Schematic
            </h2>
            <CaseSchematicSvg caseId={activeCase.id} params={params} />
            <div className="rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 font-mono text-xs text-sky-300 overflow-x-auto">
              {activeCase.governingEquation}
            </div>
          </div>

          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Real-Time Response Curve
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {telemetry.primaryMetricLabel}: {telemetry.primaryMetricValue} {telemetry.primaryMetricUnit}
              </span>
            </div>
            <svg viewBox="0 0 420 160" className="w-full h-44 bg-[#090D16] rounded-lg border border-slate-800">
              <line x1="16" y1="144" x2="404" y2="144" stroke="#334155" strokeWidth="1" />
              <line x1="16" y1="16" x2="16" y2="144" stroke="#334155" strokeWidth="1" />
              <path d={curvePaths.p1} fill="none" stroke="#38BDF8" strokeWidth="2.5" />
              <path d={curvePaths.p2} fill="none" stroke="#FBBF24" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
              <span className="text-sky-300">Primary Channel</span>
              <span className="text-amber-300">Secondary Harmonic</span>
              <span>
                Range [{curvePaths.minY.toFixed(1)}, {curvePaths.maxY.toFixed(1)}]
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Visual Field Reference
            </h2>
            <div className="relative h-44 rounded-lg overflow-hidden bg-[#090D16] border border-slate-800">
              <img
                src={lastSnapshotDataUrl || visualAsset}
                alt={`${activeCase.title} infographic visualization`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Upload Diagram</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = () => handleAnalyzeMedia(String(r.result || ''));
                    r.readAsDataURL(file);
                  }}
                />
              </label>
              <button
                type="button"
                disabled={!lastSnapshotDataUrl || mediaLoading}
                onClick={() => handleAnalyzeMedia()}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer disabled:opacity-40"
              >
                {mediaLoading ? 'Analyzing...' : 'Inspect 3D Capture'}
              </button>
            </div>
          </div>
        </div>

        {mediaAnalysis && (
          <div className="rounded-xl bg-[#111827] border border-sky-500/30 p-4 text-sm text-slate-200 whitespace-pre-wrap">
            {mediaAnalysis}
          </div>
        )}

        {/* Concept Explanations & Equations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-100">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <h2 className="font-display text-base font-semibold">Core Physics & Modeling Concepts</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{activeCase.summary}</p>
            <div className="space-y-3">
              {activeCase.concepts.map((c) => (
                <div key={c.heading} className="rounded-lg bg-[#0D131F] border border-slate-800 p-4 space-y-1.5">
                  <h3 className="font-display text-sm font-semibold text-sky-300">{c.heading}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{c.body}</p>
                  <p className="text-xs font-medium text-amber-300 pt-1">Key Insight: {c.keyTakeaway}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Governing Equations & Numerical Formulation
            </h2>
            <div className="space-y-3">
              {activeCase.equations.map((eq) => (
                <div key={eq.title} className="rounded-lg bg-[#0D131F] border border-slate-800 p-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{eq.title}</div>
                  <div className="font-mono text-sm text-sky-300 bg-[#080B12] px-3 py-2 rounded border border-slate-800/80">
                    {eq.formula}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{eq.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Concept Deep-Dive Tutor & Grounding + Multi-Turn Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-display text-base font-semibold text-slate-100">
                Engineering Concept Deep-Dive
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGroundingMode('none')}
                  className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                    groundingMode === 'none' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setGroundingMode('search')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer ${
                    groundingMode === 'search' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  Web Search
                </button>
                <button
                  type="button"
                  onClick={() => setGroundingMode('maps')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer ${
                    groundingMode === 'maps' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Compass className="w-3 h-3" />
                  Maps Context
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={tutorPrompt}
                onChange={(e) => setTutorPrompt(e.target.value)}
                className="flex-1 rounded-lg bg-[#0D131F] border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={handleToggleMicTranscribe}
                className={`px-3 py-2 rounded-lg text-xs cursor-pointer ${
                  recording ? 'bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Dictate engineering question"
              >
                {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleAskTutor}
                disabled={tutorLoading}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                {tutorLoading ? 'Explaining...' : 'Explain'}
              </button>
            </div>

            {tutorResponse && (
              <div className="rounded-lg bg-[#0D131F] border border-slate-800 p-3.5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {tutorResponse}
              </div>
            )}

            {tutorSources.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {tutorSources.map((src, i) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{src.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 flex flex-col space-y-3">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Interactive Simulation Q&A
            </h2>
            <div className="flex-1 min-h-[160px] max-h-60 overflow-y-auto space-y-2 rounded-lg bg-[#0D131F] border border-slate-800 p-3">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Ask follow-up questions about boundary conditions, mesh density, or C++ solver tuning.
                </p>
              ) : (
                chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-sky-500/15 text-sky-100 ml-8'
                        : 'bg-slate-800/80 text-slate-200 mr-8'
                    }`}
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 rounded-lg bg-[#0D131F] border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {aiError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">
            {aiError}
          </div>
        )}
      </div>
    </div>
  );
};
