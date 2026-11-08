import { canReadArea, captureSession, onSessionReset, sessionIsCurrent } from '../core/session.js';
export function createAreaStore(scope, initial = null) {
  let data = initial;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  onSessionReset(() => {
    data = initial;
    notify();
  });
  return {
    get value() {
      return canReadArea(scope) ? data : initial;
    },
    set value(value) {
      if (canReadArea(scope)) {
        data = value;
        notify();
      }
    },
    set(value, token = captureSession()) {
      if (!canReadArea(scope) || !sessionIsCurrent(token)) return false;
      data = value;
      notify();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      data = initial;
      notify();
    },
  };
}
export const contributorsStore = createAreaStore('contributors.list');
export const articlesStore = createAreaStore('news.published', []);
export const modelsStore = createAreaStore('models.library');
export const manualModelsStore = createAreaStore('models.manage', []);
export const subscriptionsStore = createAreaStore('subscriptions.list', []);
