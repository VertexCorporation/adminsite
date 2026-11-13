import { consolePeopleCall } from '../core/firebase.js';
import { captureSession, sessionIsCurrent, canReadArea, onSessionReset } from '../core/session.js';
import { createLegalReadCache } from './legalReadCache.js';
const cache = createLegalReadCache();
const keyFor = (action, data, token) => JSON.stringify([token.uid, token.epoch, action, data]);
export const clearLegalCache = () => cache.clear();
onSessionReset(clearLegalCache);
export function peekLegalDocument(id, token = captureSession()) {
  if (!sessionIsCurrent(token) || !canReadArea('legal.documents')) return null;
  return cache.get(keyFor('get', { id }, token));
}
export async function legalCall(action, data = {}, token = captureSession()) {
  const assert = () => {
    if (!sessionIsCurrent(token) || !canReadArea('legal.documents'))
      throw Object.assign(new Error('LEGAL_ACCESS_CHANGED'), { code: 'functions/permission-denied' });
  };
  assert();
  const mutation = ['save', 'publish', 'restore'].includes(action) || (action === 'translate' && data.persist === true);
  if (mutation) cache.clear();
  const fetch = async () => {
    const result = await consolePeopleCall(action === 'translate' ? 'translateLegalDocument' : 'manageLegalDocuments', {
      ...data,
      ...(action === 'translate' ? {} : { action }),
    });
    assert();
    return result.data;
  };
  try {
    const result =
      ['get', 'history'].includes(action) || (action === 'translate' && data.persist === false)
        ? await cache.load(keyFor(action, data, token), fetch)
        : await fetch();
    assert();
    if (action === 'catalog' && result.selected)
      cache.set(keyFor('get', { id: result.selected.id }, token), result.selected);
    return result;
  } finally {
    if (mutation) cache.clear();
  }
}
