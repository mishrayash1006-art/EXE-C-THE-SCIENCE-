import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Download,
  FileSpreadsheet,
  FileUp,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  AdminReportRow,
  EncryptedBackupRecord,
  SimulationCase,
  SimulationTelemetry,
} from '../types/studio';
import { decryptSessionPayload, encryptSessionPayload } from '../utils/cryptoBackup';
import {
  deleteEncryptedBackup,
  saveCustomSimulationCase,
  saveEncryptedBackup,
} from '../services/firestoreService';
import {
  appendReportRowToSheet,
  createReportSpreadsheet,
  readReportRowsFromSheet,
} from '../services/workspaceApi';

interface AdminDashboardViewProps {
  user: User | null;
  accessToken: string | null;
  activeCase: SimulationCase;
  params: Record<string, number>;
  telemetry: SimulationTelemetry;
  backups: EncryptedBackupRecord[];
  spreadsheetId: string;
  onSpreadsheetLinked: (sheetId: string) => void;
  onRestoreParams: (caseId: string, restoredParams: Record<string, number>) => void;
  onAddCustomCase: (newCase: SimulationCase) => void;
  onRequestAuth: () => void;
  onRequestConfirm: (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<void>;
  }) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  accessToken,
  activeCase,
  params,
  telemetry,
  backups,
  spreadsheetId,
  onSpreadsheetLinked,
  onRestoreParams,
  onAddCustomCase,
  onRequestAuth,
  onRequestConfirm,
}) => {
  const [sheetInput, setSheetInput] = useState(spreadsheetId);
  const [sheetRows, setSheetRows] = useState<AdminReportRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  const [backupTitle, setBackupTitle] = useState(`${activeCase.title} Snapshot`);
  const [decryptedPreview, setDecryptedPreview] = useState<{
    id: string;
    data: Record<string, unknown>;
  } | null>(null);

  const [docText, setDocText] = useState('');
  const [parsingDoc, setParsingDoc] = useState(false);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const latestChecksum = backups[0]?.checksum?.slice(0, 12) || 'local-session';

  const handleSaveEncryptedBackup = async () => {
    if (!user) {
      onRequestAuth();
      return;
    }
    setErrorMsg(null);
    try {
      const payload = {
        caseId: activeCase.id,
        caseTitle: activeCase.title,
        params,
        telemetry: {
          primary: `${telemetry.primaryMetricValue} ${telemetry.primaryMetricUnit}`,
          energyJ: telemetry.energyJ,
          stabilityIndex: telemetry.stabilityIndex,
        },
        savedAt: new Date().toISOString(),
      };
      const encrypted = await encryptSessionPayload(payload, user.uid);
      const id = await saveEncryptedBackup(
        user.uid,
        activeCase.id,
        backupTitle.trim() || `${activeCase.title} Snapshot`,
        encrypted,
        spreadsheetId || undefined
      );
      setStatusMsg(`Saved AES-256-GCM encrypted cloud backup (${id}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save encrypted backup.');
    }
  };

  const handleDecryptRecord = async (record: EncryptedBackupRecord) => {
    if (!user) return;
    setErrorMsg(null);
    try {
      const data = await decryptSessionPayload(record.ciphertext, record.iv, user.uid);
      setDecryptedPreview({ id: record.id, data });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AES-256-GCM decryption failed.');
    }
  };

  const handleRestoreRecord = async (record: EncryptedBackupRecord) => {
    if (!user) return;
    try {
      const data = await decryptSessionPayload(record.ciphertext, record.iv, user.uid);
      const restoredCaseId = String(data.caseId || record.caseId);
      const restoredParams = (data.params as Record<string, number>) || {};
      onRestoreParams(restoredCaseId, restoredParams);
      setStatusMsg(`Restored parameters for "${record.title}" into 3D simulator.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to restore session.');
    }
  };

  const handleDeleteRecord = (record: EncryptedBackupRecord) => {
    onRequestConfirm({
      title: 'Delete Encrypted Backup',
      description: `Permanently delete encrypted cloud backup "${record.title}" from Firestore?`,
      confirmLabel: 'Delete Backup',
      destructive: true,
      onConfirm: async () => {
        await deleteEncryptedBackup(record.id);
        if (decryptedPreview?.id === record.id) setDecryptedPreview(null);
        setStatusMsg(`Deleted backup "${record.title}".`);
      },
    });
  };

  const handleCreateSheet = () => {
    if (!accessToken) {
      onRequestAuth();
      return;
    }
    onRequestConfirm({
      title: 'Create Admin Report Google Sheet',
      description: 'Create a new Google Sheet with SimulationReports headers in your Google Drive?',
      confirmLabel: 'Create Sheet',
      onConfirm: async () => {
        setErrorMsg(null);
        const created = await createReportSpreadsheet(accessToken, 'Helios C++ Admin Reports');
        setSheetInput(created.spreadsheetId);
        onSpreadsheetLinked(created.spreadsheetId);
        setStatusMsg(`Linked new Google Sheet: ${created.spreadsheetId}`);
      },
    });
  };

  const handleSyncRowToSheet = () => {
    const targetId = sheetInput.trim() || spreadsheetId;
    if (!accessToken) {
      onRequestAuth();
      return;
    }
    if (!targetId) {
      setErrorMsg('Create or paste a Google Spreadsheet ID first.');
      return;
    }
    onRequestConfirm({
      title: 'Append Telemetry Row to Google Sheets',
      description: `Append a live simulation report row for "${activeCase.title}" to Spreadsheet ${targetId}?`,
      confirmLabel: 'Sync Row to Sheet',
      onConfirm: async () => {
        setErrorMsg(null);
        const row: AdminReportRow = {
          timestamp: new Date().toISOString(),
          userEmail: user?.email || 'anonymous',
          caseId: activeCase.id,
          caseTitle: activeCase.title,
          primaryValue: `${telemetry.primaryMetricValue} ${telemetry.primaryMetricUnit}`,
          energyJ: String(telemetry.energyJ),
          stability: `${telemetry.stabilityIndex}%`,
          solverUs: String(telemetry.solverStepUs),
          backupChecksum: latestChecksum,
        };
        await appendReportRowToSheet(accessToken, targetId, row);
        onSpreadsheetLinked(targetId);
        const rows = await readReportRowsFromSheet(accessToken, targetId);
        setSheetRows(rows);
        setStatusMsg(`Synced live telemetry row to Google Sheet (${rows.length} total rows).`);
      },
    });
  };

  const handleRefreshSheet = async () => {
    const targetId = sheetInput.trim() || spreadsheetId;
    if (!accessToken) {
      onRequestAuth();
      return;
    }
    if (!targetId) {
      setErrorMsg('Enter a Google Spreadsheet ID to read report rows.');
      return;
    }
    setSheetLoading(true);
    setErrorMsg(null);
    try {
      const rows = await readReportRowsFromSheet(accessToken, targetId);
      setSheetRows(rows);
      onSpreadsheetLinked(targetId);
      setStatusMsg(`Loaded ${rows.length} rows from Google Sheets.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch Google Sheet rows.');
    } finally {
      setSheetLoading(false);
    }
  };

  const handleExportCsv = () => {
    const rowsToExport: AdminReportRow[] =
      sheetRows.length > 0
        ? sheetRows
        : [
            {
              timestamp: new Date().toISOString(),
              userEmail: user?.email || 'local-session',
              caseId: activeCase.id,
              caseTitle: activeCase.title,
              primaryValue: `${telemetry.primaryMetricValue} ${telemetry.primaryMetricUnit}`,
              energyJ: String(telemetry.energyJ),
              stability: `${telemetry.stabilityIndex}%`,
              solverUs: String(telemetry.solverStepUs),
              backupChecksum: latestChecksum,
            },
          ];
    const header = 'Timestamp,User,CaseID,CaseTitle,PrimaryOutput,EnergyJ,Stability,SolverUs,Checksum\n';
    const body = rowsToExport
      .map((r) =>
        [
          r.timestamp,
          r.userEmail,
          r.caseId,
          `"${r.caseTitle.replace(/"/g, '""')}"`,
          `"${r.primaryValue}"`,
          r.energyJ,
          r.stability,
          r.solverUs,
          r.backupChecksum,
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Helios_Admin_Report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDocument = async () => {
    if (!docText.trim()) {
      setErrorMsg('Paste or upload document text containing simulation cases first.');
      return;
    }
    setParsingDoc(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/gemini/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentText: docText }),
      });
      const data = await res.json();
      if (!res.ok || !data.parsed) throw new Error(data.error || 'Document parsing failed');
      const p = data.parsed as Partial<SimulationCase>;
      const id = `doc_${Date.now().toString(36)}`;
      const newCase: SimulationCase = {
        id,
        indexLabel: 'DOC',
        title: p.title || 'Imported Document Case',
        domain: p.domain || 'Custom Physics',
        subtitle: p.subtitle || 'Generated from uploaded technical specification',
        summary: p.summary || docText.slice(0, 240),
        cppClassName: (p.cppClassName || 'CustomDocumentSolver').replace(/[^a-zA-Z0-9_]/g, ''),
        governingEquation: p.governingEquation || 'd²u/dt² + ω²u = F(t)',
        equations: p.equations?.length
          ? p.equations
          : [{ title: 'Primary Law', formula: p.governingEquation || 'F = ma', explanation: p.summary || '' }],
        concepts: p.concepts?.length
          ? p.concepts
          : [{ heading: 'Extracted Concept', body: p.summary || docText.slice(0, 200), keyTakeaway: 'Generated directly from document.' }],
        infographicNodes: [
          { label: 'Source', value: 'Document', unit: 'Parsed', detail: 'Custom imported specification' },
          { label: 'Solver Class', value: (p.cppClassName || 'Custom').slice(0, 14), unit: 'C++20', detail: 'Auto-generated kernel' },
        ],
        parameters: p.parameters?.length
          ? p.parameters
          : [
              { key: 'raySteps', label: 'Solver Resolution', unit: 'steps', min: 16, max: 128, step: 8, defaultValue: 64 },
              { key: 'terrainScale', label: 'Field Frequency', unit: 'x', min: 0.6, max: 2.8, step: 0.1, defaultValue: 1.4 },
              { key: 'elevationGain', label: 'Response Gain', unit: 'x', min: 0.8, max: 4.0, step: 0.2, defaultValue: 2.2 },
            ],
        isCustom: true,
      };
      onAddCustomCase(newCase);
      if (user) {
        await saveCustomSimulationCase(user.uid, newCase);
      }
      setDocText('');
      setStatusMsg(`Imported "${newCase.title}" into 3D Simulator, Infographics, and C++20 Engine.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse document.');
    } finally {
      setParsingDoc(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0B0F17] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">
              Admin Reporting · AES-256-GCM Vault · Document Importer
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-100 mt-1">
              Administrative Control & Encrypted Sync
            </h1>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer self-start"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Report CSV</span>
          </button>
        </div>

        {/* High-Signal Tabular Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4">
            <div className="text-xs text-slate-400">{telemetry.primaryMetricLabel}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-sky-300 tabular-nums">
              {telemetry.primaryMetricValue} {telemetry.primaryMetricUnit}
            </div>
          </div>
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4">
            <div className="text-xs text-slate-400">Stability & Step</div>
            <div className="mt-1 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
              {telemetry.stabilityIndex}% · {telemetry.solverStepUs} µs
            </div>
          </div>
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4">
            <div className="text-xs text-slate-400">Encrypted Cloud Backups</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-100 tabular-nums">
              {backups.length}
            </div>
          </div>
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4">
            <div className="text-xs text-slate-400">Synced Sheet Rows</div>
            <div className="mt-1 font-mono text-xl font-semibold text-amber-300 tabular-nums">
              {sheetRows.length}
            </div>
          </div>
        </div>

        {statusMsg && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-300">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Google Sheets Real-Time Report Generation */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Google Sheets Real-Time Reports
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCreateSheet}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Sheet</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="Paste Google Spreadsheet ID or create new..."
                className="flex-1 rounded-lg bg-[#0D131F] border border-slate-700 px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={handleSyncRowToSheet}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer shrink-0"
              >
                Sync Live Run
              </button>
              <button
                type="button"
                onClick={handleRefreshSheet}
                disabled={sheetLoading}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer inline-flex items-center gap-1 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sheetLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#090D16] max-h-56">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead className="bg-[#0D131F] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Output</th>
                    <th className="px-3 py-2">Stability</th>
                    <th className="px-3 py-2">Step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {sheetRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-500 font-sans">
                        Link or create a Google Sheet to view real-time synced administrative rows.
                      </td>
                    </tr>
                  ) : (
                    sheetRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{row.caseTitle}</td>
                        <td className="px-3 py-2 text-sky-300">{row.primaryValue}</td>
                        <td className="px-3 py-2 text-emerald-400">{row.stability}</td>
                        <td className="px-3 py-2">{row.solverUs} µs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AES-256-GCM Encrypted Cloud Session Backups */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Encrypted Cloud Backups (AES-256-GCM)
                </h2>
              </div>
              {!user && (
                <button
                  type="button"
                  onClick={onRequestAuth}
                  className="text-xs text-sky-400 hover:underline cursor-pointer"
                >
                  Sign In to Sync
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={backupTitle}
                onChange={(e) => setBackupTitle(e.target.value)}
                placeholder="Backup label..."
                className="flex-1 rounded-lg bg-[#0D131F] border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={handleSaveEncryptedBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Encrypt & Save</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {backups.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">
                  {user
                    ? 'No encrypted backups stored yet. Click Encrypt & Save to archive the active session.'
                    : 'Sign in with Google, Apple, or Microsoft to store AES-256-GCM encrypted session backups in Firestore.'}
                </p>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg bg-[#0D131F] border border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">{b.title}</div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {b.algorithm} · SHA256:{b.checksum.slice(0, 14)}…
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDecryptRecord(b)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Unlock className="w-3 h-3 text-sky-400" />
                        <span>Inspect</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestoreRecord(b)}
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-[11px] text-sky-300 cursor-pointer"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(b)}
                        className="p-1 rounded bg-red-500/15 hover:bg-red-500/25 text-red-300 cursor-pointer"
                        aria-label="Delete backup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {decryptedPreview && (
              <pre className="rounded-lg bg-[#080C14] border border-sky-500/30 p-3 text-[11px] font-mono text-sky-200 overflow-x-auto max-h-40">
                {JSON.stringify(decryptedPreview.data, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Document-to-Simulator Case Importer */}
        <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Document-to-Simulator Case Importer
              </h2>
              <p className="text-xs text-slate-400">
                Upload a `.txt`, `.md`, or `.json` technical specification or paste equations below to synthesize a live 3D simulation case and C++20 solver.
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer self-start">
              <FileUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Load File</span>
              <input
                type="file"
                accept=".txt,.md,.json,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setDocText(String(reader.result || ''));
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            rows={4}
            placeholder="Paste physics problem statement, CAD spec, differential equations, or engineering case parameters..."
            className="w-full rounded-lg bg-[#0D131F] border border-slate-700 p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImportDocument}
              disabled={parsingDoc || !docText.trim()}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer disabled:opacity-50"
            >
              {parsingDoc ? 'Generating 3D Case & C++20 Solver...' : 'Generate Interactive Simulation Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
