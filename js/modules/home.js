import { __ } from '../utils/ui.js';
import { getLang, onLangChange } from '../utils/ui.js';
import { displayDepartmentName } from '../utils/departments.js';
import { getEffectivePanelLevel, isPanelAdmin } from './roles.js';
import { icon } from '../utils/icons.js';

const MODULE_IDS = ['users', 'origin', 'contributors', 'models', 'publications', 'subscriptions', 'scene', 'system'];
const ICONS = {
  origin: 'crown',
  users: 'users-group',
  publications: 'news',
  scene: 'award',
  contributors: 'users-group',
  models: 'robot',
  news: 'news',
  notifications: 'bell',
  subscriptions: 'crown',
  chat: 'messages',
  system: 'settings',
};
const PRODUCTS = [
  { id: 'cortex', icon: 'robot' },
  { id: 'ally', icon: 'users-group' },
  { id: 'mergen', icon: 'database' },
  { id: 'fulcrum', icon: 'server' },
];
const TECHNOLOGIES = [
  {
    id: 'firebase',
    name: 'Firebase',
    image: 'assets/technology/firebase.svg',
  },
  {
    id: 'workspace',
    name: 'Google Workspace',
    image: 'assets/technology/google-drive.svg',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    image: 'assets/technology/zapier.svg',
  },
  {
    id: 'cal',
    name: 'Cal.com',
    image: 'assets/technology/cal.svg',
  },
  {
    id: 'fal',
    name: 'fal',
    image: 'assets/technology/fal.svg',
  },
  {
    id: 'miro',
    name: 'Miro',
    image: 'assets/technology/miro.svg',
  },
  {
    id: 'secret',
    name: 'Secret.',
    image: 'https://www.google.com/s2/favicons?domain=joinsecret.com&sz=128',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    image: 'assets/technology/elevenlabs.svg',
  },
  {
    id: 'daytona',
    name: 'Daytona',
    image: 'assets/technology/daytona.svg',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    image: 'assets/technology/gitlab.svg',
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    image: 'assets/technology/assemblyai.svg',
  },
  {
    id: 'github',
    name: 'GitHub',
    image: 'assets/technology/github.svg',
  },
  {
    id: 'granola',
    name: 'Granola',
    image: 'assets/technology/granola.svg',
  },
  {
    id: 'composio',
    name: 'Composio',
    image: 'assets/technology/composio.svg',
  },
  {
    id: 'deepgram',
    name: 'Deepgram',
    image: 'assets/technology/deepgram.svg',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    image: 'assets/technology/cloudflare.svg',
  },
];
let context = null;
let initialized = false;

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function copy() {
  return {
    eyebrow: __('homeCopy.eyebrow'),
    welcome: __('homeCopy.welcome'),
    noName: __('homeCopy.noName'),
    intro: __('homeCopy.intro'),
    identity: __('homeCopy.identity'),
    admin: __('homeCopy.admin'),
    member: __('homeCopy.member'),
    department: __('homeCopy.department'),
    howStart: __('homeCopy.howStart'),
    overviewEyebrow: __('homeCopy.overviewEyebrow'),
    overviewTitle: __('homeCopy.overviewTitle'),
    overview: [__('homeCopy.overview.0'), __('homeCopy.overview.1'), __('homeCopy.overview.2')],
    modulesEyebrow: __('homeCopy.modulesEyebrow'),
    modulesTitle: __('homeCopy.modulesTitle'),
    modulesLead: __('homeCopy.modulesLead'),
    noModules: __('homeCopy.noModules'),
    modules: {
      contributors: [__('homeCopy.modules.contributors.0'), __('homeCopy.modules.contributors.1')],
      models: [__('homeCopy.modules.models.0'), __('homeCopy.modules.models.1')],
      news: [__('homeCopy.modules.news.0'), __('homeCopy.modules.news.1')],
      notifications: [__('homeCopy.modules.notifications.0'), __('homeCopy.modules.notifications.1')],
      subscriptions: [__('homeCopy.modules.subscriptions.0'), __('homeCopy.modules.subscriptions.1')],
      chat: [__('homeCopy.modules.chat.0'), __('homeCopy.modules.chat.1')],
      system: [__('homeCopy.modules.system.0'), __('homeCopy.modules.system.1')],
      users: [__('homeCopy.modules.users.0'), __('homeCopy.modules.users.1')],
      publications: [__('homeCopy.modules.publications.0'), __('homeCopy.modules.publications.1')],
      scene: [__('homeCopy.modules.scene.0'), __('homeCopy.modules.scene.1')],
      origin: [__('homeCopy.modules.origin.0'), __('homeCopy.modules.origin.1')],
    },
    cultureEyebrow: __('homeCopy.cultureEyebrow'),
    cultureTitle: __('homeCopy.cultureTitle'),
    culture: [__('homeCopy.culture.0'), __('homeCopy.culture.1'), __('homeCopy.culture.2'), __('homeCopy.culture.3')],
    benefitsEyebrow: __('homeCopy.benefitsEyebrow'),
    benefitsTitle: __('homeCopy.benefitsTitle'),
    benefits: [__('homeCopy.benefits.0'), __('homeCopy.benefits.1'), __('homeCopy.benefits.2')],
    closing: [__('homeCopy.closing.0'), __('homeCopy.closing.1'), __('homeCopy.closing.2')],
    tagline: __('homeCopy.tagline'),
    steps: [__('homeCopy.steps.0'), __('homeCopy.steps.1'), __('homeCopy.steps.2')],
    productsEyebrow: __('homeCopy.productsEyebrow'),
    productsTitle: __('homeCopy.productsTitle'),
    productsLead: __('homeCopy.productsLead'),
    products: {
      cortex: {
        name: __('homeCopy.products.cortex.name'),
        role: __('homeCopy.products.cortex.role'),
        description: __('homeCopy.products.cortex.description'),
      },
      ally: {
        name: __('homeCopy.products.ally.name'),
        role: __('homeCopy.products.ally.role'),
        description: __('homeCopy.products.ally.description'),
      },
      mergen: {
        name: __('homeCopy.products.mergen.name'),
        role: __('homeCopy.products.mergen.role'),
        description: __('homeCopy.products.mergen.description'),
      },
      fulcrum: {
        name: __('homeCopy.products.fulcrum.name'),
        role: __('homeCopy.products.fulcrum.role'),
        description: __('homeCopy.products.fulcrum.description'),
      },
    },
    technologyEyebrow: __('homeCopy.technologyEyebrow'),
    technologyTitle: __('homeCopy.technologyTitle'),
    technologyLead: __('homeCopy.technologyLead'),
    technology: {
      firebase: __('homeCopy.technology.firebase'),
      workspace: __('homeCopy.technology.workspace'),
      zapier: __('homeCopy.technology.zapier'),
      cal: __('homeCopy.technology.cal'),
      fal: __('homeCopy.technology.fal'),
      miro: __('homeCopy.technology.miro'),
      secret: __('homeCopy.technology.secret'),
      elevenlabs: __('homeCopy.technology.elevenlabs'),
      daytona: __('homeCopy.technology.daytona'),
      gitlab: __('homeCopy.technology.gitlab'),
      assemblyai: __('homeCopy.technology.assemblyai'),
      github: __('homeCopy.technology.github'),
      granola: __('homeCopy.technology.granola'),
      composio: __('homeCopy.technology.composio'),
      deepgram: __('homeCopy.technology.deepgram'),
      cloudflare: __('homeCopy.technology.cloudflare'),
    },
    technologyNote: __('homeCopy.technologyNote'),
    pageAriaLabel: __('homeCopy.pageAriaLabel'),
  };
}
function paragraph(parent, value, cls) {
  parent.append(el('p', cls || '', value));
}
function section(parent, eyebrow, heading, className) {
  const wrap = el('section', 'home-section ' + (className || ''));
  wrap.append(el('span', 'home-eyebrow', eyebrow), el('h2', 'home-heading', heading));
  parent.append(wrap);
  return wrap;
}
function visibleTarget(moduleId) {
  const module = document.querySelector('.nav-module[data-nav-module="' + moduleId + '"]');
  const button = module?.querySelector('.dock-btn');
  if (!module || module.hidden || !button || button.style.display === 'none') return null;
  if (moduleId === 'chat') return button;
  const links = [...module.querySelectorAll('[data-nav-panel]')];
  return (
    links.find(
      (link) =>
        !link.hidden &&
        link.dataset.navPanel
          .split(',')
          .some((key) => getEffectivePanelLevel(key) !== 'none' && (key !== 'system.deptPerms' || isPanelAdmin())),
    ) || null
  );
}
function addModuleCards(target, t) {
  const grid = el('div', 'home-module-grid');
  for (const moduleId of MODULE_IDS) {
    if (!visibleTarget(moduleId)) continue;
    const details = t.modules[moduleId];
    const card = el('button', 'home-module-card');
    card.type = 'button';
    const mark = el('span', 'home-module-icon');
    mark.innerHTML = icon(ICONS[moduleId], { size: 23 });
    const arrow = el('span', 'home-module-arrow');
    arrow.innerHTML = icon('arrow-right', { size: 18 });
    const name = el('strong', 'home-module-name', details[0]);
    paragraph(card, details[1], 'home-module-description');
    card.prepend(mark, name);
    card.append(arrow);
    card.addEventListener('click', () => {
      const destination = visibleTarget(moduleId);
      if (destination) destination.click();
      else renderHome();
    });
    grid.append(card);
  }
  if (!grid.children.length) paragraph(target, t.noModules, 'home-muted');
  else target.append(grid);
}
// Informational orientation only: not an editable responsibility tracker or a permission source.
// Stored department identifiers and their permissions remain unchanged.

