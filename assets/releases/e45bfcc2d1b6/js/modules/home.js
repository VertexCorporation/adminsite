import { getLang, onLangChange } from '../utils/ui.js';
import { displayDepartmentName } from '../utils/departments.js';
import { getEffectivePanelLevel, isPanelAdmin } from './roles.js';
import { icon } from '../utils/icons.js';

const COPY = {"tr":{"eyebrow":"VERTEX KONSOL","welcome":"Tekrar hoş geldin","noName":"Tekrar hoş geldin.","intro":"Vertex'in ekiplerini, süreçlerini ve teknolojilerini bir araya getiren çalışma alanındasın. Birlikte üretmek için ihtiyaç duyduğun araçlara buradan ulaşabilirsin.","identity":"Kişisel çalışma alanın","admin":"Yönetici","member":"Ekip üyesi","department":"Departman","howStart":"Başlamak için erişimine açık bir modül seçebilir veya aşağı kaydırarak Vertex'i yakından tanıyabilirsin.","overviewEyebrow":"03 | ÇALIŞMA ALANI","overviewTitle":"Tek bir merkez. Birlikte çalışan bir ekosistem.","overview":["Vertex Konsol, Vertex organizasyonunun dijital yönetim ve çalışma ortamıdır. Farklı alanlarda faaliyet gösteren ekiplerimizin ortak bir yapı içerisinde çalışmasını, süreçlerin takip edilebilir olmasını ve operasyonel kaynakların merkezi olarak yönetilmesini sağlamak amacıyla geliştirilmiştir.","Vertex olarak teknoloji üretmenin yalnızca yazılım geliştirmekten ibaret olmadığına inanıyoruz. Teknolojinin çalışma biçimlerimizi, iletişim alışkanlıklarımızı ve organizasyonel verimliliğimizi de ileri taşıması gerektiğini düşünüyoruz.","Bu nedenle Vertex Konsol'u, organizasyonumuzun ihtiyaçları doğrultusunda gelişen ve farklı sistemleri birbiriyle ilişkilendiren bir dijital merkez olarak konumlandırıyoruz."],"modulesEyebrow":"04 | KONSOLDA BAŞLA","modulesTitle":"Konsolu nasıl kullanabilirsin?","modulesLead":"Sol menü günlük iş akışına ulaşmanın en kısa yolu. Burada yalnızca mevcut yetkilerin kapsamında erişebildiğin alanları görürsün. Bir kart seçtiğinde ilgili çalışma alanına gidersin.","noModules":"Şu anda kullanabileceğin modül listelenmiyor. Erişim ihtiyaçların için yetkili ekip ile iletişime geçebilirsin.","modules":{"contributors":["Katılımcılar","Katılımcı ve başvuru kayıtlarını, erişiminin izin verdiği kapsamda incele."],"models":["Modeller","Yapay zekâ modellerinin kataloğunu veya sana açılmış yönetim alanını kullan."],"news":["Haberler","Vertex duyurularını takip et, yetkin varsa yayın süreçlerine katıl."],"notifications":["Bildirim","İzinli bildirim ve zamanlanmış iletişim alanlarında çalış."],"subscriptions":["Abonelik","Erişimin olan abonelik kayıtlarını ve ilgili operasyonları görüntüle."],"chat":["Sohbet","Konsol içi iletişim alanına geç ve ekiplerle koordinasyon kur."],"system":["Sistem","Yalnızca yetki verilmiş sistem ve organizasyon yönetimi araçlarına ulaş."]},"cultureEyebrow":"05 | ÇALIŞMA KÜLTÜRÜ","cultureTitle":"Birlikte çalışma biçimimiz","culture":["Vertex'te farklı departmanlar ayrı sorumluluklar üstlense de aynı hedef üzerinde birlikte çalışır. Ürün geliştirme, iletişim, operasyon ve insan süreçleri arasında bilgi akışı kurulması; kararların daha açık, işlerin daha sürdürülebilir olmasını sağlar.","Ortak çalışma alanlarını, yalnızca dosya depolamak için değil, kurumsal hafızayı güçlendirmek için kullanırız. Bir belgenin doğru yerde bulunması, bir değişikliğin ilgili kişilere ulaşması ve önemli kararların izlenebilmesi, günlük çalışma kültürümüzün parçasıdır.","Yetki ve sorumlulukların açık tanımlanması, hem güvenliği hem de ekiplerin bağımsız çalışabilmesini destekler. Herkesin her araca ulaşması gerekmez; önemli olan doğru kişinin ihtiyaç duyduğu kaynağa erişebilmesidir.","Öğrenmeye, denemeye ve üretmeye alan açıyoruz. Yapay zekâ ve otomasyon, insanların yerini almak için değil, tekrarlanan işleri azaltmak ve daha nitelikli çalışmaya zaman kazandırmak için iş akışlarımıza dahil ediliyor."],"benefitsEyebrow":"06 | GELİŞİM VE TAKDİR","benefitsTitle":"Sertifikalar ve ekip avantajları","benefits":["Vertex'in dijital sertifikasyon sistemi, uygun ekip üyelerinin belirli katkılarını, devamlılığını ve başarılarını belgelenebilir hâle getirir. Doğrulanabilir sertifikalar, kazanımların yalnızca kurum içinde kalmayıp gerektiğinde profesyonel ortamlarda da paylaşılabilmesini sağlar.","Doğrulama altyapısı, bir sertifikanın geçerliliğinin kontrol edilebilmesi için tasarlanmıştır. Sertifika türü, düzenlenme koşulları ve kullanıcıya sunulan belgeler ilgili operasyonel kurallara bağlıdır.","Ekip üyelerine belirli teknoloji ve ürün avantajları da tanımlanabilir. Cortex Plus bunlara örnektir; ancak üyelik, sertifika veya abonelik hakkı herkes için koşulsuz ve otomatik değildir. Güncel hakların ve erişimin, ilgili sistemlerin doğrulanmış kayıtlarıyla belirlenir."],"closing":["Vertex, yalnızca geliştirdiğimiz teknolojilerden oluşmuyor. Onları mümkün kılan insanlardan, paylaştığımız fikirlerden ve birlikte oluşturduğumuz çalışma kültüründen oluşuyor.","Burada attığın her adım, bu ekosistemin gelişimine katkıda bulunuyor.","Vertex'e hoş geldin."],"tagline":"Built for what's next.","steps":["TANIŞ","KEŞFET","KATKI SUN"],"productsEyebrow":"01 | VERTEX'İN GELİŞTİRDİKLERİ","productsTitle":"Birbirini tamamlayan dört teknoloji.","productsLead":"Vertex'in geliştirdiği ürünler ve altyapılar farklı ihtiyaçlara odaklanıyor. Hepsi aynı ekosistemin parçası.","products":{"cortex":{"name":"Cortex","role":"Yapay zekâ platformu","description":"Araştırma, öğrenme ve üretim deneyimlerini yapay zekâ ile buluşturan Vertex platformu."},"ally":{"name":"Ally","role":"Akıllı yardımcılar","description":"Kullanıcılara ve ekiplere günlük görevlerinde destek olmak için tasarlanan yardımcı deneyimler."},"mergen":{"name":"Mergen","role":"Yapay zekâ mimarisi","description":"Modellerin, servislerin ve veri akışlarının birlikte çalışmasını hedefleyen yapay zekâ mimarisi."},"fulcrum":{"name":"Fulcrum","role":"Ortak sunucu altyapısı","description":"Vertex servisleri için ortak sunucu bileşenlerini ve operasyonel süreçleri bir araya getiren altyapı."}},"technologyEyebrow":"02 | KULLANDIĞIMIZ TEKNOLOJİLER","technologyTitle":"İyi araçlar, daha iyi iş akışları.","technologyLead":"Geliştirdiğimiz sistemleri desteklemek ve ekiplerin işini kolaylaştırmak için seçtiğimiz teknolojilerden bazıları:","technology":{"firebase":"Kimlik doğrulama, uygulama verileri ve ilgili bulut servisleri için.","workspace":"Paylaşımlı Drive alanları, belgeler ve ekip içi koordinasyon için.","zapier":"Tekrarlanan görevleri ve sistemler arası iş akışlarını otomatikleştirmek için.","cal":"Görüşme ve toplantı planlamasını daha düzenli yürütmek için."},"technologyNote":"Bu teknolojilerle bağlantılı, yetkine açık bazı işlemleri ilgili servisleri ayrı ayrı açmadan doğrudan Vertex Konsol üzerinden yürütebilirsin. Her aracın bütün özelliklerinin burada bulunduğu veya tüm kullanıcılara açık olduğu anlamına gelmez."},"en":{"eyebrow":"VERTEX CONSOLE","welcome":"Welcome back","noName":"Welcome back.","intro":"You're in the workspace connecting Vertex's teams, processes, and technologies. Find the tools you need to build together, all in one place.","identity":"Your workspace","admin":"Administrator","member":"Team member","department":"Department","howStart":"Open a module available to you or scroll down to get to know Vertex.","overviewEyebrow":"03 | WORKSPACE","overviewTitle":"One center. A connected ecosystem.","overview":["Vertex Console is the digital management and work environment of the Vertex organization. It helps teams working across different disciplines collaborate within a shared structure, keep processes traceable, and coordinate operational resources centrally.","We believe building technology means more than writing software. Technology should also improve how we work, communicate, and organize our efforts.","For this reason, Vertex Console is an evolving digital hub that connects systems according to the needs of our organization."],"modulesEyebrow":"04 | GET STARTED","modulesTitle":"How can you use the console?","modulesLead":"The sidebar is the quickest way into your daily workflow. You will only see modules available under your current permissions. Select a card to open that workspace.","noModules":"There are no accessible modules to show right now. Contact the responsible team if you need additional access.","modules":{"contributors":["Participants","Review participant and application records within your granted permissions."],"models":["Models","Explore the AI model library or manage models if permitted."],"news":["News","Read Vertex updates and contribute to publishing if authorized."],"notifications":["Notifications","Work with permitted messages and scheduled notifications."],"subscriptions":["Subscriptions","View subscription records and workflows that you can access."],"chat":["Chat","Open the console's communication area to coordinate with your team."],"system":["System","Access only the administrative tools explicitly available to you."]},"cultureEyebrow":"05 | WORK CULTURE","cultureTitle":"How we work together","culture":["Different departments at Vertex have distinct responsibilities but contribute toward shared goals. Coordination across product, communications, operations, and people teams keeps decisions clear and work sustainable.","Shared workspaces are more than storage: they preserve institutional knowledge. Clear document locations, accessible updates, and traceable decisions support our everyday work.","Explicit responsibilities and permissions improve security and enable teams to work independently. The goal is for the right people to access the right resources.","We keep learning, experimenting, and building. AI and automation help reduce repetitive work so people can focus on meaningful contributions."],"benefitsEyebrow":"06 | GROWTH AND RECOGNITION","benefitsTitle":"Certificates and team benefits","benefits":["Vertex's digital certification system can document eligible team members' contributions, commitment, and achievements. Verifiable certificates make those milestones easier to share professionally.","Verification infrastructure helps confirm a certificate's validity. Certificate categories, issuance criteria, and records follow the relevant operational rules.","Eligible team members may also receive product and technology benefits, including Cortex Plus. These benefits are not automatically granted to everyone; confirmed entitlements determine access."],"closing":["Vertex is more than the technologies we build. It is the people who make them possible, the ideas we share, and the culture we create together.","Every step you take here contributes to the growth of this ecosystem.","Welcome to Vertex."],"tagline":"Built for what's next.","steps":["CONNECT","EXPLORE","CONTRIBUTE"],"productsEyebrow":"01 | BUILT BY VERTEX","productsTitle":"Four connected technologies.","productsLead":"The products and infrastructure developed by Vertex address different needs, all within one ecosystem.","products":{"cortex":{"name":"Cortex","role":"AI platform","description":"The Vertex platform connecting research, learning, and creation with artificial intelligence."},"ally":{"name":"Ally","role":"Intelligent assistants","description":"Assistant experiences designed to support teams and users with everyday tasks."},"mergen":{"name":"Mergen","role":"AI architecture","description":"An AI architecture designed to connect models, services, and data flows."},"fulcrum":{"name":"Fulcrum","role":"Shared server infrastructure","description":"Shared server components and operational infrastructure for Vertex services."}},"technologyEyebrow":"02 | TECHNOLOGIES WE USE","technologyTitle":"Useful tools. Better workflows.","technologyLead":"Some of the technologies supporting what we build and making collaboration easier:","technology":{"firebase":"For authentication, application data, and relevant cloud services.","workspace":"For shared Drive spaces, documents, and team coordination.","zapier":"For automating recurring tasks and workflows across systems.","cal":"For organizing meetings and appointment scheduling."},"technologyNote":"Some authorized workflows connected to these technologies can be handled directly in Vertex Console, without opening each service separately. This does not mean every feature is integrated or available to everyone."}};
const MODULE_IDS = ['contributors', 'models', 'news', 'notifications', 'subscriptions', 'chat', 'system'];
const ICONS = { contributors:'users-group', models:'robot', news:'news', notifications:'bell', subscriptions:'crown', chat:'messages', system:'settings' };
const PRODUCTS = [
    { id: 'cortex', icon: 'robot' },
    { id: 'ally', icon: 'users-group' },
    { id: 'mergen', icon: 'database' },
    { id: 'fulcrum', icon: 'server' }
];
const TECHNOLOGIES = [
    { id: 'firebase', name: 'Firebase', image: 'assets/technology/firebase.svg' },
    { id: 'workspace', name: 'Google Workspace', image: 'assets/technology/google-drive.svg' },
    { id: 'zapier', name: 'Zapier', image: 'assets/technology/zapier.svg' },
    { id: 'cal', name: 'Cal.com', image: 'assets/technology/cal.svg' }
];
let context = null;
let initialized = false;

