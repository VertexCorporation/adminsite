let identity = () => null;
let accessLevel = () => 'none';
let current = { uid: null, signature: '', epoch: 0 };
const observers = new Set();
export function configureSession({ getUid, getLevel }) {
  identity = getUid;
  accessLevel = getLevel;
}
export function updateSession({ uid, isCore, departments = [], permissionsRevision = 0 }) {
  const signature = JSON.stringify([uid, isCore, [...departments].sort(), permissionsRevision]);
  if (signature === current.signature) return;
  current = { uid, signature, epoch: current.epoch + 1 };
  for (const reset of observers) reset();
}
export function captureSession() {
  return { uid: current.uid, epoch: current.epoch };
}
export function sessionIsCurrent(token) {
  return !!token?.uid && token.uid === identity() && token.uid === current.uid && token.epoch === current.epoch;
}
export function canReadArea(scope) {
  return sessionIsCurrent(current) && accessLevel(scope) !== 'none';
}
export function onSessionReset(reset) {
  observers.add(reset);
  return () => observers.delete(reset);
}
