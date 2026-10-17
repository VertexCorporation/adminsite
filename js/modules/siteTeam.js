import { confirmDialog } from './shell.js';
import { beginPanelLoading } from '../utils/loading.js';
// js/modules/siteTeam.js

/** Sistem > Onur Tablosu: kamu sitesindeki onur isimlerini yönetir. */

import { userErrorMessage, showToast, __, escapeHTML } from '../utils/ui.js';
import { listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn, auth } from '../core/firebase.js';

let honors = [];
let editingId = null;

const el = (id) => document.getElementById(id);

async function loadTeam() {
    if (!el('team-mod-list')) return;
    const finishLoading=beginPanelLoading(el('team-mod-list'));
    try {
        const result = await listSiteTeamFn({ manage: true });
        honors = (result.data && result.data.honors) || [];
        cards = result.data?.cards || []; renderCards();
        render();
    } catch (error) {
        const list = el('team-mod-list');
        if (list) list.innerHTML = `<p class="form-hint">${escapeHTML(error.message)}</p>`;
    } finally {finishLoading();}
}

function render() {
    const list = el('team-mod-list');
    if (!list) return;
    if (!honors.length) {
        list.innerHTML = `<p class="form-hint" data-i18n="team.empty">${__('team.empty')}</p>`;
        return;
    }
    list.innerHTML = honors.map(m => {
        if (editingId === m.id) {
            return `
            <div class="team-entry-row team-entry-editing" data-id="${escapeHTML(m.id)}">
                <input type="text" class="team-edit-input" value="${escapeHTML(m.name)}" maxlength="60">
                <button type="button" class="team-entry-save" data-save="${escapeHTML(m.id)}" title="${__('team.save')}"><i class="" data-icon="check"></i></button>
                <button type="button" class="team-entry-cancel" data-cancel="1" title="${__('team.cancel')}"><i class="" data-icon="close"></i></button>
            </div>`;
        }
        return `
        <div class="team-entry-row" data-id="${escapeHTML(m.id)}">
            <span class="team-entry-name">${escapeHTML(m.name)}</span>
            <button type="button" class="team-entry-edit" data-edit="${escapeHTML(m.id)}" title="${__('team.edit')}"><i class="" data-icon="edit"></i></button>
            <button type="button" class="team-entry-del" data-id="${escapeHTML(m.id)}" title="${__('team.remove')}"><i class="" data-icon="close"></i></button>
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
        showToast(() => __('team.name_required'), 'error');
        return;
    }
    const btn = el('team-mod-add');
    if (btn) btn.disabled = true;
    try {
        await setSiteTeamEntryFn({ kind: 'honor', name });
        input.value = '';
        showToast(() => __('team.added'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(() => userErrorMessage(error), 'error');
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
        showToast(() => __('team.name_required'), 'error');
        return;
    }
    try {
        await setSiteTeamEntryFn({ kind: 'honor', name, id });
        editingId = null;
        showToast(() => __('team.updated'), 'success');
        await loadTeam();
    } catch (error) {
        showToast(() => userErrorMessage(error), 'error');
    }
}

async function remove(id) {
    if (!await confirmDialog(()=>({title:__('common.confirm'),body:__('team.remove_confirm')}))) return;
    try {
        await deleteSiteTeamEntryFn({ id });
        await loadTeam();
    } catch (error) {
        showToast(() => userErrorMessage(error), 'error');
    }
}

export function initSiteTeamPanel() {
    initCards();
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
    // Initialize before login, but read team data only from an authenticated workspace.
    document.addEventListener('vertex:system-page',event=>{
        if(event.detail==='verification' && auth.currentUser)void loadTeam();
    });
}

let cards = [], cardDraft = null, positionLanguage = 'tr';
const cardLanguages = {tr:'Türkçe',en:'English',de:'Deutsch',fr:'Français',es:'Español',it:'Italiano',pt:'Português',nl:'Nederlands',ru:'Русский',ar:'العربية',hi:'हिन्दी',id:'Bahasa Indonesia',ja:'日本語',ko:'한국어',zh:'中文',az:'Azərbaycanca'};
function renderCards(){
    const list=el('team-card-list');if(!list)return;
    list.innerHTML=cards.map(c=>`<div class="team-entry-row"><img src="${escapeHTML(c.imageUrl)}" alt="" loading="lazy" style="width:38px;height:48px;object-fit:cover;border-radius:5px;"><span class="team-entry-name">${escapeHTML(c.name)}<small style="display:block;opacity:.7;">${escapeHTML(c.positions?.[document.documentElement.lang]||c.positions?.en||c.positions?.tr||'')}</small></span><button type="button" class="team-entry-edit" data-card-edit="${escapeHTML(c.id)}" title="${__('team.edit')}">✎</button><button type="button" class="team-entry-del" data-card-delete="${escapeHTML(c.id)}" title="${__('team.remove')}">×</button></div>`).join('');
}
function editCard(id){
    const found=cards.find(c=>c.id===id);
    cardDraft=found?{...found,positions:{...found.positions}}:{id:'card_'+crypto.randomUUID(),positions:{},order:cards.length+1};
    positionLanguage=document.documentElement.lang==='tr'?'tr':'en';
    el('team-card-language').value=positionLanguage;
    el('team-card-name').value=cardDraft.name||'';el('team-card-position').value=cardDraft.positions[positionLanguage]||'';
    el('team-card-image').value=cardDraft.imageUrl||'';el('team-card-file').value='';el('team-card-order').value=cardDraft.order;
    el('team-card-form').hidden=false;el('team-card-name').focus();
}
async function saveCard(event){
    event.preventDefault();if(!cardDraft)return;const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
    try{
        let imageUrl=el('team-card-image').value.trim();const file=el('team-card-file').files[0];
        if(file){
            if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(__('team.card_file'));
            const image=await createImageBitmap(file);if(image.width*image.height>24000000){image.close();throw Error(__('team.card_file'));}
            const canvas=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();
            const imageData=canvas.toDataURL('image/webp',.85).split(',')[1];
            const upload=await setSiteTeamEntryFn({kind:'photo',contentType:'image/webp',imageData});imageUrl=upload.data.imageUrl;el('team-card-image').value=imageUrl;
        }
        cardDraft.positions[positionLanguage]=el('team-card-position').value.trim();
        await setSiteTeamEntryFn({kind:'card',id:cardDraft.id,name:el('team-card-name').value.trim(),positions:cardDraft.positions,imageUrl,order:Number(el('team-card-order').value)});
        form.hidden=true;cardDraft=null;showToast(()=>__('team.updated'),'success');await loadTeam();
    }catch(error){showToast(()=>userErrorMessage(error),'error');}finally{button.disabled=false;}
}
function initCards(){
    if(!el('team-card-form'))return;
    el('team-card-language').innerHTML=Object.entries(cardLanguages).map(([code,name])=>`<option value="${code}">${name}</option>`).join('');
    el('team-card-language').addEventListener('change',event=>{if(!cardDraft)return;cardDraft.positions[positionLanguage]=el('team-card-position').value;positionLanguage=event.target.value;el('team-card-position').value=cardDraft.positions[positionLanguage]||'';});
    el('team-card-new').addEventListener('click',()=>editCard(null));el('team-card-cancel').addEventListener('click',()=>{cardDraft=null;el('team-card-form').hidden=true;});el('team-card-form').addEventListener('submit',saveCard);
    el('team-card-list').addEventListener('click',async event=>{const edit=event.target.closest('[data-card-edit]');if(edit){editCard(edit.dataset.cardEdit);return;}const remove=event.target.closest('[data-card-delete]');if(!remove)return;if(!await confirmDialog(()=>({title:__('common.confirm'),body:__('team.remove_confirm')})))return;remove.disabled=true;try{await deleteSiteTeamEntryFn({kind:'card',id:remove.dataset.cardDelete});await loadTeam();}catch(error){showToast(()=>userErrorMessage(error),'error');remove.disabled=false;}});
}
