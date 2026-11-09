import { consolePeopleCall } from '../core/firebase.js';
import { canReadArea, captureSession, sessionIsCurrent } from '../core/session.js';
function assertAccess(token) {
  if (!sessionIsCurrent(token) || !canReadArea('reports.workspace'))
    throw Object.assign(new Error('REPORT_ACCESS_CHANGED'), { code: 'functions/permission-denied' });
}
async function call(name, data, token) {
  assertAccess(token);
  const response = await consolePeopleCall(name, data);
  assertAccess(token);
  return response.data;
}
export async function getReportWeek(department, weekStart, token = captureSession(), backup = false) {
  let result,
    cursors = {};
  const members = new Map(),
    entries = new Map(),
    tasks = new Map(),
    openTasks = new Map();
  do {
    const data = await call('getReportWorkspace', { department, weekStart, cursors, backup }, token);
    if (
      data.schemaVersion !== 2 ||
      (backup && data.backup !== true) ||
      data.department !== department ||
      !Array.isArray(data.entries) ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.members)
    )
      throw new Error('REPORT_INVALID_RESPONSE');
    result = data;
    for (const [rows, target] of [
      [data.members, members],
      [data.entries, entries],
      [data.tasks, tasks],
      [data.openTasks || [], openTasks],
    ])
      for (const row of rows) target.set(row.id, row);
    cursors = Object.fromEntries(Object.entries(data.cursors || {}).map(([key, value]) => [key, value || false]));
  } while (Object.values(cursors).some(Boolean));
  return {
    ...result,
    members: [...members.values()],
    entries: [...entries.values()],
    tasks: [...tasks.values()],
    openTasks: [...openTasks.values()],
  };
}
export const saveReportEntry = (data, token) => call('saveReportEntry', data, token);
export const saveReportTask = (data, token) => call('saveReportTask', data, token);
export const deleteReportItem = (data, token) => call('deleteReportItem', data, token);
export const requestReportTask = (data, token) => call('requestReportTask', data, token);

export const getReportBackup = (department, token) => getReportWeek(department, undefined, token, true);
