import { createAreaStore } from './areaStore.js';
import { captureSession, sessionIsCurrent, onSessionReset } from '../core/session.js';
import { getReportWeek } from '../services/reportsService.js';
export const reportsStore = createAreaStore('reports.workspace');
let request = 0;
onSessionReset(() => request++);
export async function loadReportWeek(department, weekStart, view = 'overview') {
  const token = captureSession(),
    version = ++request;
  reportsStore.set({ department, weekStart, view, loading: true, data: null, error: null }, token);
  try {
    const data = await getReportWeek(department, weekStart, token);
    if (version === request && sessionIsCurrent(token))
      reportsStore.set(
        {
          department,
          weekStart: data.weekStart,
          view: reportsStore.value?.view || view,
          loading: false,
          data,
          error: null,
        },
        token,
      );
  } catch (error) {
    if (version === request && sessionIsCurrent(token))
      reportsStore.set({ department, weekStart, view, loading: false, data: null, error }, token);
  }
}
export function selectReportView(view) {
  const state = reportsStore.value;
  if (state) reportsStore.value = { ...state, view };
}
