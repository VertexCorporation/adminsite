import { confirmDialog } from './shell.js';
import { beginPanelLoading } from '../utils/loading.js';
// js/modules/siteTeam.js

/**
 * Sistem > Ekip Kaydı paneli: public site (vertexishere.com) Moderatörler
 * listesini yönetir (ekle / sil / yeniden adlandır). Staff listesi panelde
 * yönetilmez — onaylı adaylar (contributors.hasVerified) otomatik olarak
 * sitedeki Staff kaydırma listesine düşer.
 */

import { showToast, __, escapeHTML } from '../utils/ui.js';
import { listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn } from '../core/firebase.js';

let mods = [];
let editingId = null;

const el = (id) => document.getElementById(id);

async function loadTeam() {
    if (!el('team-mod-list')) return;
    const finishLoading=beginPanelLoading(el('team-mod-list'));
    try {
        const result = await listSiteTeamFn({});
        mods = (result.data && result.data.mods) || [];
        render();
    } catch (error) {
        const list = el('team-mod-list');
        if (list) list.innerHTML = `<p class="form-hint">${escapeHTML(error.message)}</p>`;
    } finally {finishLoading();}
}

function render() {
    const list = el('team-mod-list');
    if (!list) return;
    if (!mods.length) {
        list.innerHTML = `<p class="form-hint">${__('team.empty')}</p>`;
        return;
    }
    list.innerHTML = mods.map(m => {
        if (editingId === m.id) {
            return `
            <div class="team-entry-row team-entry-editing" data-id="${m.id}">
                <input type="text" class="team-edit-input" value="${escapeHTML(m.name)}" maxlength="60">
                <button type="button" class="team-entry-save" data-save="${m.id}" title="${__('team.save')}"><i class="" data-icon="check"></i></button>
                <button type="button" class="team-entry-cancel" data-cancel="1" title="${__('team.cancel')}"><i class="" data-icon="close"></i></button>
            </div>`;
        }
        return `
        <div class="team-entry-row" data-id="${m.id}">
            <span class="team-entry-name">${escapeHTML(m.name)}</span>
            <button type="button" class="team-entry-edit" data-edit="${m.id}" title="${__('team.edit')}"><i class="" data-icon="edit"></i></button>
            <button type="button" class="team-entry-del" data-id="${m.id}" title="${__('team.remove')}"><i class="" data-icon="close"></i></button>
        </div>`;
    }).join('');
    const editing = list.querySelector('.team-edit-input');
    if (editing) {
        editing.focus();
        editing.setSelectionRange(editing.value.length, editing.value.length);
    }
}

async function add() {
    const input = el('team-mod-input');
    const name = input.value.trim();
    if (!name) {
        showToast(__('team.name_required'), 'error');
        return;
    }
    const btn = el('team-mod-add');
    if (btn) btn.disabled = true;
    try {
        await setSiteTeamEntryFn({ kind: 'mod', name });
        input.value = '';
        showToast(__('team.added'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function rename(id) {
    const list = el('team-mod-list');
    const row = list.querySelector(`.team-entry-editing[data-id="${id}"]`);
    const input = row && row.querySelector('.team-edit-input');
    const name = input ? input.value.trim() : '';
    if (!name) {
        showToast(__('team.name_required'), 'error');
        return;
    }
    try {
        await setSiteTeamEntryFn({ kind: 'mod', name, id });
        editingId = null;
        showToast(__('team.updated'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    }
}

async function remove(id) {
    if (!await confirmDialog(()=>({title:__('common.confirm'),body:__('team.remove_confirm')}))) return;
    try {
        await deleteSiteTeamEntryFn({ id });
        await loadTeam();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    }
}

export function initSiteTeamPanel() {
    if (!el('team-mod-list')) return;
    el('team-mod-add').addEventListener('click', add);
    el('team-mod-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            add();
        }
    });
    const list = el('team-mod-list');
    list.addEventListener('click', (e) => {
        const saveBtn = e.target.closest('.team-entry-save');
        if (saveBtn && saveBtn.dataset.save) { rename(saveBtn.dataset.save); return; }
        if (e.target.closest('.team-entry-cancel')) { editingId = null; render(); return; }
        const editBtn = e.target.closest('.team-entry-edit');
        if (editBtn && editBtn.dataset.edit) { editingId = editBtn.dataset.edit; render(); return; }
        const delBtn = e.target.closest('.team-entry-del');
        if (delBtn && delBtn.dataset.id) remove(delBtn.dataset.id);
    });
    list.addEventListener('keydown', (e) => {
        if (!e.target.classList.contains('team-edit-input')) return;
        const row = e.target.closest('.team-entry-editing');
        if (e.key === 'Enter') {
            e.preventDefault();
            if (row) rename(row.dataset.id);
        } else if (e.key === 'Escape') {
            editingId = null;
            render();
        }
    });
    loadTeam();
}
