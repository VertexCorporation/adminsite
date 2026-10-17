import { showLoadError } from '../ui/states.js';
import { crossfade } from '../ui/transition.js';
import { confirmDialog } from './shell.js';
import { beginPanelLoading, setButtonLoading } from '../utils/loading.js';
import { icon } from '../utils/icons.js';
// js/modules/siteTeam.js

/**
 * Sistem > Ekip Kaydı paneli: public site (vertexishere.com) Moderatörler
 * listesini yönetir (ekle / sil / yeniden adlandır). Staff listesi panelde
 * yönetilmez — onaylı adaylar (contributors.hasVerified) otomatik olarak
 * sitedeki Staff kaydırma listesine düşer.
 */

import { userErrorMessage, showToast, __, escapeHTML } from '../utils/ui.js';
import { listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn, auth } from '../core/firebase.js';

let mods = [];
let editingId = null;

const el = (id) => document.getElementById(id);

async function loadTeam() {
    if (!el('team-mod-list')) return;
    const finishLoading = beginPanelLoading(el('team-mod-list'));
    try {
        const result = await listSiteTeamFn({});
        mods = (result.data && result.data.mods) || [];
        render();
    } catch (error) {
        const list = el('team-mod-list');
        showLoadError(list,()=>userErrorMessage(error),loadTeam,{staleSelector:'.team-list-row'});
    } finally { finishLoading(); }
}

function render() {
    const list = el('team-mod-list');
    if (!list) return;
    if (!mods.length) {
        crossfade(list, () => { list.innerHTML = `<p class="state-block" data-i18n="team.empty">${__('team.empty')}</p>`; });
        return;
    }
    list.className = 'team-list';
    const html = mods.map(m => {
        if (editingId === m.id) {
            return `
            <div class="team-list-row team-list-row--editing" data-id="${m.id}">
                <div class="team-edit-row">
                    <input type="text" class="team-edit-input" value="${escapeHTML(m.name)}" maxlength="60"
                           aria-label="${escapeHTML(m.name)}">
                </div>
                <div class="team-list-actions">
                    <button type="button" class="icon-btn team-entry-save" data-save="${m.id}" title="${__('team.save')}">
                        ${icon('check')}
                    </button>
                    <button type="button" class="icon-btn team-entry-cancel" data-cancel="1" title="${__('team.cancel')}">
                        ${icon('x')}
                    </button>
                </div>
            </div>`;
        }
        return `
        <div class="team-list-row" data-id="${m.id}">
            <div class="team-list-info">
                <span class="team-list-name">${escapeHTML(m.name)}</span>
            </div>
            <div class="team-list-actions">
                <button type="button" class="icon-btn team-entry-edit" data-edit="${m.id}" title="${__('team.edit')}">
                    ${icon('pencil')}
                </button>
                <button type="button" class="icon-btn danger team-entry-del" data-id="${m.id}" title="${__('team.remove')}">
                    ${icon('trash')}
                </button>
            </div>
        </div>`;
    }).join('');
    crossfade(list, () => { list.innerHTML = html; });
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
        showToast(() => __('team.name_required'), 'error');
        return;
    }
    const btn = el('team-mod-add');
    setButtonLoading(btn,true);
    try {
        await setSiteTeamEntryFn({ kind: 'mod', name });
        input.value = '';
        showToast(() => __('team.added'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(() => userErrorMessage(error), 'error');
    } finally {
        setButtonLoading(btn,false);
    }
}

async function rename(id) {
    const list = el('team-mod-list');
    const row = list.querySelector(`.team-list-row--editing[data-id="${id}"]`);
    const input = row && row.querySelector('.team-edit-input');
    const name = input ? input.value.trim() : '';
    if (!name) {
        showToast(() => __('team.name_required'), 'error');
        return;
    }
    const button=list.querySelector('.team-entry-save[data-save="'+CSS.escape(id)+'"]');
    setButtonLoading(button,true);
    try {
        await setSiteTeamEntryFn({ kind: 'mod', name, id });
        editingId = null;
        showToast(() => __('team.updated'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(() => userErrorMessage(error), 'error');
    } finally { setButtonLoading(button,false); }
}

async function remove(id) {
    const mod = mods.find(m => m.id === id);
    if (!await confirmDialog(() => ({
        title: __('team.remove'),
        body: mod ? `"${mod.name}"` : __('team.remove_confirm'),
        confirmLabel: __('team.remove'),
        danger: true
    }))) return;
    const button=el('team-mod-list')?.querySelector('.team-entry-del[data-id="'+CSS.escape(id)+'"]');
    setButtonLoading(button,true);
    try {
        await deleteSiteTeamEntryFn({ id });
        showToast(() => __('team.removed'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(() => userErrorMessage(error), 'error');
    } finally { setButtonLoading(button,false); }
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
        const row = e.target.closest('.team-list-row--editing');
        if (e.key === 'Enter') {
            e.preventDefault();
            if (row) rename(row.dataset.id);
        } else if (e.key === 'Escape') {
            editingId = null;
            render();
        }
    });
    // Initialize before login, but read team data only from an authenticated workspace.
    document.addEventListener('vertex:system-page',event=>{
        if(event.detail==='verification' && auth.currentUser)void loadTeam();
    });
}
