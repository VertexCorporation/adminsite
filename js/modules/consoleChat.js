// js/modules/consoleChat.js

/**
 * Sohbet sistemi — kanallar, mesaj akışı (Timeline benzeri gün gruplu
 * animasyonlu feed), görev/sorun takibi. Kanal oluşturma/düzenleme yalnızca
 * adminlerde; kanal görünürlüğü departman bazlı; @etiket mailleri sunucuda
 * gönderilir (consoleChat* fonksiyonları).
 */

import { showToast, __, onLangChange } from '../utils/ui.js';
import { getEffectivePanelLevel, isPanelAdmin, DEPARTMENTS } from './roles.js';
import {
    listConsoleChatChannelsFn,
    createConsoleChatChannelFn,
    updateConsoleChatChannelFn,
    postConsoleChatMessageFn,
    listConsoleChatMessagesFn,
    updateConsoleChatTaskStatusFn
} from '../core/firebase.js';

let channels = [];
let currentChannelId = null;
let isAdmin = false;
let pollTimer = null;
let channelFormMode = 'create'; // 'create' | 'edit'

const el = (id) => document.getElementById(id);

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function linkify(text) {
    // @Departman ve @mail etiketlerini vurgula, satır sonlarını koru
    return escapeHTML(text)
        .replace(/@([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<span class="chat-mention chat-mention-mail">@$1</span>')
        .replace(/@(Tensor|Curia|Essence|Core|Senatus|Pulse|Chroma|Catalyst|Envoy|Aero|Array|Scout|Vertest)/g, '<span class="chat-mention chat-mention-dept">@$1</span>')
        .replace(/\n/g, '<br>');
}

function relativeTime(ms) {
    if (!ms) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (minutes < 1) return 'şimdi';
    if (minutes < 60) return `${minutes}dk`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}sa`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}g`;
    return new Date(ms).toLocaleDateString();
}

function dayLabel(ms) {
    const d = new Date(ms);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, today)) return 'Bugün';
    if (same(d, yesterday)) return 'Dün';
    return d.toLocaleDateString('tr-TR', { weekday: 'long', month: 'long', day: 'numeric' });
}

