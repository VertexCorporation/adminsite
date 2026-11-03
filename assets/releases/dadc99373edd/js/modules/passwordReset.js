import { auth, consolePeopleCall } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';
import { __, userErrorMessage } from '../utils/ui.js';

export function initPasswordResetModule() {
    const form = document.getElementById('password-reset-form');
    if (!form) return;
    const input = document.getElementById('password-reset-emails');
    const button = document.getElementById('password-reset-submit');
    const status = document.getElementById('password-reset-status');
    const results = document.getElementById('password-reset-results');
    let busy = false, requestId = null;
    input.addEventListener('input', () => { requestId = null; results.replaceChildren(); status.textContent = ''; });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !isPanelAdmin() || !auth.currentUser) return;
        const emails = [...new Set(input.value.split(/[\s,;|]+/).filter(Boolean).map(v => v.toLowerCase()))];
        if (!emails.length || emails.length > 200 || emails.some(v => v.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v))) {
            status.textContent = __('resetAccount.invalid'); return;
        }
        requestId ||= crypto.randomUUID();
        busy = true; button.disabled = true; input.disabled = true;
        status.textContent = __('resetAccount.sending'); results.replaceChildren();
        try {
            const { data } = await consolePeopleCall('sendConsolePasswordResets', { emails: emails.join('\n'), requestId });
            status.textContent = __('resetAccount.complete').replace('{count}', String(data.accepted || 0));
            for (const row of data.rows || []) {
                const item = document.createElement('li');
                item.textContent = row.email + ' — ' + __('resetAccount.' + (['sent','uncertain','failed','disabled','not-found','preparing','sending'].includes(row.status) ? row.status : 'uncertain'));
                results.append(item);
            }
        } catch (error) { status.textContent = userErrorMessage(error); }
        finally { busy = false; button.disabled = false; input.disabled = false; }
    });
}
