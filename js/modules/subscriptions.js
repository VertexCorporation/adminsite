// js/modules/subscriptions.js

import { showToast, __, onLangChange, sanitizeHTML } from '../utils/ui.js';
import * as dom from '../utils/dom.js';
import { removeUserSubscriptionFn, listUserSubscriptionsFn } from '../core/firebase.js';
import { grantPremium, grantPremiumBulk } from './admin.js';
import { getEffectivePanelLevel } from './roles.js';

// Abonelik kataloğu — yeni seviye eklemek için buraya bir satır ekleyin;
// form listesi ve rozetler otomatik güncellenir. `level` değerleri sunucu
// tarafındaki subscriptionLevel claim'i ile aynı katalogdur.
const PLANS = [
    { id: 'plus', level: 1, labelKey: 'subs.plan_plus' },
    { id: 'pro', level: 2, labelKey: 'subs.plan_pro' },
    { id: 'ultra', level: 3, labelKey: 'subs.plan_ultra' }
];

// Güvenlik sınırı: panelden en fazla 1 yıllık abonelik verilebilir.
// Sunucu da aynı sınırı kendi saatiyle zorlar; küçük tolerans gecikme
// kaynaklı yanlış reddi önler.
const MAX_DURATION_TOLERANCE_MS = 60 * 1000;

let subscriptions = [];

function getPlan(id) {
    return PLANS.find(plan => plan.id === id) || { id, labelKey: 'subs.plan_label' };
}

