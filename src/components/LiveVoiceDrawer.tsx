import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, X } from 'lucide-react';

interface LiveVoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  caseTitle: string;
}

interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

function floatTo16BitPcmBase64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const LiveVoiceDrawer: React.FC<LiveVoiceDrawerProps> = ({ isOpen, onClose, caseTitle }) => {
  const [connected, setConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);

  const playPcm24k = async (base64: string) => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = playbackCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const binary = atob(base64);
    const len = binary.length / 2;
    const floatData = new Float32Array(len);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < len; i++) {
      floatData[i] = view.getInt16(i * 2, true) / 32768;
    }

    const audioBuf = ctx.createBuffer(1, len, 24000);
    audioBuf.copyToChannel(floatData, 0);
    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuf.duration;
  };

  const stopMic = () => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    captureCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    setMicActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopMic();
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/api/live`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      setEntries((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system',
          text: `Live Gemini voice session opened for ${caseTitle}.`,
        },
      ]);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as {
          inputTranscript?: string;
          outputTranscript?: string;
          audio?: string;
          error?: string;
        };
        if (msg.error) setError(msg.error);
        if (msg.inputTranscript) {
          setEntries((prev) => [...prev, { id: `u-${Date.now()}-${Math.random()}`, role: 'user', text: msg.inputTranscript! }]);
        }
        if (msg.outputTranscript) {
          setEntries((prev) => [...prev, { id: `a-${Date.now()}-${Math.random()}`, role: 'assistant', text: msg.outputTranscript! }]);
        }
        if (msg.audio) {
          playPcm24k(msg.audio).catch(() => {});
        }
      } catch {
        // ignore parse issues
      }
    };

    ws.onerror = () => setError('Live voice WebSocket connection interrupted.');
    ws.onclose = () => setConnected(false);

    return () => {
      stopMic();
      ws.close();
    };
  }, [isOpen, caseTitle]);

  const toggleMic = async () => {
    if (micActive) {
      stopMic();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      micStreamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      captureCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const pcmB64 = floatTo16BitPcmBase64(e.inputBuffer.getChannelData(0));
        wsRef.current.send(JSON.stringify({ audio: pcmB64 }));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      setMicActive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission denied.');
    }
  };

  const sendTextPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: textInput.trim() }));
    setEntries((prev) => [...prev, { id: `ut-${Date.now()}`, role: 'user', text: textInput.trim() }]);
    setTextInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#111827] border-l border-slate-700 shadow-2xl flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-sky-400" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">Live Voice Engineering Coach</h3>
            <p className="text-xs text-slate-400">{connected ? 'Connected (PCM 16k/24k)' : 'Connecting...'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
          aria-label="Close voice coach"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
              entry.role === 'user'
                ? 'bg-sky-500/15 border border-sky-400/30 text-sky-100 ml-8'
                : entry.role === 'assistant'
                  ? 'bg-[#172033] border border-slate-700 text-slate-200 mr-8'
                  : 'bg-slate-900 text-slate-400 text-center'
            }`}
          >
            {entry.text}
          </div>
        ))}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 space-y-3 bg-[#0D131F]">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!connected}
          className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 ${
            micActive
              ? 'bg-red-500 hover:bg-red-400 text-white'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
          }`}
        >
          {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{micActive ? 'Stop Microphone Stream' : 'Start Live Voice Mic'}</span>
        </button>

        <form onSubmit={sendTextPrompt} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type a question to spoken coach..."
            className="flex-1 rounded-lg bg-[#121B2B] border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            disabled={!connected || !textInput.trim()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer disabled:opacity-50"
            aria-label="Send prompt"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