function departmentGuidance(departments, language) {
  const descriptions = Object.fromEntries(
    ['core', 'senatus', 'tensor', 'curia', 'pulse', 'chroma', 'catalyst', 'envoy', 'aero', 'array'].map((key) => [
      key,
      __('guidance.' + key),
    ]),
  );
  return departments
    .map((name) => {
      const detail = descriptions[String(name).trim().toLowerCase()];
      return detail ? displayDepartmentName(name) + ': ' + detail : null;
    })
    .filter(Boolean);
}
function renderHome() {
  const root = document.getElementById('home-root');
  if (!root) return;
  root.replaceChildren();
  if (!context) return;
  const t = copy();
  document.getElementById('tab-home')?.setAttribute('aria-label', t.pageAriaLabel);
  const hero = el('section', 'home-hero');
  const heroCopy = el('div', 'home-hero-copy');
  heroCopy.append(el('span', 'home-eyebrow', t.eyebrow));
  const firstName = context.name?.trim().split(/\s+/)[0];
  heroCopy.append(el('h1', 'home-title', firstName ? t.welcome + ', ' + firstName + '.' : t.noName));
  paragraph(heroCopy, t.intro, 'home-lead');
  const identity = el('div', 'home-identity');
  if (context.isAdmin || context.departments.length) {
    const role = el('span', 'home-identity-chip');
    role.innerHTML = icon(context.isAdmin ? 'shield-check' : 'user-circle', { size: 15 });
    role.append(document.createTextNode(context.isAdmin ? t.admin : t.member));
    identity.append(role);
  }
  if (context.departments.length) {
    const department = el('span', 'home-identity-chip');
    department.innerHTML = icon('building-community', { size: 15 });
    department.append(
      document.createTextNode(t.department + ': ' + context.departments.map(displayDepartmentName).join(', ')),
    );
    identity.append(department);
  }
  heroCopy.append(identity);
  // Never list departments outside the signed-in participant's visible assignment.
  const guidance = departmentGuidance(context.departments, getLang());
  if (guidance.length) paragraph(heroCopy, guidance.join(' · '), 'home-start-note');
  paragraph(heroCopy, t.howStart, 'home-start-note');
  hero.append(heroCopy);
  // A lightweight, decorative motion study: no logo, canvas loop or runtime animation.
  const visual = el('div', 'home-hero-art');
  visual.setAttribute('aria-hidden', 'true');
  visual.innerHTML = `<svg class="home-flow-svg" viewBox="0 0 700 420" preserveAspectRatio="xMidYMid meet" focusable="false">
      <defs>
        <linearGradient id="home-flow-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0"/>
          <stop offset="36%" stop-color="currentColor" stop-opacity=".42"/>
          <stop offset="68%" stop-color="currentColor" stop-opacity=".74"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g class="home-flow-layer home-flow-layer-back" fill="none" stroke="url(#home-flow-stroke)" stroke-width="1">
        <path d="M-80 259 C120 75 182 376 390 188 S612 144 795 218"/>
        <path d="M-70 278 C118 104 200 393 404 216 S635 166 796 235"/>
        <path d="M-80 296 C122 140 214 404 425 242 S638 193 795 256"/>
        <path d="M-70 315 C132 174 231 420 444 272 S650 215 796 276"/>
      </g>
      <g class="home-flow-layer home-flow-layer-front" fill="none" stroke="url(#home-flow-stroke)" stroke-width="2">
        <path d="M-80 230 C110 48 178 352 370 165 S617 115 790 199"/>
        <path d="M-80 345 C102 224 258 435 455 305 S653 249 794 313"/>
      </g>
      <path class="home-flow-highlight" d="M-80 260 C118 82 192 376 400 191 S628 145 793 220"
        fill="none" stroke="currentColor" stroke-opacity=".60" stroke-width="2.2" stroke-linecap="round"
        stroke-dasharray="2 32 55 380"/>
      <path class="home-flow-highlight home-flow-highlight-secondary" d="M-80 345 C102 224 258 435 455 305 S653 249 794 313"
        fill="none" stroke="currentColor" stroke-opacity=".42" stroke-width="1.7" stroke-linecap="round"
        stroke-dasharray="2 15 95 440"/>
    </svg>`;
  hero.append(visual);
  root.append(hero);
  const products = section(root, t.productsEyebrow, t.productsTitle, 'home-products');
  paragraph(products, t.productsLead, 'home-section-intro');
  const productGrid = el('div', 'home-product-grid');
  for (const item of PRODUCTS) {
    const entry = t.products[item.id];
    const card = el('article', 'home-product-card');
    const top = el('div', 'home-product-top');
    const mark = el('span', 'home-product-icon');
    mark.innerHTML = icon(item.icon, { size: 22, strokeWidth: 1.6 });
    top.append(mark, el('span', 'home-product-index', String(PRODUCTS.indexOf(item) + 1).padStart(2, '0')));
    card.append(top);
    card.append(el('h3', 'home-product-title', entry.name));
    card.append(el('span', 'home-product-role', entry.role));
    paragraph(card, entry.description, 'home-product-description');
    productGrid.append(card);
  }
  products.append(productGrid);

  const technology = section(root, t.technologyEyebrow, t.technologyTitle, 'home-technology');
  paragraph(technology, t.technologyLead, 'home-section-intro');
  const techGrid = el('div', 'home-technology-grid');
  for (const item of TECHNOLOGIES) {
    const card = el('article', 'home-tech-card');
    const brand = el('div', 'home-tech-brand');
    const mark = el('span', 'home-tech-logo');
    const logo = document.createElement('img');
    logo.src = item.image;
    logo.alt = '';
    logo.width = 25;
    logo.height = 25;
    logo.loading = 'lazy';
    logo.decoding = 'async';
    // A failed remote favicon should never display a broken image placeholder.
    logo.addEventListener(
      'error',
      () => {
        logo.remove();
        if (!mark.firstChild) mark.append(el('span', 'home-tech-fallback', item.name.slice(0, 1)));
      },
      { once: true },
    );
    mark.append(logo);
    brand.append(mark, el('h3', 'home-tech-name', item.name));
    card.append(brand);
    paragraph(card, t.technology[item.id], 'home-tech-reason');
    techGrid.append(card);
  }
  technology.append(techGrid);
  paragraph(technology, t.technologyNote, 'home-technology-note');

  const overview = section(root, t.overviewEyebrow, t.overviewTitle, 'home-overview');
  const overviewBody = el('div', 'home-prose');
  t.overview.forEach((line) => paragraph(overviewBody, line));
  overview.append(overviewBody);
  const modules = section(root, t.modulesEyebrow, t.modulesTitle, 'home-modules');
  paragraph(modules, t.modulesLead, 'home-section-intro');
  addModuleCards(modules, t);
  const culture = section(root, t.cultureEyebrow, t.cultureTitle, 'home-culture');
  const cultureGrid = el('div', 'home-culture-grid');
  t.culture.forEach((line, index) => {
    const item = el('article', 'home-culture-item');
    item.append(el('span', 'home-culture-number', String(index + 1).padStart(2, '0')));
    paragraph(item, line);
    cultureGrid.append(item);
  });
  culture.append(cultureGrid);
  const benefits = section(root, t.benefitsEyebrow, t.benefitsTitle, 'home-benefits');
  const benefitBody = el('div', 'home-prose');
  t.benefits.forEach((line) => paragraph(benefitBody, line));
  benefits.append(benefitBody);
  const closing = el('footer', 'home-closing');
  t.closing.forEach((line, i) => paragraph(closing, line, i === t.closing.length - 1 ? 'home-final-line' : ''));
  const signature = el('div', 'home-signature');
  const smallLogo = document.createElement('img');
  smallLogo.src = 'assets/vertex-logo.svg';
  smallLogo.alt = __('home.ui.vertex');
  signature.append(smallLogo, el('span', '', t.tagline));
  closing.append(signature);
  root.append(closing);
}
export function updateHome(user, isAdmin, departments) {
  context = user
    ? {
        name: typeof user.displayName === 'string' ? user.displayName : '',
        isAdmin: isAdmin === true,
        departments: Array.isArray(departments)
          ? departments.filter((value) => typeof value === 'string' && value.trim())
          : [],
      }
    : null;
  renderHome();
}
export function initHomeModule() {
  if (initialized) return;
  initialized = true;
  onLangChange(renderHome);
}
