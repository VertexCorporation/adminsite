// js/modules/siteTeam.js

/**
 * Sistem > Ekip Kaydı paneli: public site (vertexishere.com) Moderatörler
 * ve Staff kayan listelerini yönetir. Eklenen/kaldırılan kişiler siteye
 * otomatik yansır (listSiteTeam public callable'ı üzerinden).
 */

import { showToast, __, escapeHTML } from '../utils/ui.js';
import { listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn } from '../core/firebase.js';

let entries = [];

const el = (id) => document.getElementById(id);

async function loadTeam() {
    if (!el('team-mod-list')) return;
    try {
        const result = await listSiteTeamFn({});
        const data = result.data || {};
        entries = (data.mods || []).map(m => ({ ...m, kind: 'mod' }))
            .concat((data.staff || []).map(s => ({ ...s, kind: 'staff' })));
        render();
    } catch (error) {
        // Panel sessizce boş kalır; yükleme hatasında listelerde ipucu gösterilir.
        const modList = el('team-mod-list');
        if (modList) modList.innerHTML = `<p class="form-hint">${escapeHTML(error.message)}</p>`;
    }
}

function render() {
    const modList = el('team-mod-list');
    const staffList = el('team-staff-list');
    if (!modList || !staffList) return;
    const row = (it) => `
        <div class="team-entry-row">
            <span class="team-entry-name">${escapeHTML(it.name)}</span>
            <button type="button" class="team-entry-del" data-id="${it.id}" title="${__('team.remove')}"><span class="material-symbols-rounded">close</span></button>
        </div>`;
    const mods = entries.filter(e => e.kind === 'mod');
    const staff = entries.filter(e => e.kind === 'staff');
    modList.innerHTML = mods.length ? mods.map(row).join('') : `<p class="form-hint">${__('team.empty')}</p>`;
    staffList.innerHTML = staff.length ? staff.map(row).join('') : `<p class="form-hint">${__('team.empty')}</p>`;
}

async function add(kind, inputId) {
    const input = el(inputId);
    const name = input.value.trim();
    if (!name) {
        showToast(__('team.name_required'), 'error');
        return;
    }
    const btn = input.parentElement.querySelector('button');
    if (btn) btn.disabled = true;
    try {
        await setSiteTeamEntryFn({ kind, name });
        input.value = '';
        showToast(__('team.added'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function remove(id) {
    if (!confirm(__('team.remove_confirm'))) return;
    try {
        await deleteSiteTeamEntryFn({ id });
        await loadTeam();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    }
}

export function initSiteTeamPanel() {
    if (!el('team-mod-list')) return;
    el('team-mod-add').addEventListener('click', () => add('mod', 'team-mod-input'));
    el('team-staff-add').addEventListener('click', () => add('staff', 'team-staff-input'));
    ['team-mod-input', 'team-staff-input'].forEach(id => {
        el(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                add(id === 'team-mod-input' ? 'mod' : 'staff', id);
            }
        });
    });
    const grid = document.querySelector('#team-log-manager .team-log-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.team-entry-del');
            if (btn && btn.dataset.id) remove(btn.dataset.id);
        });
    }
    loadTeam();
}
