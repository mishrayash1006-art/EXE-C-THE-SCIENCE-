import { AdminReportRow } from '../types/studio';

async function gFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `Google API error (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

// 1. GOOGLE SHEETS — Real-Time Admin Report Storage
export async function createReportSpreadsheet(accessToken: string, title: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const created = await gFetch<{ spreadsheetId: string; spreadsheetUrl: string }>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: 'SimulationReports' } }],
      }),
    }
  );

  // Write header row
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values/SimulationReports!A1:I1?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[
          'Timestamp',
          'User Email',
          'Case ID',
          'Case Title',
          'Primary Output',
          'Energy (J)',
          'Stability (%)',
          'Solver Latency (us)',
          'Backup Checksum',
        ]],
      }),
    }
  );
  return created;
}

export async function appendReportRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  row: AdminReportRow
): Promise<void> {
  const safeId = encodeURIComponent(spreadsheetId.trim());
  await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/SimulationReports!A:I:append?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[
          row.timestamp,
          row.userEmail,
          row.caseId,
          row.caseTitle,
          row.primaryValue,
          row.energyJ,
          row.stability,
          row.solverUs,
          row.backupChecksum,
        ]],
      }),
    }
  );
}

export async function readReportRowsFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<AdminReportRow[]> {
  const safeId = encodeURIComponent(spreadsheetId.trim());
  const data = await gFetch<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/SimulationReports!A2:I100`,
    accessToken
  );
  return (data.values || []).map((cols) => ({
    timestamp: cols[0] ?? '',
    userEmail: cols[1] ?? '',
    caseId: cols[2] ?? '',
    caseTitle: cols[3] ?? '',
    primaryValue: cols[4] ?? '',
    energyJ: cols[5] ?? '',
    stability: cols[6] ?? '',
    solverUs: cols[7] ?? '',
    backupChecksum: cols[8] ?? '',
  }));
}

// 2. GOOGLE DRIVE — List & Upload Project Files
export async function listDriveFiles(accessToken: string): Promise<{ id: string; name: string; mimeType: string; modifiedTime?: string }[]> {
  const data = await gFetch<{ files?: { id: string; name: string; mimeType: string; modifiedTime?: string }[] }>(
    'https://www.googleapis.com/drive/v3/files?pageSize=12&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime%20desc',
    accessToken
  );
  return data.files || [];
}

export async function uploadTextFileToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType = 'text/plain'
): Promise<{ id: string; name: string }> {
  const boundary = 'helios_multipart_boundary';
  const metadata = JSON.stringify({ name: fileName, mimeType });
  const multipartBody =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Drive upload failed');
  return data;
}

// 3. GOOGLE DOCS — Export Engineering Concept Brief
export async function createEngineeringDoc(
  accessToken: string,
  title: string,
  bodyText: string
): Promise<{ documentId: string }> {
  const doc = await gFetch<{ documentId: string }>(
    'https://docs.googleapis.com/v1/documents',
    accessToken,
    { method: 'POST', body: JSON.stringify({ title }) }
  );
  await gFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(doc.documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: bodyText } }],
      }),
    }
  );
  return doc;
}

// 4. GOOGLE SLIDES — Create Simulation Presentation Deck
export async function createSimulationSlidesDeck(
  accessToken: string,
  title: string
): Promise<{ presentationId: string }> {
  return gFetch<{ presentationId: string }>(
    'https://slides.googleapis.com/v1/presentations',
    accessToken,
    { method: 'POST', body: JSON.stringify({ title }) }
  );
}

// 5. GMAIL — List & Send Report Summary
export async function listGmailMessages(accessToken: string): Promise<{ id: string; snippet?: string }[]> {
  const list = await gFetch<{ messages?: { id: string }[] }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=6',
    accessToken
  );
  const items = list.messages || [];
  const details = await Promise.all(
    items.slice(0, 5).map((m) =>
      gFetch<{ id: string; snippet?: string }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=minimal`,
        accessToken
      ).catch(() => ({ id: m.id, snippet: '' }))
    )
  );
  return details;
}

export async function sendGmailSummary(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string }> {
  const mime = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return gFetch<{ id: string }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    accessToken,
    { method: 'POST', body: JSON.stringify({ raw }) }
  );
}

// 6. GOOGLE CALENDAR — List & Schedule Review
export async function listCalendarEvents(accessToken: string): Promise<{ id: string; summary?: string; start?: { dateTime?: string; date?: string } }[]> {
  const timeMin = encodeURIComponent(new Date().toISOString());
  const data = await gFetch<{ items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string } }[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=6&singleEvents=true&orderBy=startTime&timeMin=${timeMin}`,
    accessToken
  );
  return data.items || [];
}

export async function createCalendarReviewEvent(
  accessToken: string,
  summary: string,
  description: string
): Promise<{ id: string; htmlLink?: string }> {
  const start = new Date(Date.now() + 3600 * 1000);
  const end = new Date(start.getTime() + 1800 * 1000);
  return gFetch<{ id: string; htmlLink?: string }>(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    }
  );
}

// 7. GOOGLE TASKS — List & Add Tasks
export async function listTasks(accessToken: string): Promise<{ id: string; title: string; status: string }[]> {
  const data = await gFetch<{ items?: { id: string; title: string; status: string }[] }>(
    'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=10',
    accessToken
  );
  return data.items || [];
}

export async function createTaskItem(accessToken: string, title: string, notes: string): Promise<{ id: string; title: string }> {
  return gFetch<{ id: string; title: string }>(
    'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks',
    accessToken,
    { method: 'POST', body: JSON.stringify({ title, notes }) }
  );
}

// 8. GOOGLE FORMS — Create Simulation Feedback Form
export async function createFeedbackForm(accessToken: string, title: string): Promise<{ formId: string; responderUri: string }> {
  return gFetch<{ formId: string; responderUri: string }>(
    'https://forms.googleapis.com/v1/forms',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        info: { title, documentTitle: title },
      }),
    }
  );
}

// 9. GOOGLE MEET — Create Live Engineering Review Space
export async function createMeetSpace(accessToken: string): Promise<{ name: string; meetingUri: string; meetingCode: string }> {
  return gFetch<{ name: string; meetingUri: string; meetingCode: string }>(
    'https://meet.googleapis.com/v2/spaces',
    accessToken,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

// 10. GOOGLE CONTACTS (PEOPLE API) — List Team Connections
export async function listContacts(accessToken: string): Promise<{ name: string; email: string }[]> {
  const data = await gFetch<{
    connections?: {
      names?: { displayName?: string }[];
      emailAddresses?: { value?: string }[];
    }[];
  }>(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=10',
    accessToken
  );
  return (data.connections || []).map((c) => ({
    name: c.names?.[0]?.displayName || 'Unnamed Contact',
    email: c.emailAddresses?.[0]?.value || '',
  }));
}

// 11. GOOGLE CHAT — List Spaces (Requires Business/Enterprise Workspace & configured Chat app)
export async function listChatSpaces(accessToken: string): Promise<{ name: string; displayName?: string }[]> {
  const data = await gFetch<{ spaces?: { name: string; displayName?: string }[] }>(
    'https://chat.googleapis.com/v1/spaces',
    accessToken
  );
  return data.spaces || [];
}
