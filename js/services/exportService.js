import { contributorsStore, articlesStore, modelsStore, manualModelsStore } from '../stores/areaStore.js';
import { canReadArea } from '../core/session.js';
const sources = {
  contributors: ['contributors.list', contributorsStore],
  articles: ['news.published', articlesStore],
  allModels: ['models.library', modelsStore],
  manualModels: ['models.manage', manualModelsStore],
};
export function getExportData(kind) {
  const source = sources[kind];
  if (!source || !canReadArea('system.exporter') || !canReadArea(source[0]))
    throw Object.assign(new Error('EXPORT_ACCESS_DENIED'), { code: 'functions/permission-denied' });
  return structuredClone(source[1].value);
}
