import { getLang, onLangChange } from '../utils/ui.js';
import { displayDepartmentName } from '../utils/departments.js';
import { getEffectivePanelLevel, isPanelAdmin } from './roles.js';
import { icon } from '../utils/icons.js';

const COPY = {"tr":{"eyebrow":"VERTEX KONSOL / DİJİTAL ÇALIŞMA ALANI","welcome":"Tekrar hoş geldin","noName":"Tekrar hoş geldin.","intro":"Vertex'in dijital çalışma alanına hoş geldin. Burada yalnızca araçlara değil, birlikte geliştirdiğimiz teknoloji ekosistemine, çalışma kültürümüze ve operasyonel süreçlerimize açılan bir kapı bulacaksın.","identity":"Kişisel çalışma alanın","admin":"Yönetici","member":"Ekip üyesi","department":"Departman","howStart":"Başlamak için sana açık olan modüllerden birini seçebilir veya aşağı kaydırarak Vertex'i daha yakından tanıyabilirsin.","overviewEyebrow":"01 / ÇALIŞMA ALANI","overviewTitle":"Tek bir merkez. Birlikte çalışan bir ekosistem.","overview":["Vertex Konsol, Vertex organizasyonunun dijital yönetim ve çalışma ortamıdır. Farklı alanlarda faaliyet gösteren ekiplerimizin ortak bir yapı içerisinde çalışmasını, süreçlerin takip edilebilir olmasını ve operasyonel kaynakların merkezi olarak yönetilmesini sağlamak amacıyla geliştirilmiştir.","Vertex olarak teknoloji üretmenin yalnızca yazılım geliştirmekten ibaret olmadığına inanıyoruz. Teknolojinin çalışma biçimlerimizi, iletişim alışkanlıklarımızı ve organizasyonel verimliliğimizi de ileri taşıması gerektiğini düşünüyoruz.","Bu nedenle Vertex Konsol'u, organizasyonumuzun ihtiyaçları doğrultusunda gelişen ve farklı sistemleri birbiriyle ilişkilendiren bir dijital merkez olarak konumlandırıyoruz."],"modulesEyebrow":"02 / YOL HARİTAN","modulesTitle":"Konsolu nasıl kullanabilirsin?","modulesLead":"Sol menü günlük iş akışına ulaşmanın en kısa yolu. Burada yalnızca mevcut yetkilerin kapsamında erişebildiğin alanları görürsün. Bir kart seçtiğinde ilgili çalışma alanına gidersin.","noModules":"Şu anda kullanabileceğin modül listelenmiyor. Erişim ihtiyaçların için yetkili ekip ile iletişime geçebilirsin.","modules":{"contributors":["Katılımcılar","Katılımcı ve başvuru kayıtlarını, erişiminin izin verdiği kapsamda incele."],"models":["Modeller","Yapay zekâ modellerinin kataloğunu veya sana açılmış yönetim alanını kullan."],"news":["Haberler","Vertex duyurularını takip et, yetkin varsa yayın süreçlerine katıl."],"notifications":["Bildirim","İzinli bildirim ve zamanlanmış iletişim alanlarında çalış."],"subscriptions":["Abonelik","Erişimin olan abonelik kayıtlarını ve ilgili operasyonları görüntüle."],"chat":["Sohbet","Konsol içi iletişim alanına geç ve ekiplerle koordinasyon kur."],"system":["Sistem","Yalnızca yetki verilmiş sistem ve organizasyon yönetimi araçlarına ulaş."]},"ecosystemEyebrow":"03 / TEKNOLOJİ EKOSİSTEMİ","ecosystemTitle":"Konsolun ötesinde: Vertex ekosistemi","ecosystemLead":"Vertex Konsol bağımsız bir uygulama değil; birden fazla teknolojinin, ortak kimliğin ve ekip operasyonlarının kesiştiği çalışma noktasıdır. Her sistem farklı bir ihtiyacı karşılar, ancak amaçları ortaktır: daha güvenilir ve birlikte yürütülebilir süreçler.","ecosystem":[["Cortex AI","YAPAY ZEKÂ","Cortex AI, Vertex'in yapay zekâ teknolojileri etrafında geliştirdiği kullanıcı deneyimlerinin bir parçasıdır. Yapay zekâyı yalnızca yeni özellikler sunan bir ürün olarak değil, araştırma, öğrenme ve üretim biçimlerini dönüştüren bir yetenek olarak ele alıyoruz.","Cortex Plus, uygun kullanıcılara veya ekip üyelerine tanımlanabilen ilave avantajları ifade eder. Bu avantajların kapsamı ve etkinliği hesabın haklarına bağlıdır; konsola erişim tek başına Cortex Plus aboneliği vermez."],["Vertex Account","ORTAK KİMLİK","Vertex Account, Vertex servisleri için ortak hesap ve kimlik yaklaşımını temsil eder. Kullanıcıların servisler arasında tutarlı bir hesap deneyimi yaşamasını ve oturumlarının ilgili güvenlik kontrolleri altında yönetilmesini hedefler.","Bir uygulamada oturum açmak, diğer bütün servislere veya yönetim araçlarına otomatik yetki verildiği anlamına gelmez. Her servisteki erişim hakkı ayrıca geçerlidir."],["Fulcrum ve sertifikasyon altyapısı","DOĞRULANABİLİR BAŞARILAR","Fulcrum, Vertex'in sertifikasyon ve bağlantılı operasyonel süreçlerinde yararlandığı altyapının önemli bir parçasıdır. Sertifika oluşturma, doğrulama ve dijital başarı kayıtlarının düzenli biçimde yönetilmesine destek olur.","Sertifikaların doğrulama adresleri, paylaşılan başarıların güvenilir şekilde kontrol edilmesini sağlar. Uygun süreçlerde e-posta ve diğer operasyonel otomasyonlar da bu akışlara eşlik edebilir."],["Google Workspace","ORTAK ÜRETİM ALANI","Google Workspace; ortak Drive alanları, belgeler, dosya paylaşımı ve ekipler arası koordinasyon için kullanılan çalışma ortamlarından biridir. Bilginin kişisel mesajlarda kaybolması yerine, doğru klasör ve belge yapılarında korunmasına yardımcı olur.","Paylaşımlı alanların tümü herkese açık değildir. Erişim, departmanına ve sana verilmiş dosya izinlerine göre değişebilir; böylece ekipler yalnızca görevleriyle ilişkili kaynaklarla çalışır."],["Toplantı ve otomasyon teknolojileri","OPERASYONEL SÜREKLİLİK","Toplantı planlama, bildirimler ve tekrarlanan görevler kurumsal işleyişin parçasıdır. Vertex bu işlemler için Cal.com gibi planlama araçlarından, Zapier gibi otomasyon servislerinden ve Firebase gibi teknik altyapı bileşenlerinden yararlanabilir.","Bu hizmetler ayrı birer Vertex ürünü veya her ekip üyesine otomatik sunulan ayrı hesaplar değildir. Kullanım, ilgili ekip süreçleri ve tanımlanmış erişimlerle sınırlıdır."]],"cultureEyebrow":"04 / İNSAN VE ORGANİZASYON","cultureTitle":"Birlikte çalışma biçimimiz","culture":["Vertex'te farklı departmanlar ayrı sorumluluklar üstlense de aynı hedef üzerinde birlikte çalışır. Ürün geliştirme, iletişim, operasyon ve insan süreçleri arasında bilgi akışı kurulması; kararların daha açık, işlerin daha sürdürülebilir olmasını sağlar.","Ortak çalışma alanlarını, yalnızca dosya depolamak için değil, kurumsal hafızayı güçlendirmek için kullanırız. Bir belgenin doğru yerde bulunması, bir değişikliğin ilgili kişilere ulaşması ve önemli kararların izlenebilmesi, günlük çalışma kültürümüzün parçasıdır.","Yetki ve sorumlulukların açık tanımlanması, hem güvenliği hem de ekiplerin bağımsız çalışabilmesini destekler. Herkesin her araca ulaşması gerekmez; önemli olan doğru kişinin ihtiyaç duyduğu kaynağa erişebilmesidir.","Öğrenmeye, denemeye ve üretmeye alan açıyoruz. Yapay zekâ ve otomasyon, insanların yerini almak için değil, tekrarlanan işleri azaltmak ve daha nitelikli çalışmaya zaman kazandırmak için iş akışlarımıza dahil ediliyor."],"benefitsEyebrow":"05 / GELİŞİM VE TAKDİR","benefitsTitle":"Sertifikalar ve ekip avantajları","benefits":["Vertex'in dijital sertifikasyon sistemi, uygun ekip üyelerinin belirli katkılarını, devamlılığını ve başarılarını belgelenebilir hâle getirir. Doğrulanabilir sertifikalar, kazanımların yalnızca kurum içinde kalmayıp gerektiğinde profesyonel ortamlarda da paylaşılabilmesini sağlar.","Doğrulama altyapısı, bir sertifikanın geçerliliğinin kontrol edilebilmesi için tasarlanmıştır. Sertifika türü, düzenlenme koşulları ve kullanıcıya sunulan belgeler ilgili operasyonel kurallara bağlıdır.","Ekip üyelerine belirli teknoloji ve ürün avantajları da tanımlanabilir. Cortex Plus bunlara örnektir; ancak üyelik, sertifika veya abonelik hakkı herkes için koşulsuz ve otomatik değildir. Güncel hakların ve erişimin, ilgili sistemlerin doğrulanmış kayıtlarıyla belirlenir."],"closing":["Vertex, yalnızca geliştirdiğimiz teknolojilerden oluşmuyor. Onları mümkün kılan insanlardan, paylaştığımız fikirlerden ve birlikte oluşturduğumuz çalışma kültüründen oluşuyor.","Burada attığın her adım, bu ekosistemin gelişimine katkıda bulunuyor.","Vertex'e hoş geldin."],"tagline":"Built for what's next.","steps":["TANIŞ","KEŞFET","KATKI SUN"]},"en":{"eyebrow":"VERTEX CONSOLE / DIGITAL WORKSPACE","welcome":"Welcome back","noName":"Welcome back.","intro":"Welcome to Vertex's digital workspace. This is your gateway not only to tools, but also to the technology ecosystem, work culture, and operational processes we build together.","identity":"Your workspace","admin":"Administrator","member":"Team member","department":"Department","howStart":"Start with a module available to you, or scroll down to discover more about Vertex.","overviewEyebrow":"01 / WORKSPACE","overviewTitle":"One center. A connected ecosystem.","overview":["Vertex Console is the digital management and work environment of the Vertex organization. It helps teams working across different disciplines collaborate within a shared structure, keep processes traceable, and coordinate operational resources centrally.","We believe building technology means more than writing software. Technology should also improve how we work, communicate, and organize our efforts.","For this reason, Vertex Console is an evolving digital hub that connects systems according to the needs of our organization."],"modulesEyebrow":"02 / GET STARTED","modulesTitle":"How can you use the console?","modulesLead":"The sidebar is the quickest way into your daily workflow. You will only see modules available under your current permissions. Select a card to open that workspace.","noModules":"There are no accessible modules to show right now. Contact the responsible team if you need additional access.","modules":{"contributors":["Participants","Review participant and application records within your granted permissions."],"models":["Models","Explore the AI model library or manage models if permitted."],"news":["News","Read Vertex updates and contribute to publishing if authorized."],"notifications":["Notifications","Work with permitted messages and scheduled notifications."],"subscriptions":["Subscriptions","View subscription records and workflows that you can access."],"chat":["Chat","Open the console's communication area to coordinate with your team."],"system":["System","Access only the administrative tools explicitly available to you."]},"ecosystemEyebrow":"03 / TECHNOLOGY ECOSYSTEM","ecosystemTitle":"Beyond the console: the Vertex ecosystem","ecosystemLead":"Vertex Console is not a stand-alone application. It connects technologies, shared identity, and team operations. Each system addresses a different need while supporting reliable collaboration.","ecosystem":[["Cortex AI","ARTIFICIAL INTELLIGENCE","Cortex AI is part of Vertex's work in AI-powered experiences. We see AI as a practical tool for research, learning, and creation—not merely as another set of product features.","Eligible users or team members may receive Cortex Plus benefits. Availability and scope depend on assigned entitlements; signing in to the console does not automatically include Cortex Plus."],["Vertex Account","SHARED IDENTITY","Vertex Account represents the shared account and identity approach across Vertex services, with consistent sign-in and appropriate session security controls.","Signing in to one service does not automatically grant access to every other service or management function. Each service enforces its own permissions."],["Fulcrum and certification","VERIFIABLE ACHIEVEMENT","Fulcrum plays an important part in Vertex's certification and related operational processes. It supports issuing certificates, verifying them, and managing digital records of achievement.","Verification links help others confirm certificate validity. Email and workflow automations may support these processes where configured."],["Google Workspace","SHARED PRODUCTION","Google Workspace supports shared Drive areas, documents, file sharing, and cross-team collaboration. Structured files and documents help preserve organizational knowledge.","Not every shared folder is available to everyone. Access is based on department responsibilities and individual file permissions."],["Meetings and automation","OPERATIONAL CONTINUITY","Meeting scheduling, notifications, and recurring tasks are part of daily operations. Vertex may use scheduling tools such as Cal.com, automation services such as Zapier, and infrastructure components such as Firebase.","These services are not separate Vertex products or guaranteed accounts for all team members. Their use follows approved workflows and access controls."]],"cultureEyebrow":"04 / PEOPLE AND ORGANIZATION","cultureTitle":"How we work together","culture":["Different departments at Vertex have distinct responsibilities but contribute toward shared goals. Coordination across product, communications, operations, and people teams keeps decisions clear and work sustainable.","Shared workspaces are more than storage: they preserve institutional knowledge. Clear document locations, accessible updates, and traceable decisions support our everyday work.","Explicit responsibilities and permissions improve security and enable teams to work independently. The goal is for the right people to access the right resources.","We keep learning, experimenting, and building. AI and automation help reduce repetitive work so people can focus on meaningful contributions."],"benefitsEyebrow":"05 / DEVELOPMENT AND RECOGNITION","benefitsTitle":"Certificates and team benefits","benefits":["Vertex's digital certification system can document eligible team members' contributions, commitment, and achievements. Verifiable certificates make those milestones easier to share professionally.","Verification infrastructure helps confirm a certificate's validity. Certificate categories, issuance criteria, and records follow the relevant operational rules.","Eligible team members may also receive product and technology benefits, including Cortex Plus. These benefits are not automatically granted to everyone; confirmed entitlements determine access."],"closing":["Vertex is more than the technologies we build. It is the people who make them possible, the ideas we share, and the culture we create together.","Every step you take here contributes to the growth of this ecosystem.","Welcome to Vertex."],"tagline":"Built for what's next.","steps":["CONNECT","EXPLORE","CONTRIBUTE"]}};
const MODULE_IDS = ['contributors', 'models', 'news', 'notifications', 'subscriptions', 'chat', 'system'];
const ICONS = { contributors:'users-group', models:'robot', news:'news', notifications:'bell', subscriptions:'crown', chat:'messages', system:'settings' };
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
    const visual = el('div', 'home-hero-art');
    visual.setAttribute('aria-hidden', 'true');
    const emblem = el('div', 'home-hero-emblem');
    const logo = document.createElement('img');
    logo.src = 'assets/vertex-logo.svg';
    logo.alt = '';
    emblem.append(logo);
    visual.append(emblem, el('span', 'home-orbit home-orbit-one'), el('span', 'home-orbit home-orbit-two'));
    const artWord = el('div', 'home-art-word', 'VERTEX');
    artWord.append(el('span', '', 'KONSOL'));
    visual.append(artWord);
    hero.append(visual);
    root.append(hero);
    const overview = section(root, t.overviewEyebrow, t.overviewTitle, 'home-overview');
    const overviewBody = el('div', 'home-prose');
    t.overview.forEach(line => paragraph(overviewBody, line));
    overview.append(overviewBody);
    const modules = section(root, t.modulesEyebrow, t.modulesTitle, 'home-modules');
    paragraph(modules, t.modulesLead, 'home-section-intro');
    addModuleCards(modules, t);
    const ecosystem = section(root, t.ecosystemEyebrow, t.ecosystemTitle, 'home-ecosystem');
    paragraph(ecosystem, t.ecosystemLead, 'home-section-intro');
    const stack = el('div', 'home-ecosystem-stack');
    t.ecosystem.forEach((item, index) => {
        const card = el('article', 'home-ecosystem-card');
        const header = el('div', 'home-ecosystem-header');
        header.append(el('span', 'home-ecosystem-index', String(index + 1).padStart(2, '0')));
        const naming = el('div');
        naming.append(el('span', 'home-ecosystem-type', item[1]), el('h3', 'home-ecosystem-name', item[0]));
        header.append(naming);
        card.append(header);
        const desc = el('div', 'home-ecosystem-text');
        paragraph(desc, item[2]);
        paragraph(desc, item[3]);
        card.append(desc);
        stack.append(card);
    });
    ecosystem.append(stack);
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
