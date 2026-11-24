import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Check, CloudUpload, Copy, Cpu, Download, FileCode2, Sparkles } from 'lucide-react';
import { SimulationCase } from '../types/studio';
import { generateCppProjectFiles } from '../utils/physicsEngine';
import { uploadTextFileToDrive } from '../services/workspaceApi';

interface CppEngineViewProps {
  activeCase: SimulationCase;
  params: Record<string, number>;
  accessToken: string | null;
  onRequestAuth: () => void;
  onRequestConfirm: (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }) => void;
}

export const CppEngineView: React.FC<CppEngineViewProps> = ({
  activeCase,
  params,
  accessToken,
  onRequestAuth,
  onRequestConfirm,
}) => {
  const files = useMemo(() => generateCppProjectFiles(activeCase, params), [activeCase, params]);
  const [selectedPath, setSelectedPath] = useState<string>('src/Solver.cpp');
  const [copied, setCopied] = useState(false);
  const [auditResult, setAuditResult] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const activeFile = files.find((f) => f.path === selectedPath) || files[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    files.forEach((f) => {
      zip.file(f.path, f.content);
    });
    zip.file(
      'README.md',
      `# Helios C++20 :: ${activeCase.title}\n\nBuild native desktop executable:\n\n\`\`\`bash\ncmake -B build -DCMAKE_BUILD_TYPE=Release\ncmake --build build --config Release\n\`\`\`\n`
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Helios_${activeCase.cppClassName}_Cpp20.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunFastAudit = async () => {
    setAuditLoading(true);
    setErrorNote(null);
    try {
      const res = await fetch('/api/gemini/fast-cpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseTitle: activeCase.title,
          cppCode: activeFile.content,
          params,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      setAuditResult(data.text || '');
    } catch (err) {
      setErrorNote(err instanceof Error ? err.message : 'C++ audit failed');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleSaveToDrive = () => {
    if (!accessToken) {
      onRequestAuth();
      return;
    }
    const bundle = files
      .map((f) => `// ===== FILE: ${f.path} =====\n${f.content}`)
      .join('\n\n');
    const fileName = `Helios_${activeCase.cppClassName}_Source.txt`;

    onRequestConfirm({
      title: 'Upload C++20 Source to Google Drive',
      description: `Upload ${fileName} (containing CMakeLists.txt, C++20 headers, solver, GLFW entrypoint, and GLSL 4.60 shader) to your Google Drive?`,
      confirmLabel: 'Upload to Drive',
      onConfirm: async () => {
        setErrorNote(null);
        const uploaded = await uploadTextFileToDrive(accessToken, fileName, bundle, 'text/plain');
        setStatusNote(`Uploaded "${uploaded.name}" to Google Drive (ID: ${uploaded.id}).`);
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0B0F17] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">
              Native C++20 · OpenGL 4.6 · GLFW · GLM · CMake
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-100 mt-1">
              {activeCase.cppClassName} Source Architecture
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Parameters automatically synchronize from the 3D simulator into C++20 structs. Export the CMake bundle to compile a native Windows/Linux executable locally.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunFastAudit}
              disabled={auditLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{auditLoading ? 'Auditing...' : 'SIMD & C++20 Audit'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveToDrive}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-sky-400" />
              <span>Save to Google Drive</span>
            </button>
            <button
              type="button"
              data-testid="download-cpp-zip"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download C++20 Project (.zip)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* File Explorer + Build Instructions */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl bg-[#111827] border border-slate-800 p-3 space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Project Files
              </div>
              {files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelectedPath(f.path)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                    activeFile.path === f.path
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-400/35'
                      : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-200">
                <Cpu className="w-4 h-4 text-sky-400" />
                <span className="font-display text-xs font-semibold">Desktop Executable Build</span>
              </div>
              <pre className="text-[11px] font-mono text-slate-300 bg-[#080C14] rounded-lg p-3 border border-slate-800 overflow-x-auto">
{`cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
./build/Helios_${activeCase.cppClassName}`}
              </pre>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-9 space-y-4">
            <div className="rounded-xl bg-[#0D131F] border border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-[#111827] border-b border-slate-800 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-200">{activeFile.path}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-200 leading-relaxed overflow-x-auto max-h-[540px]">
                <code>{activeFile.content}</code>
              </pre>
            </div>

            {auditResult && (
              <div className="rounded-xl bg-[#111827] border border-amber-500/30 p-4 space-y-2">
                <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                  C++20 / SIMD Performance Audit
                </div>
                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{auditResult}</div>
              </div>
            )}
          </div>
        </div>

        {statusNote && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-300">
            {statusNote}
          </div>
        )}
        {errorNote && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">
            {errorNote}
          </div>
        )}
      </div>
    </div>
  );
};
