import { __ } from '../../utils/ui.js';
import { DEPARTMENTS } from '../roles.js';
import { listConsoleChatDirectoryFn } from '../../core/firebase.js';
import { escapeHTML } from './presentation.js';
export function createMentions() {
  let mentionIndex = null,
    mentionPop = null,
    mentionMatches = [],
    mentionActive = -1;
  const el = (id) => document.getElementById(id);
  function caretToken() {
    const input = el('chat-input');
    const pos = input.selectionStart ?? input.value.length;
    const upto = input.value.slice(0, pos);
    const m = upto.match(/(^|\s)@([^\s@]*)$/);
    return m ? m[2].toLowerCase() : null;
  }

  async function ensureDirectory() {
    if (mentionIndex) return mentionIndex;
    try {
      const r = await listConsoleChatDirectoryFn({});
      mentionIndex = r.data.users || [];
    } catch {
      mentionIndex = [];
    }
    return mentionIndex;
  }

  function closeMentionPop() {
    if (mentionPop) {
      mentionPop.remove();
      mentionPop = null;
    }
    mentionMatches = [];
    mentionActive = -1;
  }

  function insertMention(value) {
    const input = el('chat-input');
    const pos = input.selectionStart ?? input.value.length;
    const upto = input.value.slice(0, pos);
    const m = upto.match(/(^|\s)@([^\s@]*)$/);
    if (!m) {
      closeMentionPop();
      return;
    }
    const start = pos - m[2].length - 1;
    input.value = input.value.slice(0, start) + '@' + value + ' ' + input.value.slice(pos);
    closeMentionPop();
    input.focus();
    const np = start + value.length + 2;
    input.setSelectionRange(np, np);
  }

  function renderMentionPop() {
    const composer = el('chat-composer');
    if (!composer) return;
    if (!mentionMatches.length) {
      closeMentionPop();
      return;
    }
    if (!mentionPop) {
      mentionPop = document.createElement('div');
      mentionPop.className = 'chat-mention-pop';
      composer.appendChild(mentionPop);
      mentionPop.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const row = e.target.closest('[data-mention]');
        if (row) insertMention(row.dataset.mention);
      });
    }
    mentionPop.innerHTML = mentionMatches
      .map(
        (it, i) =>
          `<button type="button" data-mention="${escapeHTML(it.value)}" class="chat-mention-row ${i === mentionActive ? 'active' : ''}">` +
          `<i class="" data-icon="${it.kind === 'dept' ? 'tag' : 'alternate_email'}"></i>` +
          `<span class="chat-mention-main">@${escapeHTML(it.value)}</span>` +
          (it.badges && it.badges.length
            ? `<span class="chat-mention-badges">${it.badges.map((b) => `<span class="dept-badge">${escapeHTML(b)}</span>`).join('')}</span>`
            : '') +
          `</button>`,
      )
      .join('');
  }

  function updateMentionPop() {
    const token = caretToken();
    if (token === null) {
      closeMentionPop();
      return;
    }
    const matches = [];
    DEPARTMENTS.forEach((d) => {
      if (matches.length < 4 && d.id.toLowerCase().startsWith(token)) {
        matches.push({ kind: 'dept', value: d.id, badges: [] });
      }
    });
    (mentionIndex || []).forEach((u) => {
      if (matches.length >= 10) return;
      const hay = (u.email + ' ' + (u.name || '')).toLowerCase();
      if (hay.includes(token)) {
        matches.push({ kind: 'mail', value: u.email, badges: u.isAdmin ? [__('profile.admin')] : u.departments || [] });
      }
    });
    mentionMatches = matches;
    mentionActive = matches.length ? 0 : -1;
    renderMentionPop();
  }

  function move(delta) {
    mentionActive = (mentionActive + delta + mentionMatches.length) % mentionMatches.length;
    renderMentionPop();
  }
  return {
    caretToken,
    ensureDirectory,
    closeMentionPop,
    updateMentionPop,
    move,
    isOpen: () => !!mentionPop && mentionMatches.length > 0,
    hasSelection: () => mentionActive >= 0,
    selectActive: () => insertMention(mentionMatches[mentionActive].value),
    reset: () => {
      closeMentionPop();
      mentionIndex = null;
    },
  };
}
