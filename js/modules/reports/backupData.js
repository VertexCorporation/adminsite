import { reportDepartment, validDay } from './domain.js';
const fail = (code = 'backupInvalid') => {
  throw Object.assign(new Error(code), { backupCode: code });
};
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const text = (value, limit, required = false) => {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) fail();
  return value.trim();
};
const link = (value) => {
  const result = text(value, 800);
  if (result) {
    let url;
    try {
      url = new URL(result);
    } catch {
      fail();
    }
    if (!['http:', 'https:'].includes(url.protocol)) fail();
  }
  return result;
};
const day = (value, optional = false) => {
  if (optional && !value) return '';
  if (!validDay(value)) fail();
  return value;
};
async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value).normalize('NFC')));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function createBackup(data) {
  return {
    app: 'vertex-console-reports',
    version: 2,
    department: data.department,
    exportedAt: new Date().toISOString(),
    members: data.members.map(({ id, name }) => ({ id, name })),
    entries: data.entries
      .filter((row) => !row.deleted)
      .map(({ memberId, date, status, project, summary, next, link, source }) => ({
        memberId,
        date,
        status,
        project,
        summary,
        next,
        link,
        source,
      })),
    tasks: data.tasks
      .filter((row) => !row.deleted)
      .map(
        ({
          id,
          title,
          project,
          description,
          priority,
          status,
          assignees,
          ref,
          source,
          due,
          createdDate,
          completedDate,
        }) => ({
          id,
          title,
          project,
          description,
          priority,
          status,
          assignees,
          ref,
          source,
          due,
          createdDate,
          completedDate,
        }),
      ),
  };
}
export async function planRestore(raw, current) {
  if (!raw || typeof raw !== 'object') fail();
  if (!raw.department || reportDepartment(raw.department) !== current.department) fail('backupDepartment');
  const legacy = raw.version === 5 && Array.isArray(raw.records) && Array.isArray(raw.team);
  if (!legacy && (raw.app !== 'vertex-console-reports' || raw.version !== 2)) fail();
  const rows = legacy ? raw.records : raw.entries;
  if (!Array.isArray(rows) || !Array.isArray(raw.tasks) || rows.length > 10000 || raw.tasks.length > 5000) fail();
  const members = new Map(current.members.map((member) => [member.id, member]));
  function memberId(value) {
    if (!legacy) {
      if (!id(value) || !members.has(value)) fail('backupMember');
      return value;
    }
    const matches = current.members.filter((member) => member.name === value);
    if (matches.length !== 1) fail('backupMember');
    return matches[0].id;
  }
  const existingEntries = new Map(current.entries.map((entry) => [entry.memberId + '|' + entry.date, entry]));
  const existingTasks = new Map(current.tasks.map((task) => [task.id, task]));
  const seen = new Set(),
    operations = [];
  const statuses = {
    'Çalışma bildirildi': 'done',
    'Plan/öğrenme': 'plan',
    'Plan / öğrenme': 'plan',
    'Çalışma yapmadı': 'off',
    'Aktif değildi (rapor yok)': 'noreport',
    'Rapor yok': 'noreport',
  };
  for (const row of rows) {
    if (!row || typeof row !== 'object') fail();
    const entry = {
      memberId: memberId(legacy ? row.person : row.memberId),
      date: day(row.date),
      status: legacy ? statuses[row.status] || row.status : row.status,
      project: text(row.project, 180),
      summary: text(row.summary, 6000, true),
      next: text(row.next, 3000),
      link: link(row.link),
      source: text(row.source, 500),
    };
    if (!['done', 'plan', 'off', 'noreport'].includes(entry.status)) fail();
    const key = entry.memberId + '|' + entry.date;
    if (seen.has(key)) fail();
    seen.add(key);
    operations.push({ kind: 'entries', input: entry, expectedRevision: existingEntries.get(key)?.revision || 0 });
  }
  seen.clear();
  for (const row of raw.tasks) {
    if (!row || !id(row.id) || !Array.isArray(row.assignees) || row.assignees.length > 32) fail();
    const task = {
      id: legacy ? await hash(row.id) : row.id,
      title: text(row.title, 180, true),
      project: text(row.project, 180, true),
      description: text(row.description, 3500),
      priority: row.priority,
      status: row.status,
      assignees: [...new Set(row.assignees.map(memberId))],
      ref: link(row.ref),
      source: text(row.source, 500),
      due: day(row.due, true),
      createdDate: day(legacy ? row.created : row.createdDate),
      completedDate: row.status === 'done' ? day(legacy ? row.updated : row.completedDate) : null,
    };
    if (
      !['todo', 'doing', 'done'].includes(task.status) ||
      !['urgent', 'normal', 'low'].includes(task.priority) ||
      seen.has(task.id)
    )
      fail();
    seen.add(task.id);
    operations.push({ kind: 'tasks', input: task, expectedRevision: existingTasks.get(task.id)?.revision || 0 });
  }
  if (!operations.length) fail();
  return operations;
}