function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
}
function copy() { return COPY[getLang()] || COPY.tr; }
function paragraph(parent, value, cls) { parent.append(el('p', cls || '', value)); }
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
    return links.find(link => !link.hidden && link.dataset.navPanel.split(',').some(key =>
        getEffectivePanelLevel(key) !== 'none' && (key !== 'system.deptPerms' || isPanelAdmin())
    )) || null;
}
function addModuleCards(target, t) {
    const grid = el('div', 'home-module-grid');
    for (const moduleId of MODULE_IDS) {
        if (!visibleTarget(moduleId)) continue;
        const details = t.modules[moduleId];
        const card = el('button', 'home-module-card');
        card.type = 'button';
        const mark = el('span', 'home-module-icon');
        mark.innerHTML = icon(ICONS[moduleId], {size:23});
        const arrow = el('span', 'home-module-arrow');
        arrow.innerHTML = icon('arrow-right', {size:18});
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
function renderHome() {
    const root = document.getElementById('home-root');
    if (!root) return;
    root.replaceChildren();
    if (!context) return;
    const t = copy();
    const hero = el('section', 'home-hero');
    const heroCopy = el('div', 'home-hero-copy');
    heroCopy.append(el('span', 'home-eyebrow', t.eyebrow));
    const firstName = context.name?.trim().split(/\s+/)[0];
    heroCopy.append(el('h1', 'home-title', firstName ? t.welcome + ', ' + firstName + '.' : t.noName));
    paragraph(heroCopy, t.intro, 'home-lead');
    const identity = el('div', 'home-identity');
    if (context.isAdmin || context.departments.length) {
        const role = el('span', 'home-identity-chip');
        role.innerHTML = icon(context.isAdmin ? 'shield-check' : 'user-circle', {size:15});
        role.append(document.createTextNode(context.isAdmin ? t.admin : t.member));
        identity.append(role);
    }
    if (context.departments.length) {
        const department = el('span', 'home-identity-chip');
        department.innerHTML = icon('building-community', {size:15});
        department.append(document.createTextNode(t.department + ': ' + context.departments.map(displayDepartmentName).join(', ')));
        identity.append(department);
    }
    heroCopy.append(identity);
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
    t.overview.forEach(line => paragraph(overviewBody, line));
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
    t.benefits.forEach(line => paragraph(benefitBody, line));
    benefits.append(benefitBody);
    const closing = el('footer', 'home-closing');
    t.closing.forEach((line, i) => paragraph(closing, line, i === t.closing.length - 1 ? 'home-final-line' : ''));
    const signature = el('div', 'home-signature');
    const smallLogo = document.createElement('img');
    smallLogo.src = 'assets/vertex-logo.svg';
    smallLogo.alt = 'Vertex';
    signature.append(smallLogo, el('span', '', t.tagline));
    closing.append(signature);
    root.append(closing);
}
export function updateHome(user, isAdmin, departments) {
    context = user ? {
        name: typeof user.displayName === 'string' ? user.displayName : '',
        isAdmin: isAdmin === true,
        departments: Array.isArray(departments) ? departments.filter(value => typeof value === 'string' && value.trim()) : []
    } : null;
    renderHome();
}
export function initHomeModule() {
    if (initialized) return;
    initialized = true;
    onLangChange(renderHome);
}
