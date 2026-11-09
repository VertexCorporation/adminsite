import { isPanelAdmin, getEffectivePanelLevel } from '../roles.js';

export function canEditModels(panel) {
  return isPanelAdmin() || getEffectivePanelLevel(panel) === 'write';
}
