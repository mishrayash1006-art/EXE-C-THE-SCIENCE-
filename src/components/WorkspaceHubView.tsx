import React, { useState } from 'react';
import {
  Calendar,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FormInput,
  Mail,
  MessageSquare,
  Presentation,
  RefreshCw,
  Users,
  Video,
  Lock,
} from 'lucide-react';
import { SimulationCase, SimulationTelemetry } from '../types/studio';
import {
  createCalendarReviewEvent,
  createEngineeringDoc,
  createFeedbackForm,
  createMeetSpace,
  createReportSpreadsheet,
  createSimulationSlidesDeck,
  createTaskItem,
  listCalendarEvents,
  listChatSpaces,
  listContacts,
  listDriveFiles,
  listGmailMessages,
  listTasks,
  uploadTextFileToDrive,
} from '../services/workspaceApi';
import { sendGmailSummary } from '../services/workspaceApi';

interface WorkspaceHubViewProps {
  accessToken: string | null;
  userEmail: string | null;
  activeCase: SimulationCase;
  telemetry: SimulationTelemetry;
  spreadsheetId: string;
  onSpreadsheetLinked: (sheetId: string) => void;
  onRequestAuth: () => void;
  onRequestConfirm: (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }) => void;
}

export const WorkspaceHubView: React.FC<WorkspaceHubViewProps> = ({
  accessToken,
  userEmail,
  activeCase,
  telemetry,
  spreadsheetId,
  onSpreadsheetLinked,
  onRequestAuth,
  onRequestConfirm,
}) => {
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; mimeType: string }[]>([]);
  const [gmailList, setGmailList] = useState<{ id: string; snippet?: string }[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<{ id: string; summary?: string; start?: { dateTime?: string; date?: string } }[]>([]);
  const [tasksList, setTasksList] = useState<{ id: string; title: string; status: string }[]>([]);
  const [contactsList, setContactsList] = useState<{ name: string; email: string }[]>([]);
  const [chatSpaces, setChatSpaces] = useState<{ name: string; displayName?: string }[]>([]);

  const [gmailRecipient, setGmailRecipient] = useState(userEmail || '');
  const [meetResult, setMeetResult] = useState<{ meetingUri: string; meetingCode: string } | null>(null);
  const [formResult, setFormResult] = useState<{ formId: string; responderUri: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const runRead = async (key: string, fn: () => Promise<void>) => {
    if (!accessToken) {
      onRequestAuth();
      return;
    }
    setBusyKey(key);
    setErrMsg(null);
    try {
      await fn();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : `Workspace request (${key}) failed.`);
    } finally {
      setBusyKey(null);
    }
  };

  const confirmWrite = (title: string, description: string, confirmLabel: string, action: () => Promise<void>) => {
    if (!accessToken) {
      onRequestAuth();
      return;
    }
    onRequestConfirm({
      title,
      description,
      confirmLabel,
      onConfirm: async () => {
        setErrMsg(null);
        try {
          await action();
        } catch (err) {
          setErrMsg(err instanceof Error ? err.message : 'Workspace operation failed.');
        }
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0B0F17] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">
              Google Workspace Live REST Suite
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-100 mt-1">
              Workspace Synchronization Hub
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Connected directly to Drive, Sheets, Docs, Slides, Gmail, Calendar, Tasks, Forms, Meet, Contacts, and Enterprise Chat using OAuth in-memory tokens.
            </p>
          </div>
          {!accessToken ? (
            <button
              type="button"
              onClick={onRequestAuth}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Authorize Google Workspace</span>
            </button>
          ) : (
            <div className="text-xs font-mono text-emerald-400">
              OAuth Session Active · {userEmail || 'Authorized Account'}
            </div>
          )}
        </div>

        {notice && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-300">
            {notice}
          </div>
        )}
        {errMsg && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">
            {errMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* 1. Google Drive */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">Google Drive</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  runRead('drive', async () => {
                    const files = await listDriveFiles(accessToken!);
                    setDriveFiles(files);
                    setNotice(`Loaded ${files.length} Drive files.`);
                  })
                }
                className="text-xs text-sky-300 hover:text-sky-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busyKey === 'drive' ? 'animate-spin' : ''}`} />
                <span>Load Files</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                confirmWrite(
                  'Upload Case Summary to Drive',
                  `Create a Drive artifact for "${activeCase.title}" telemetry?`,
                  'Upload to Drive',
                  async () => {
                    const res = await uploadTextFileToDrive(
                      accessToken!,
                      `Helios_${activeCase.id}_Summary.txt`,
                      `Case: ${activeCase.title}\nEquation: ${activeCase.governingEquation}\n${telemetry.primaryMetricLabel}: ${telemetry.primaryMetricValue} ${telemetry.primaryMetricUnit}`
                    );
                    setNotice(`Uploaded "${res.name}" to Google Drive.`);
                  }
                )
              }
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
            >
              Upload Active Case Brief
            </button>
            <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-slate-300">
              {driveFiles.length === 0 ? (
                <p className="text-slate-500">Click Load Files to query recent Drive items.</p>
              ) : (
                driveFiles.map((f) => (
                  <div key={f.id} className="truncate py-1 border-b border-slate-800/70">
                    {f.name}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Google Sheets */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">Google Sheets</h2>
            </div>
            <p className="text-xs text-slate-400">
              Provision a dedicated administrative workbook to store simulation runs and telemetry rows.
            </p>
            <div className="text-xs font-mono text-slate-300 bg-[#0D131F] border border-slate-800 rounded px-2.5 py-1.5 truncate">
              Sheet ID: {spreadsheetId || 'Not linked yet'}
            </div>
            <button
              type="button"
              onClick={() =>
                confirmWrite(
                  'Create Google Sheets Report Workbook',
                  'Create a new spreadsheet titled "Helios C++ Studio Telemetry" in your Google Drive?',
                  'Create Spreadsheet',
                  async () => {
                    const created = await createReportSpreadsheet(
                      accessToken!,
                      'Helios C++ Studio Telemetry'
                    );
                    onSpreadsheetLinked(created.spreadsheetId);
                    setNotice(`Created Google Sheet (${created.spreadsheetId}). Go to Admin tab to sync rows.`);
                  }
                )
              }
              className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-medium text-emerald-200 cursor-pointer"
            >
              Create Telemetry Spreadsheet
            </button>
          </div>

          {/* 3. Google Docs & Slides */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">Docs & Slides</h2>
            </div>
            <p className="text-xs text-slate-400">
              Generate an engineering specification document or presentation deck for {activeCase.title}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  confirmWrite(
                    'Create Google Doc Brief',
                    `Generate a Google Doc containing equations and concept explanations for ${activeCase.title}?`,
                    'Create Doc',
                    async () => {
                      const body = `${activeCase.title}\n\n${activeCase.summary}\n\nGoverning Equation: ${activeCase.governingEquation}\n\n${activeCase.concepts
                        .map((c) => `${c.heading}: ${c.body}`)
                        .join('\n\n')}`;
                      const res = await createEngineeringDoc(
                        accessToken!,
                        `Helios Spec — ${activeCase.title}`,
                        body
                      );
                      setNotice(`Created Google Doc (ID: ${res.documentId}).`);
                    }
                  )
                }
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Create Doc</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmWrite(
                    'Create Google Slides Deck',
                    `Create a Google Slides presentation titled "Helios 3D Review — ${activeCase.title}"?`,
                    'Create Slides',
                    async () => {
                      const res = await createSimulationSlidesDeck(
                        accessToken!,
                        `Helios 3D Review — ${activeCase.title}`
                      );
                      setNotice(`Created Google Slides deck (ID: ${res.presentationId}).`);
                    }
                  )
                }
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Presentation className="w-3.5 h-3.5 text-amber-300" />
                <span>Create Slides</span>
              </button>
            </div>
          </div>

          {/* 4. Gmail */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">Gmail</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  runRead('gmail', async () => {
                    const msgs = await listGmailMessages(accessToken!);
                    setGmailList(msgs);
                    setNotice(`Fetched ${msgs.length} Gmail threads.`);
                  })
                }
                className="text-xs text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                {busyKey === 'gmail' ? 'Loading...' : 'Load Inbox'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={gmailRecipient}
                onChange={(e) => setGmailRecipient(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 rounded-lg bg-[#0D131F] border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!gmailRecipient.trim()) {
                    setErrMsg('Enter a valid recipient email address.');
                    return;
                  }
                  confirmWrite(
                    'Send Engineering Report via Gmail',
                    `Send simulation telemetry summary for ${activeCase.title} to ${gmailRecipient}?`,
                    'Send Email',
                    async () => {
                      await sendGmailSummary(
                        accessToken!,
                        gmailRecipient.trim(),
                        `Helios C++ Studio Report: ${activeCase.title}`,
                        `Simulation Report\nCase: ${activeCase.title}\n${telemetry.primaryMetricLabel}: ${telemetry.primaryMetricValue} ${telemetry.primaryMetricUnit}\nStability: ${telemetry.stabilityIndex}%`
                      );
                      setNotice(`Email sent to ${gmailRecipient}.`);
                    }
                  );
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer"
              >
                Send
              </button>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-slate-400">
              {gmailList.map((m) => (
                <div key={m.id} className="truncate border-b border-slate-800/70 py-1">
                  {m.snippet || m.id}
                </div>
              ))}
            </div>
          </div>

          {/* 5. Google Calendar */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">Google Calendar</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  runRead('calendar', async () => {
                    const evs = await listCalendarEvents(accessToken!);
                    setCalendarEvents(evs);
                    setNotice(`Loaded ${evs.length} upcoming calendar events.`);
                  })
                }
                className="text-xs text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                {busyKey === 'calendar' ? 'Loading...' : 'Load Events'}
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                confirmWrite(
                  'Schedule Engineering Review Event',
                  `Add a 30-minute design review for "${activeCase.title}" starting 1 hour from now on your primary calendar?`,
                  'Schedule Event',
                  async () => {
                    const ev = await createCalendarReviewEvent(
                      accessToken!,
                      `Helios 3D Design Review: ${activeCase.title}`,
                      `Reviewing ${activeCase.cppClassName} solver parameters and telemetry.`
                    );
                    setNotice(`Calendar event created (ID: ${ev.id}).`);
                  }
                )
              }
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
            >
              Schedule 30-Min Simulation Review
            </button>
            <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-slate-300">
              {calendarEvents.map((ev) => (
                <div key={ev.id} className="truncate py-1 border-b border-slate-800/70">
                  {ev.summary || 'Untitled Event'}
                </div>
              ))}
            </div>
          </div>

          {/* 6. Google Tasks */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-300" />
                <h2 className="font-display text-sm font-semibold text-slate-100">Google Tasks</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  runRead('tasks', async () => {
                    const items = await listTasks(accessToken!);
                    setTasksList(items);
                    setNotice(`Loaded ${items.length} Google Tasks.`);
                  })
                }
                className="text-xs text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                {busyKey === 'tasks' ? 'Loading...' : 'Load Tasks'}
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                confirmWrite(
                  'Create Google Task',
                  `Add an engineering action item for "${activeCase.title}" to your default Tasks list?`,
                  'Add Task',
                  async () => {
                    const t = await createTaskItem(
                      accessToken!,
                      `Validate ${activeCase.cppClassName} boundary conditions`,
                      `${telemetry.primaryMetricLabel}: ${telemetry.primaryMetricValue} ${telemetry.primaryMetricUnit}`
                    );
                    setNotice(`Created Task "${t.title}".`);
                  }
                )
              }
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
            >
              Add Solver Validation Task
            </button>
            <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-slate-300">
              {tasksList.map((t) => (
                <div key={t.id} className="truncate py-1 border-b border-slate-800/70">
                  {t.title}
                </div>
              ))}
            </div>
          </div>

          {/* 7. Google Forms */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FormInput className="w-4 h-4 text-violet-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">Google Forms</h2>
            </div>
            <p className="text-xs text-slate-400">
              Create a peer-review feedback form for {activeCase.title} simulation runs.
            </p>
            <button
              type="button"
              onClick={() =>
                confirmWrite(
                  'Create Google Form',
                  `Create a new Google Form titled "Helios Peer Review — ${activeCase.title}"?`,
                  'Create Form',
                  async () => {
                    const res = await createFeedbackForm(
                      accessToken!,
                      `Helios Peer Review — ${activeCase.title}`
                    );
                    setFormResult(res);
                    setNotice(`Created Google Form (${res.formId}).`);
                  }
                )
              }
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
            >
              Create Peer Review Form
            </button>
            {formResult && (
              <a
                href={formResult.responderUri}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-sky-300 hover:underline truncate"
              >
                Open Responder Form
              </a>
            )}
          </div>

          {/* 8. Google Meet */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">Google Meet</h2>
            </div>
            <p className="text-xs text-slate-400">
              Spin up an instant Google Meet room for collaborative 3D CAD and C++ code review.
            </p>
            <button
              type="button"
              onClick={() =>
                confirmWrite(
                  'Create Google Meet Space',
                  'Provision a new Google Meet conference space under your account?',
                  'Create Meet Room',
                  async () => {
                    const res = await createMeetSpace(accessToken!);
                    setMeetResult({ meetingUri: res.meetingUri, meetingCode: res.meetingCode });
                    setNotice(`Meet space ready: ${res.meetingCode}`);
                  }
                )
              }
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
            >
              Create Review Meet Space
            </button>
            {meetResult && (
              <a
                href={meetResult.meetingUri}
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-mono text-emerald-300 hover:underline truncate"
              >
                Join {meetResult.meetingCode} ({meetResult.meetingUri})
              </a>
            )}
          </div>

          {/* 9. Google Contacts & Enterprise Chat */}
          <div className="rounded-xl bg-[#111827] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">Contacts & Chat</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    runRead('contacts', async () => {
                      const items = await listContacts(accessToken!);
                      setContactsList(items);
                      setNotice(`Loaded ${items.length} contacts.`);
                    })
                  }
                  className="text-xs text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  Contacts
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runRead('chat', async () => {
                      const spaces = await listChatSpaces(accessToken!);
                      setChatSpaces(spaces);
                      setNotice(`Loaded ${spaces.length} Chat spaces.`);
                    })
                  }
                  className="text-xs text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Chat</span>
                </button>
              </div>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-slate-300">
              {contactsList.map((c, i) => (
                <div key={i} className="truncate py-1 border-b border-slate-800/70">
                  {c.name} {c.email ? `(${c.email})` : ''}
                </div>
              ))}
              {chatSpaces.map((s) => (
                <div key={s.name} className="truncate py-1 border-b border-slate-800/70 text-amber-200">
                  {s.displayName || s.name}
                </div>
              ))}
              {contactsList.length === 0 && chatSpaces.length === 0 && (
                <p className="text-slate-500">
                  Load team contacts or enterprise Workspace Chat spaces (Chat requires a managed Google Workspace domain).
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
