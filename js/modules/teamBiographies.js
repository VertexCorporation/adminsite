import { formatMessage } from '../lang.js';
import { __ } from '../utils/ui.js';
import { getLang, escapeHTML, showToast, userErrorMessage } from '../utils/ui.js';
import { translateTeamBiographyFn } from '../core/firebase.js';
import { setButtonLoading } from '../utils/loading.js';

// Keep in sync with vertexite's 16 public routes. Identity and roles are not translated here.
export const BIO_LANGUAGES = Object.freeze([
  ['tr', __('language.tr')],
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['fr', __('team.ui.franAis')],
  ['es', 'Español'],
  ['it', 'Italiano'],
  ['pt', 'Português'],
  ['nl', 'Nederlands'],
  ['ru', 'Русский'],
  ['ar', 'العربية'],
  ['hi', 'हिन्दी'],
  ['id', 'Bahasa Indonesia'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['zh', '中文'],
  ['az', 'Azərbaycanca'],
]);
const text = (tr, en) => (getLang() === 'tr' ? tr : en);
const supported = (code) => BIO_LANGUAGES.some(([lang]) => lang === code);

export function mountBiographyEditor(host, card = {}) {
  const source = supported(card.bioSourceLang) ? card.bioSourceLang : 'tr';
  const initial = Object.fromEntries(
    BIO_LANGUAGES.map(([lang]) => [lang, typeof card.biographies?.[lang] === 'string' ? card.biographies[lang] : '']),
  );
  let translating = false;
  host.innerHTML =
    '<div class="form-section-title">' +
    __('team.ui.biographies') +
    '</div>' +
    '<p class="form-hint">' +
    __('team.ui.editBiographiesIn16LanguagesNameLinks') +
    '</p>' +
    '<div class="form-grid"><div class="form-group-field"><label for="team-bio-source">' +
    __('team.ui.sourceLanguage') +
    '</label>' +
    '<select id="team-bio-source" required>' +
    BIO_LANGUAGES.map(
      ([lang, name]) =>
        '<option value="' + lang + '" ' + (lang === source ? 'selected' : '') + '>' + name + '</option>',
    ).join('') +
    '</select></div>' +
    '<div class="form-group-field"><label for="team-bio-language">' +
    __('team.ui.editingLanguage') +
    '</label>' +
    '<select id="team-bio-language" >' +
    BIO_LANGUAGES.map(
      ([lang, name]) =>
        '<option value="' + lang + '" ' + (lang === source ? 'selected' : '') + '>' + name + '</option>',
    ).join('') +
    '</select></div></div>' +
    '<div class="form-group-field"><label for="team-bio-overwrite"><input type="checkbox" id="team-bio-overwrite"> ' +
    __('team.ui.replaceExistingTranslationsToo') +
    '</label></div>' +
    '<button type="button" class="chrome-btn-outline" id="team-bio-translate">' +
    __('team.ui.translateOtherLanguagesWithGoogle') +
    '</button>' +
    '<p class="form-hint" role="status" aria-live="polite" id="team-bio-status"></p>' +
    BIO_LANGUAGES.map(
      ([lang, name]) =>
        '<div class="form-group-field" data-bio-panel="' +
        lang +
        '" ' +
        (lang !== source ? 'hidden' : '') +
        '><label for="team-card-bio-' +
        lang +
        '">' +
        __('team_profile.bio_label') +
        ' · ' +
        name +
        '</label>' +
        '<textarea id="team-card-bio-' +
        lang +
        '" data-bio-lang="' +
        lang +
        '" lang="' +
        lang +
        '" dir="' +
        (lang === 'ar' ? 'rtl' : 'auto') +
        '" rows="9" maxlength="6000">' +
        escapeHTML(initial[lang]) +
        '</textarea></div>',
    ).join('') +
    '<small class="form-hint">' +
    __('team.ui.reviewTheTranslationsAndPressSaveTranslating') +
    '</small>';
  const field = (lang) => host.querySelector('[data-bio-lang="' + lang + '"]');
  const sourceSelect = host.querySelector('#team-bio-source');
  const languageSelect = host.querySelector('#team-bio-language');
  const button = host.querySelector('#team-bio-translate');
  const status = host.querySelector('#team-bio-status');
  const draw = () => {
    host.querySelectorAll('[data-bio-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.bioPanel !== languageSelect.value;
    });
    [...languageSelect.options].forEach((option) => {
      const name = BIO_LANGUAGES.find(([lang]) => lang === option.value)[1];
      option.textContent = name + (field(option.value).value.trim() ? ' ✓' : '');
    });
  };
  languageSelect.addEventListener('change', draw);
  sourceSelect.addEventListener('change', () => {
    languageSelect.value = sourceSelect.value;
    draw();
  });
  host.addEventListener('input', draw);
  button.addEventListener('click', async () => {
    if (translating) return;
    if (!supported(sourceSelect.value)) {
      sourceSelect.reportValidity();
      return;
    }
    const sourceLang = sourceSelect.value,
      sourceText = field(sourceLang).value.trim();
    if (!sourceText) {
      languageSelect.value = sourceLang;
      draw();
      field(sourceLang).focus();
      showToast(() => __('team.ui.enterABiographyInTheSourceLanguage'), 'error');
      return;
    }
    const overwrite = host.querySelector('#team-bio-overwrite').checked;
    const targets = BIO_LANGUAGES.map(([lang]) => lang).filter(
      (lang) => lang !== sourceLang && (overwrite || !field(lang).value.trim()),
    );
    if (!targets.length) {
      status.textContent = __('team.ui.allLanguagesAreFilled');
      return;
    }
    const before = Object.fromEntries(targets.map((lang) => [lang, field(lang).value]));
    translating = true;
    setButtonLoading(button, true);
    status.textContent = __('team.ui.translating');
    try {
      const { data } = await translateTeamBiographyFn({ text: sourceText, sourceLang, targetLangs: targets });
      if (!data?.translations || typeof data.translations !== 'object') throw new Error('Invalid translation response');
      if (!host.isConnected) return;
      if (sourceSelect.value !== sourceLang || field(sourceLang).value.trim() !== sourceText) {
        status.textContent = __('team.ui.theSourceChangedRunTranslationAgain');
        return;
      }
      let applied = 0;
      for (const lang of targets) {
        const value = data.translations[lang];
        // Never overwrite edits made while the request was in flight.
        if (field(lang).value === before[lang] && typeof value === 'string' && value.trim() && value.length <= 6000) {
          field(lang).value = value.trim();
          applied++;
        }
      }
      draw();
      status.textContent = formatMessage('team.ui.translationsAddedReviewAndSave', {
        value0: applied,
        value1: targets.length,
      });
    } catch (error) {
      status.textContent = __('team.ui.translationFailedYourDraftTextIsPreserved');
      showToast(() => userErrorMessage(error), 'error');
    } finally {
      translating = false;
      setButtonLoading(button, false);
    }
  });
  draw();
  return {
    get busy() {
      return translating;
    },
    read() {
      return {
        bioSourceLang: sourceSelect.value,
        biographies: Object.fromEntries(BIO_LANGUAGES.map(([lang]) => [lang, field(lang).value.trim()])),
      };
    },
  };
}
