import { setVertexContributorJoiningDateFn, issueVertexCertificateFn, getVertexCertificateDetailsFn, revokeVertexCertificateFn } from '../core/firebase.js';
import { escapeHTML as esc, showToast } from '../utils/ui.js';

const awards = [{type:'tenacity',months:1},{type:'constancy',months:3},{type:'majesty',months:6},{type:'nobility',months:12}];

export async function openCertificates(person, refresh) {
    document.getElementById('certificate-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'certificate-dialog';
    dialog.className = 'certificate-dialog';
    dialog.setAttribute('aria-labelledby', 'certificate-heading');
    dialog.innerHTML = `<header><div><p class="eyebrow">VERTEX / CERTIFICATES</p><h2 id="certificate-heading">${esc(person.name)}</h2></div><button type="button" data-close aria-label="Close">×</button></header><div class="certificate-body" aria-live="polite">Loading certificate history…</div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    const body = dialog.querySelector('.certificate-body');
    async function load() {
        try {
            const {data} = await getVertexCertificateDetailsFn({contributorId:person.id});
            if (!dialog.isConnected) return;
            const {types, eligibility, history} = data;
            body.innerHTML = `<dl class="certificate-facts"><div><dt>Recipient</dt><dd>${esc(person.email)}</dd></div><div><dt>Language</dt><dd>${esc(person.language || 'en')}</dd></div><div><dt>Joining date</dt><dd>${eligibility.joinedAt ? esc(new Date(eligibility.joinedAt).toLocaleDateString()) : 'Not recorded'}</dd></div><div><dt>Participation</dt><dd>${eligibility.participationDays === undefined ? 'Unknown' : esc(eligibility.participationDays) + ' days'}</dd></div></dl>
            <form id="joining-date-form" class="form-stack"><label for="joined-at">Actual admission date</label><input type="date" id="joined-at" max="${new Date().toISOString().slice(0,10)}" value="${eligibility.joinedAt ? esc(eligibility.joinedAt.slice(0,10)) : ''}"><p class="form-hint">Enter the actual date of admission to Vertex. Leave blank if unknown. Application and interview dates are not admission dates.</p><button type="submit" class="chrome-btn-outline">Save admission date</button></form>
            <p class="certificate-notice">${eligibility.status === 'configured' ? 'Eligible categories: ' + (eligibility.eligibleTypes.join(', ') || 'None yet') : 'Automatic eligibility awaits an approved joining-date source and tenure policy. An administrator can select a category explicitly.'}</p>
            <div class="certificate-awards" aria-label="Certificate awards">${awards.map(({type,months}) => `<button type="button" class="chrome-btn-outline" data-award="${type}"><strong>${esc(types[type].tr)} / ${esc(types[type].en)}</strong><span>${months} ay / ${months} month${months === 1 ? '' : 's'}</span></button>`).join('')}</div><p class="form-hint">Liyakat is issued through approval and is not offered here. Select an award to review its recipient and confirm delivery.</p>
            <h3>Issuance history</h3><div class="certificate-history">${history.length ? history.map(job => `<article><div><strong>${esc(types[job.certificateType]?.en || job.certificateType)}</strong><span class="status-badge">${esc(job.status)}</span></div><a href="https://vertexishere.com/verify/${encodeURIComponent(job.id)}" target="_blank" rel="noopener">Verification record ↗</a>${job.status === 'uncertain' ? '<p>Delivery may have occurred. Reconcile this attempt before resending.</p>' : ''}${job.status === 'failed' && !job.retrySafe ? '<p>Retry blocked: delivery was not confirmed absent.</p>' : ''}<details><summary>Attempt history</summary>${(job.attempts || []).map(a => `<p>${esc(a.id)} · ${esc(a.status)}</p>`).join('') || '<p>Legacy certificate: no recorded attempts.</p>'}</details><div class="certificate-actions">${job.status === 'failed' && job.retrySafe ? `<button data-retry="${esc(job.certificateType)}">Retry failed attempt</button>` : ''}${job.status !== 'revoked' ? `<button data-revoke="${esc(job.id)}">Revoke certificate</button>` : ''}</div></article>`).join('') : '<p>No tracked issuances. Previously issued Merit certificates remain compatible.</p>'}</div>`;
            body.querySelector('#joining-date-form').onsubmit = async event => {
                event.preventDefault();
                const joinedAt = body.querySelector('#joined-at').value || null;
                await act(() => setVertexContributorJoiningDateFn({contributorId:person.id, joinedAt}));
            };
            body.querySelectorAll('[data-award]').forEach(button => button.onclick = async () => {
                const type = button.dataset.award;
                if (!confirm(`Issue ${types[type].tr} / ${types[type].en} to ${person.name} (${person.email})? This requests certificate delivery.`)) return;
                await act(() => issueVertexCertificateFn({contributorId:person.id,certificateType:type}));
            });
            body.querySelectorAll('[data-retry]').forEach(button => button.onclick = async () => {
                if (confirm('Retry the attempt confirmed as not delivered?')) await act(() => issueVertexCertificateFn({contributorId:person.id,certificateType:button.dataset.retry,retry:true}));
            });
            body.querySelectorAll('[data-revoke]').forEach(button => button.onclick = async () => {
                if (confirm('Revoke this certificate? Its verification link will become invalid. An email already in progress cannot be recalled.')) await act(() => revokeVertexCertificateFn({id:button.dataset.revoke}));
            });
        } catch (error) {
            body.textContent = `Could not load certificates: ${error.message}`;
            const retry = document.createElement('button'); retry.textContent = 'Try again'; retry.onclick = load; body.append(retry);
        }
    }
    async function act(operation) {
        body.querySelectorAll('button,select,input').forEach(el => el.disabled = true);
        try {
            const result = await operation();
            showToast(result.data.status ? `Issuance: ${result.data.status}` : 'Certificate updated.', 'info');
            await refresh();
        } catch (error) { showToast(error.message, 'error'); }
        finally { await load(); }
    }
    await load();
}
