import { previewVertexRosterFn, applyVertexRosterFn, getVertexRosterApprovalFn } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';
import { openDrawer, confirmDialog } from './shell.js';
import { getLang, onLangChange, userErrorMessage } from '../utils/ui.js';
import { rosterCSV } from '../utils/vertex-roster-report.js';
const labels = {
    tr: { title:'Vertex · 61 kişilik kadro', intro:'61 benzersiz ana telefon numarasını satır başına bir numara olacak şekilde yapıştırın. Önizleme kayıtları değiştirmez. Rapor kişisel veri içerir; yalnızca yetkili yöneticilerin erişebildiği bir konuma kaydedin.', input:'Telefon listesi', preview:'Eşleştir ve önizle', export:'CSV raporu indir', apply:'Onaylı değişiklikleri uygula', pending:'İşlem sürüyor…', disabled:'Uygulama sunucuda kapalı. Bu önizleme ayrıca onaylanmadan hiçbir kayıt değiştirilemez.', approval:'Yalnızca sunucuda bu önizleme için uygulama onayı açıldıysa devam edin. Hazır kayıtlar tek işlemde güncellenir. Manuel inceleme ve rol önerileri uygulanmaz.', stale:'Liste değişti; yeniden önizleyin.', ready:'Hazır', review:'Manuel inceleme', outside:'Referans liste dışında aktif', roles:'Departman rolü önerileri ayrıca onay gerektirir; mevcut roller korunur.', done:'İşlem tamamlandı. Sonuç raporunu indirebilirsiniz.', digest:'Önizleme onay kodu', before:'Önce', after:'Önerilen', estimated:'Tahmini', actual:'Mevcut / gerçek', saved:'Başarılı' },
    en: { title:'Vertex · 61-member roster', intro:'Paste 61 unique primary phone numbers, one per line. Preview does not change records. Reports contain personal data; save only in an administrator-restricted location.', input:'Phone list', preview:'Match and preview', export:'Download CSV report', apply:'Apply approved changes', pending:'Working…', disabled:'Application is disabled on the server. This exact preview requires separate operator approval.', approval:'Continue only after the operator has enabled application for this exact preview. Ready records commit atomically. Manual reviews and role proposals are not applied.', stale:'The list changed; run preview again.', ready:'Ready', review:'Manual review', outside:'Active outside reference roster', roles:'Department role proposals require separate approval; existing roles are preserved.', done:'Completed. You can download the result report.', digest:'Preview approval code', before:'Before', after:'Proposed', estimated:'Estimated', actual:'Existing / actual', saved:'Successful' }
};
const text = key => labels[getLang()==='tr'?'tr':'en'][key];
let launch;
export function refreshRosterAccess() { if (launch) launch.hidden = !isPanelAdmin(); }
export function initVertexRoster(refresh) {
    launch = document.createElement('button'); launch.type='button'; launch.className='chrome-btn-outline'; launch.id='vertex-roster-launch';
    const translate=()=>{launch.textContent=text('title');}; translate(); onLangChange(translate);
    document.getElementById('refresh-contributors-btn')?.after(launch); refreshRosterAccess();
    launch.onclick=()=>{ if(isPanelAdmin()) openRoster(refresh); };
}
function openRoster(refresh) {
    const body=openDrawer({title:text('title')});
    body.classList.add('vertex-roster-body');
    let preview=null, busy=false, generation=0;
    const intro=document.createElement('p');intro.className='form-hint';intro.textContent=text('intro');
    const label=document.createElement('label');label.htmlFor='vertex-roster-phones';label.textContent=text('input');
    const input=document.createElement('textarea');input.id='vertex-roster-phones';input.rows=7;input.autocomplete='off';input.spellcheck=false;
    const actions=document.createElement('div');actions.className='vertex-roster-actions';
    const analyze=document.createElement('button');analyze.type='button';analyze.className='chrome-btn-primary';analyze.textContent=text('preview');
    const download=document.createElement('button');download.type='button';download.className='chrome-btn-outline';download.textContent=text('export');download.disabled=true;
    const apply=document.createElement('button');apply.type='button';apply.className='chrome-btn-outline';apply.textContent=text('apply');apply.disabled=true;
    const status=document.createElement('p');status.className='form-hint';status.setAttribute('role','status');
    const results=document.createElement('div');
    actions.append(analyze,download,apply);body.append(intro,label,input,actions,status,results);
    const controls=()=>{analyze.disabled=busy;input.disabled=busy;download.disabled=busy||!preview;apply.disabled=busy||!preview?.rows.some(r=>r.result==='ready');};
    input.oninput=()=>{generation++;preview=null;results.replaceChildren();status.textContent=text('stale');controls();};
    analyze.onclick=async()=>{
        if(busy||!isPanelAdmin())return;
        busy=true;preview=null;const request=++generation;controls();status.textContent=text('pending');results.replaceChildren();
        try {
            const {data}=await previewVertexRosterFn({phones:input.value});
            if(!body.isConnected||request!==generation||!isPanelAdmin())return;
            preview=data;paint();status.textContent=data.applicationEnabled?'':text('disabled');
        } catch(error){if(body.isConnected)status.textContent=userErrorMessage(error);}
        finally{busy=false;controls();}
    };
    function paint() {
        results.replaceChildren();
        const summary=document.createElement('p');summary.textContent=`${text('ready')}: ${preview.rows.filter(r=>r.result==='ready').length} · ${text('review')}: ${preview.rows.filter(r=>r.result==='manual-review').length} · ${text('outside')}: ${preview.activeOutside.length}`;
        const code=document.createElement('p');code.className='vertex-roster-digest';code.textContent=`${text('digest')}: ${preview.digest}`;
        const roles=document.createElement('p');roles.className='form-hint';roles.textContent=text('roles');results.append(summary,code,roles);
        for(const row of preview.rows) {
            const details=document.createElement('details');details.className='vertex-roster-row';
            const title=document.createElement('summary');title.textContent=`${row.name || row.phone} · ${row.result==='successful'?text('saved'):text(row.result==='ready'?'ready':'review')}`;
            const data=document.createElement('p');data.textContent=[row.phone,row.email,row.emailVerified?'✓':'?',row.departments.join(', '),row.currentRoles.join(', '),row.roleReview,...row.reasons].join(' · ');
            const change=document.createElement('p');change.textContent=`${text('before')}: ${JSON.stringify(row.before)} → ${text('after')}: ${JSON.stringify(row.after)} (${text(row.joining.estimated?'estimated':'actual')})`;
            details.append(title,data,change);results.append(details);
        }
        if(preview.activeOutside.length){const outside=document.createElement('details'),title=document.createElement('summary'),list=document.createElement('p');title.textContent=text('outside');list.textContent=preview.activeOutside.map(p=>`${p.uid} · ${p.email}`).join('\n');outside.append(title,list);results.append(outside);}
    }
    download.onclick=()=>{
        if(!preview||!isPanelAdmin())return;
        const blob=new Blob(['\uFEFF'+rosterCSV(preview)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='vertex-roster-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    apply.onclick=async()=>{
        if(busy||!preview||!isPanelAdmin())return;
        busy=true;controls();
        try {
            const approval=await getVertexRosterApprovalFn({digest:preview.digest});
            if(!approval.data.approved){status.textContent=text('disabled');return;}
            if(!await confirmDialog(()=>({title:text('apply'),body:text('approval')})))return;
            status.textContent=text('pending');
            const {data}=await applyVertexRosterFn({phones:input.value,preview});
            const outcomes=new Map(data.results.map(r=>[r.phone,r.result]));
            preview.rows=preview.rows.map(row=>({...row,result:outcomes.get(row.phone)||row.result}));preview.applicationEnabled=false;
            paint();status.textContent=text('done');await refresh();
        }catch(error){status.textContent=userErrorMessage(error);}
        finally{busy=false;controls();}
    };
}