function toDatetimeLocalValue(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function maxExpiryFrom(now) {
    const max = new Date(now);
    max.setFullYear(max.getFullYear() + 1);
    return max;
}

function resetDefaultDates() {
    const now = new Date();
    const expiryInput = document.getElementById('sub-end');
    expiryInput.value = toDatetimeLocalValue(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
    expiryInput.min = toDatetimeLocalValue(now);
    expiryInput.max = toDatetimeLocalValue(maxExpiryFrom(now));
}

function populatePlanOptions() {
    const select = document.getElementById('sub-plan');
    const selected = select.value;
    select.replaceChildren();
    PLANS.forEach(plan => {
        const option = document.createElement('option');
        option.value = plan.id;
        option.textContent = __(plan.labelKey);
        select.append(option);
    });
    if (PLANS.some(plan => plan.id === selected)) select.value = selected;
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function renderSubscriptions() {
    const container = dom.subscriptionsList;
    const query = document.getElementById('subscriptions-search').value.trim().toLocaleLowerCase();
    const planLabel = id => __(getPlan(id).labelKey);
    const filtered = subscriptions.filter(sub =>
        [sub.displayName, sub.email, planLabel(sub.tier)]
            .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
    if (!filtered.length) {
        container.innerHTML = `<p class="form-hint dept-list-message">${query ? __('subs.no_match') : __('subs.empty')}</p>`;
        return;
    }
    const now = Date.now();
    container.innerHTML = filtered.map(sub => {
        const status = now >= (sub.expiresAt ? new Date(sub.expiresAt).getTime() : Infinity)
            ? { badge: 'expired', key: 'subs.badge_expired' }
            : { badge: 'active', key: 'subs.badge_active' };
        return `
        <div class="dept-user-row">
            <div class="dept-user-main">
                <strong>${sanitizeHTML(sub.displayName || sub.email)}</strong>
                ${sub.displayName ? `<span>${sanitizeHTML(sub.email)}</span>` : ''}
                <div class="dept-badges">
                    <span class="dept-badge sub-tier-badge">${sanitizeHTML(planLabel(sub.tier))}</span>
                    <span class="dept-badge sub-status-${status.badge}">${__(status.key)}</span>
                </div>
                <span class="sub-dates">${__('subs.end_label_short')}: ${formatDate(sub.expiresAt)}</span>
            </div>
            ${getEffectivePanelLevel('subscriptions.list') === 'write' ? `<button type="button" class="dept-user-edit cancel-task-btn" data-uid="${sanitizeHTML(sub.uid)}">${__('subs.remove_btn')}</button>` : ''}
        </div>`;
    }).join('');
}

async function loadSubscriptions() {
    const container = dom.subscriptionsList;
    const button = document.getElementById('refresh-subscriptions-btn');
    container.innerHTML = `<p class="form-hint dept-list-message">${__('subs.list_loading')}</p>`;
    button.disabled = true;
    try {
        const result = await listUserSubscriptionsFn();
        subscriptions = (result.data.subscriptions || []).map(sub => ({
            uid: String(sub.uid || ''),
            email: String(sub.email || ''),
            displayName: String(sub.displayName || ''),
            tier: String(sub.tier || ''),
            expiresAt: sub.expiresAt || null
        })).filter(sub => sub.uid);
        subscriptions.sort((a, b) => new Date(b.expiresAt || 0) - new Date(a.expiresAt || 0));
        renderSubscriptions();
    } catch (error) {
        console.error('[CLIENT] Error loading subscriptions:', error);
        container.innerHTML = `<p class="form-hint dept-list-message">${__('subs.load_error')}</p>`;
    } finally {
        button.disabled = false;
    }
}

async function handleAssignSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('sub-user-email').value.trim();
    const displayName = document.getElementById('sub-username').value.trim();
    const tier = document.getElementById('sub-plan').value;
    const expiresAt = new Date(document.getElementById('sub-end').value);
    const now = new Date();

    if (!email || !tier || isNaN(expiresAt)) return;
    if (expiresAt <= now) {
        showToast(__('subs.expires_past'), 'error');
        return;
    }
    if (expiresAt.getTime() - maxExpiryFrom(now).getTime() > MAX_DURATION_TOLERANCE_MS) {
        showToast(__('subs.max_one_year'), 'error');
        return;
    }

    const btn = document.getElementById('assign-subscription-btn');
    btn.disabled = true;
    btn.innerHTML = `<span>${__('subs.assigning')}</span>`;

    try {
        const data = await grantPremium({ email, displayName, tier, expiresAt: expiresAt.toISOString() });
        showToast(data.message || __('subs.assign_success'), 'success');
        dom.subscriptionForm.reset();
        resetDefaultDates();
        await loadSubscriptions();
    } catch (error) {
        console.error('[CLIENT] Error assigning subscription:', error);
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-rounded">workspace_premium</span><span>${__('subs.assign_btn')}</span>`;
    }
}

async function handleRemoveSubscription(uid, button) {
    if (!confirm(__('subs.remove_confirm'))) return;
    button.disabled = true;
    button.textContent = __('subs.removing');
    try {
        const result = await removeUserSubscriptionFn({ uid });
        showToast(result.data.message || __('subs.remove_success'), 'success');
        await loadSubscriptions();
    } catch (error) {
        console.error('[CLIENT] Error removing subscription:', error);
        showToast(`${__('system.error')}: ${error.message}`, 'error');
        button.disabled = false;
        button.textContent = __('subs.remove_btn');
    }
}

// --- Toplu Tanımlama (ham girdi sunucuda ayrıştırılır) ---

function toggleBulkPanel() {
    const panel = document.getElementById('sub-bulk-panel');
    const toggle = document.getElementById('sub-bulk-toggle');
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'flex';
    toggle.classList.toggle('sub-bulk-open', !open);
    toggle.setAttribute('aria-expanded', String(!open));
}

function renderBulkResult(data) {
    const container = document.getElementById('sub-bulk-result');
    container.style.display = 'block';
    let html = `<p class="form-hint" style="padding: 8px 4px;">
        <strong style="color: var(--accent-sage);">${data.grantedCount}</strong> ${__('subs.bulk_granted')}
        · <strong style="color: var(--accent-clay);">${data.failedCount}</strong> ${__('subs.bulk_failed')}
    </p>`;
    if (data.failed?.length) {
        html += `<span class="sub-granted" style="padding: 0 4px;">${__('subs.bulk_failed_title')}:</span>`;
        html += data.failed.map(item => `
            <div class="dept-user-row">
                <div class="dept-user-main">
                    <strong>${sanitizeHTML(item.email)}</strong>
                    <span>${sanitizeHTML(item.reason)}</span>
                </div>
            </div>`).join('');
    }
    if (data.invalidTokens?.length) {
        html += `<span class="sub-granted" style="padding: 0 4px; display:block; margin-top:6px;">${__('subs.bulk_invalid_title')}:</span>
            <span class="sub-dates" style="padding: 0 4px;">${sanitizeHTML(data.invalidTokens.join(', '))}</span>`;
    }
    container.innerHTML = html;
}

async function handleBulkSubmit() {
    const raw = document.getElementById('sub-bulk-input').value;
    const tier = document.getElementById('sub-plan').value;
    const expiresAt = new Date(document.getElementById('sub-end').value);
    const now = new Date();

    if (!raw.trim()) return;
    if (isNaN(expiresAt.getTime()) || expiresAt <= now) {
        showToast(__('subs.expires_past'), 'error');
        return;
    }
    if (expiresAt.getTime() - maxExpiryFrom(now).getTime() > MAX_DURATION_TOLERANCE_MS) {
        showToast(__('subs.max_one_year'), 'error');
        return;
    }

    const btn = document.getElementById('sub-bulk-submit');
    btn.disabled = true;
    btn.innerHTML = `<span>${__('subs.bulk_running')}</span>`;
    showToast(__('subs.bulk_started'), 'info');

    try {
        const data = await grantPremiumBulk({ raw, tier, expiresAt: expiresAt.toISOString() });
        renderBulkResult(data);
        showToast(`${data.grantedCount} ${__('subs.bulk_granted')} · ${data.failedCount} ${__('subs.bulk_failed')}`,
            data.failedCount ? 'info' : 'success');
        await loadSubscriptions();
    } catch (error) {
        console.error('[CLIENT] Error bulk assigning subscriptions:', error);
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-rounded">playlist_add</span><span>${__('subs.bulk_btn')}</span>`;
    }
}

export function initSubscriptionsModule() {
    populatePlanOptions();
    resetDefaultDates();
    onLangChange(() => {
        populatePlanOptions();
        if (subscriptions.length) renderSubscriptions();
    });
    dom.subscriptionForm.addEventListener('submit', handleAssignSubmit);
    document.getElementById('refresh-subscriptions-btn').addEventListener('click', loadSubscriptions);
    document.getElementById('subscriptions-search').addEventListener('input', renderSubscriptions);
    dom.subscriptionsList.addEventListener('click', event => {
        const button = event.target.closest('button[data-uid]');
        if (!button) return;
        handleRemoveSubscription(button.dataset.uid, button);
    });
    document.getElementById('sub-bulk-toggle').addEventListener('click', toggleBulkPanel);
    document.getElementById('sub-bulk-submit').addEventListener('click', handleBulkSubmit);
}

export function refreshSubscriptions() {
    return loadSubscriptions();
}
