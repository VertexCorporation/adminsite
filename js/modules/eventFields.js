import { __ } from '../utils/ui.js';
// Structured editors keep existing data, including unknown metadata, when rows change.
export function mountEventFields(form, translate) {
  const labels = {
    speakers: [
      ['name', 'deleteAccount.name_label', 'deleteAccount.name_label'],
      ['role', 'beacons.role', 'beacons.role'],
      ['role_en', 'events.ui.englishRole', 'events.ui.englishRole'],
      ['img', 'events.ui.imageUrl', 'events.ui.imageUrl'],
    ],
    ticketCategories: [
      ['name', 'events.ui.category', 'events.ui.category'],
      ['price', 'events.ui.price', 'events.ui.price'],
      ['description', 'events.ui.benefits', 'events.ui.benefits'],
      ['currency', 'events.ui.currency', 'events.ui.currency'],
      ['stripeLink', 'events.ui.stripeLink', 'events.ui.stripeLink'],
      ['salesStatus', 'events.ui.salesOpenClosedSoldOut', 'events.ui.salesOpenClosedSoldOut'],
    ],
  };
  const refreshers = [];
  for (const [key, columns] of Object.entries(labels)) {
    const source = form.elements[key];
    source.hidden = true;
    source.previousElementSibling.textContent = __('eventEditor.' + key);
    const box = document.createElement('div');
    box.className = 'event-rows';
    source.after(box);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'chrome-btn-outline';
    add.textContent = __('events.ui.add');
    box.after(add);
    const read = () => JSON.parse(source.value || '[]');
    const paint = () => {
      box.replaceChildren();
      read().forEach((row, index) => {
        const card = document.createElement('fieldset');
        card.className = 'form-grid two-col';
        for (const [field, tr, en] of columns) {
          const label = document.createElement('label');
          label.className = 'form-group-field';
          label.textContent = translate(tr, en);
          const input = document.createElement('input');
          input.type = field === 'price' ? 'number' : 'text';
          if (field === 'price') {
            input.min = '0';
            input.step = '0.01';
          }
          input.value = row[field] ?? '';
          input.oninput = () => {
            const rows = read();
            rows[index][field] = field === 'price' ? Number(input.value) : input.value;
            source.value = JSON.stringify(rows);
          };
          label.append(input);
          card.append(label);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'chrome-btn-outline';
        remove.textContent = __('subs.remove_btn');
        remove.onclick = () => {
          source.value = JSON.stringify(read().filter((_, i) => i !== index));
          paint();
        };
        card.append(remove);
        box.append(card);
      });
    };
    add.onclick = () => {
      source.value = JSON.stringify([
        ...read(),
        key === 'ticketCategories'
          ? { name: '', price: 0, currency: 'TRY', salesStatus: 'open' }
          : { name: '', role: '', img: '' },
      ]);
      paint();
    };
    refreshers.push(paint);
  }
  const source = form.elements.translations;
  source.hidden = true;
  source.previousElementSibling.textContent = __('events.ui.contentByLanguage');
  const box = document.createElement('div');
  box.className = 'form-grid';
  source.after(box);
  const select = document.createElement('select');
  select.setAttribute('aria-label', __('events.ui.contentLanguage'));
  for (const lang of ['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'id', 'ru', 'ja', 'ko', 'zh', 'hi', 'ar', 'az']) {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang.toUpperCase();
    select.append(option);
  }
  box.append(select);
  const controls = {};
  for (const [key, tr, en] of [
    ['title', 'weekly_stars.title_label', 'weekly_stars.title_label'],
    ['desc', 'chat.description_label', 'chat.description_label'],
    ['detailDesc', 'events.ui.content', 'events.ui.content'],
    ['location', 'beacons.location', 'beacons.location'],
  ]) {
    const label = document.createElement('label');
    label.className = 'form-group-field';
    label.textContent = translate(tr, en);
    const input = document.createElement(key === 'title' || key === 'location' ? 'input' : 'textarea');
    input.oninput = () => {
      const translations = JSON.parse(source.value || '{}');
      translations[select.value] = { ...translations[select.value], [key]: input.value };
      source.value = JSON.stringify(translations);
    };
    controls[key] = input;
    label.append(input);
    box.append(label);
  }
  const paint = () => {
    const t = JSON.parse(source.value || '{}')[select.value] || {};
    for (const [key, input] of Object.entries(controls)) input.value = t[key] || '';
  };
  select.onchange = paint;
  refreshers.push(paint);
  return () => refreshers.forEach((refresh) => refresh());
}
