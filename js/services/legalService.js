import { consolePeopleCall } from '../core/firebase.js';
import { captureSession, sessionIsCurrent, canReadArea } from '../core/session.js';
export async function legalCall(action, data = {}, token = captureSession()) {
  const assert = () => {
    if (!sessionIsCurrent(token) || !canReadArea('legal.documents'))
      throw Object.assign(new Error('LEGAL_ACCESS_CHANGED'), { code: 'functions/permission-denied' });
  };
  assert();
  const result = await consolePeopleCall('manageLegalDocuments', { ...data, action });
  assert();
  return result.data;
}
