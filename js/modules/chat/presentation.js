import { getLang } from '../../utils/ui.js';
export function escapeHTML(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

export function linkify(text) {
  // @Departman ve @mail etiketlerini vurgula, satır sonlarını koru
  return escapeHTML(text)
    .replace(/@([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<span class="chat-mention chat-mention-mail">@$1</span>')
    .replace(
      /@(Tensor|Curia|Essence|Core|Senatus|Pulse|Chroma|Catalyst|Envoy|Aero|Array|Scout|Vertest)/g,
      '<span class="chat-mention chat-mention-dept">@$1</span>',
    )
    .replace(/\n/g, '<br>');
}

export function relativeTime(ms) {
  if (!ms) return '';
  const seconds = Math.floor((new Date(ms).getTime() - Date.now()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  const formatter = new Intl.RelativeTimeFormat(getLang(), { numeric: 'auto', style: 'short' });
  const [unit, value] =
    Math.abs(seconds) < 60
      ? ['second', 0]
      : Math.abs(seconds) < 3600
        ? ['minute', Math.ceil(seconds / 60)]
        : Math.abs(seconds) < 86400
          ? ['hour', Math.ceil(seconds / 3600)]
          : ['day', Math.ceil(seconds / 86400)];
  return formatter.format(value, unit);
}
export function dayLabel(ms) {
  const date = new Date(ms),
    today = new Date();
  const offset = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()) -
      new Date(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000,
  );
  if (offset === 0 || offset === -1)
    return new Intl.RelativeTimeFormat(getLang(), { numeric: 'auto' }).format(offset, 'day');
  return date.toLocaleDateString(getLang(), { weekday: 'long', month: 'long', day: 'numeric' });
}

export function initialsOf(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}