function initialsOf(name) {
    const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

// --- Kanallar ---

async function loadChannels() {
    try {
        const result = await listConsoleChatChannelsFn();
        channels = result.data.channels || [];
        isAdmin = result.data.isAdmin || isPanelAdmin();
        const createBtn = el('chat-create-btn');
        if (createBtn) createBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        renderChannelList();
        // Açık kanal hâlâ erişilebilir mi?
        if (currentChannelId && !channels.some(c => c.id === currentChannelId)) {
            currentChannelId = null;
            renderMessages([]);
            renderChatHeader();
        }
        if (!currentChannelId && channels.length) selectChannel(channels[0].id);
    } catch (error) {
        console.error('[CHAT] Kanallar yüklenemedi:', error);
        const msg = /unauthenticated|permission/i.test(error.message)
            ? __('chat.login_hint')
            : error.message;
        el('chat-channel-list').innerHTML = `<p class="form-hint chat-hint">${escapeHTML(msg)}</p>`;
    }
}

function renderChannelList() {
    const container = el('chat-channel-list');
    if (!container) return;
    if (!channels.length) {
        container.innerHTML = `<p class="form-hint chat-hint">${__('chat.no_channels')}</p>`;
        return;
    }
    container.innerHTML = channels.map(ch => `
        <button type="button" class="chat-channel-item ${ch.id === currentChannelId ? 'active' : ''}" data-channel="${ch.id}">
            <span class="material-symbols-rounded">${ch.departments?.length ? 'lock' : 'tag'}</span>
            <span class="chat-channel-name">${escapeHTML(ch.name)}</span>
            ${ch.postLevel === 'admins' ? '<span class="material-symbols-rounded chat-channel-lock" title="Yönetici kanalı">shield</span>' : ''}
        </button>
    `).join('');
}

function selectChannel(channelId) {
    currentChannelId = channelId;
    renderChannelList();
    loadMessages();
}

async function loadMessages() {
    const channel = channels.find(c => c.id === currentChannelId);
    renderChatHeader(channel);
    if (!channel) return;
    const container = el('chat-messages');
    container.innerHTML = `<p class="form-hint chat-hint">${__('chat.loading')}</p>`;
    try {
        const result = await listConsoleChatMessagesFn({ channelId: currentChannelId });
        renderMessages(result.data.messages || [], channel);
        // composer görünürlüğü
        el('chat-composer').style.display = channel.canPost ? 'flex' : 'none';
        if (!channel.canPost) {
            container.insertAdjacentHTML('beforeend', `<p class="form-hint chat-hint">${__('chat.readonly')}</p>`);
        }
        // admin düzenleme butonu
        el('chat-channel-edit').style.display = channel.canManage ? 'inline-flex' : 'none';
    } catch (error) {
        console.error('[CHAT] Mesajlar yüklenemedi:', error);
        container.innerHTML = `<p class="form-hint chat-hint">${escapeHTML(error.message)}</p>`;
    }
}

function renderChatHeader(channel) {
    el('chat-channel-title').textContent = channel ? `# ${channel.name}` : '—';
    el('chat-channel-desc').textContent = channel?.description || '';
    const badges = el('chat-channel-badges');
    badges.innerHTML = channel
        ? (channel.departments?.length
            ? channel.departments.map(d => `<span class="dept-badge">${escapeHTML(d)}</span>`).join('')
            : `<span class="dept-badge">${__('chat.open_all')}</span>`)
        : '';
}

// --- Mesaj akışı (Timeline benzeri gün gruplu feed) ---

function renderMessages(messages) {
    const container = el('chat-messages');
    if (!messages.length) {
        container.innerHTML = `<p class="form-hint chat-hint">${__('chat.empty')}</p>`;
        return;
    }
    // güne göre grupla
    const groups = new Map();
    messages.forEach(m => {
        const day = m.createdAt ? new Date(m.createdAt).toDateString() : '?';
        if (!groups.has(day)) groups.set(day, []);
        groups.get(day).push(m);
    });

    let html = '';
    let delay = 0;
    for (const [day, msgs] of groups) {
        html += `<div class="chat-day"><span>${escapeHTML(dayLabel(msgs[0].createdAt))}</span><span class="chat-day-count">${msgs.length}</span></div>`;
        for (const m of msgs) {
            const task = m.kind === 'task';
            const done = m.taskStatus === 'done';
            html += `
            <div class="chat-msg chat-msg-enter" data-id="${m.id}" style="animation-delay:${Math.min(delay * 40, 400)}ms">
                <span class="chat-avatar">${escapeHTML(initialsOf(m.authorName || m.authorEmail))}</span>
                <div class="chat-msg-body">
                    <div class="chat-msg-head">
                        <strong>${escapeHTML(m.authorName || m.authorEmail)}</strong>
                        <span class="chat-msg-mail">${escapeHTML(m.authorEmail)}</span>
                        ${m.authorDepartments?.map(d => `<span class="dept-badge">${escapeHTML(d)}</span>`).join('') || ''}
                        <span class="chat-msg-time" title="${m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}">${relativeTime(m.createdAt)}</span>
                    </div>
                    <div class="chat-msg-text ${done ? 'chat-task-done' : ''}">${linkify(m.text)}</div>
                    ${task ? `
                    <div class="chat-task-row">
                        <span class="chat-task-chip ${done ? 'done' : 'open'}">${done ? __('chat.task_done') : __('chat.task_open')}</span>
                        ${m.canToggleTask ? `<button type="button" class="chat-task-toggle-btn" data-task="${m.id}" data-status="${done ? 'open' : 'done'}">${done ? __('chat.task_reopen') : __('chat.task_done_btn')}</button>` : ''}
                    </div>` : ''}
                </div>
            </div>`;
            delay++;
        }
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;

    const pending = container.querySelector('.chat-task-toggle-btn');
    if (pending) pending.disabled = false;
}

// --- Gönderme ---

async function sendMessage() {
    const input = el('chat-input');
    const text = input.value.trim();
    if (!text || !currentChannelId) return;
    const asTask = el('chat-as-task').checked;
    el('chat-send').disabled = true;
    input.disabled = true;
    try {
        await postConsoleChatMessageFn({ channelId: currentChannelId, text, asTask });
        input.value = '';
        el('chat-as-task').checked = false;
        await loadMessages();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        el('chat-send').disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// --- Kanal oluştur/düzenle formu ---

function renderDeptCheckboxes(selected = []) {
    const container = el('chat-form-depts');
    container.innerHTML = `<label class="chat-dept-all"><input type="checkbox" value="" ${selected.length ? '' : 'checked'}><span>${__('chat.open_all')}</span></label>` +
        DEPARTMENTS.map(d => `<label class="chat-dept-choice"><input type="checkbox" value="${d.id}" ${selected.includes(d.id) ? 'checked' : ''}><span>${d.id}</span></label>`).join('');
    // "Tümü" işaretliyse diğerlerini kapat
    container.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => {
            const boxes = [...container.querySelectorAll('input')];
            if (input.value === '' && input.checked) {
                boxes.forEach(b => { if (b.value !== '') b.checked = false; });
            } else if (input.value !== '' && input.checked) {
                boxes.find(b => b.value === '').checked = false;
            }
        });
    });
}

function openChannelForm(mode, channel = null) {
    channelFormMode = mode;
    const form = el('chat-channel-form');
    form.style.display = 'block';
    el('chat-form-title').textContent = mode === 'create' ? __('chat.form_create') : __('chat.form_edit');
    el('chat-form-name').value = channel?.name || '';
    el('chat-form-desc').value = channel?.description || '';
    el('chat-form-postlevel').value = channel?.postLevel || 'all';
    renderDeptCheckboxes(channel?.departments || []);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeChannelForm() {
    el('chat-channel-form').style.display = 'none';
}

async function submitChannelForm() {
    const name = el('chat-form-name').value.trim();
    const description = el('chat-form-desc').value.trim();
    const postLevel = el('chat-form-postlevel').value;
    const departments = [...el('chat-form-depts').querySelectorAll('input:checked')].map(i => i.value);
    if (!name) {
        showToast(__('chat.name_required'), 'error');
        return;
    }
    try {
        if (channelFormMode === 'create') {
            await createConsoleChatChannelFn({ name, description, departments, postLevel });
            showToast(__('chat.created'), 'success');
        } else {
            await updateConsoleChatChannelFn({ channelId: currentChannelId, name, description, departments, postLevel });
            showToast(__('chat.updated'), 'success');
        }
        closeChannelForm();
        await loadChannels();
    } catch (error) {
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    }
}

// --- Başlatma ---

/** Giriş/oturum değişiminde dışarıdan tetiklenir. */
export function refreshConsoleChat() {
    return loadChannels();
}

export function initConsoleChat() {
    if (!el('chat-channel-list')) return;
    isAdmin = isPanelAdmin();

    el('chat-create-btn').style.display = isAdmin ? 'inline-flex' : 'none';
    el('chat-create-btn').addEventListener('click', () => openChannelForm('create'));
    el('chat-channel-edit').addEventListener('click', () => {
        const channel = channels.find(c => c.id === currentChannelId);
        if (channel) openChannelForm('edit', channel);
    });

    // Kalici delegation: kanal listesi her yenilense bile tiklamalar asla kaybolmaz
    el('chat-channel-list').addEventListener('click', (e) => {
        const btn = e.target.closest('.chat-channel-item');
        if (btn && btn.dataset.channel) selectChannel(btn.dataset.channel);
    });
    el('chat-messages').addEventListener('click', (e) => {
        const btn = e.target.closest('.chat-task-toggle-btn');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        updateConsoleChatTaskStatusFn({
            channelId: currentChannelId,
            messageId: btn.dataset.task,
            status: btn.dataset.status
        }).then(() => loadMessages()).catch((error) => {
            showToast(`${__('system.error')}: ${error.message}`, 'error');
            btn.disabled = false;
        });
    });
    el('chat-form-cancel').addEventListener('click', closeChannelForm);
    el('chat-form-save').addEventListener('click', submitChannelForm);
    el('chat-send').addEventListener('click', sendMessage);
    el('chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    loadChannels();
    // Yeni mesaj/kanallar için hafif yoklama
    pollTimer = setInterval(() => {
        if (document.hidden) return;
        loadChannels();
        if (currentChannelId) loadMessages();
    }, 8000);

    onLangChange(() => { renderChannelList(); });
}
