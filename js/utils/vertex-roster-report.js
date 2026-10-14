// No persistence: callers explicitly download this private report.
const cell=value=>{
    let text=String(value??'');
    // A validated E.164 mobile is numeric-only and cannot contain a formula.
    // Keep that value reusable as a normalized phone; neutralize other formulas.
    if(!/^\+905\d{9}$/.test(text)&&(/^[\s]*[=+\-@]/.test(text)||/^[\t\r]/.test(text)))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
};
export function rosterCSV(plan) {
    const headers=['Telefon','Ad soyad','E-posta','E-posta doğrulandı','Başvuru','Cortex hesabı','Departman','Admin rolü mevcut','Admin rolü önerilen','Rol incelemesi','Katılma tarihi','Tarih kaynağı','Vertex üyeliği önce','Vertex üyeliği önerilen','Cortex Plus','İşlem sonucu','İnceleme nedenleri'];
    const rows=plan.rows.map(r=>[r.phone,r.name,r.email,r.emailVerified?'Evet':'Hayır',r.application?'Bulundu':'Bulunamadı',r.cortexAccount?'Bulundu':'Bulunamadı',r.departments.join('; '),r.currentRoles.join('; '),r.proposedRoles.join('; '),r.roleReview,r.joining.value,r.joining.estimated?'Tahmini: başvuru + 7 gün':'Mevcut / gerçek',r.before.isVertex?'Aktif':'Pasif',r.after.isVertex?'Aktif':'Pasif',r.plus,r.result,r.reasons.join('; ')]);
    // Keep outsiders in the same reusable export, without suggesting deactivation.
    for(const p of plan.activeOutside)rows.push(['','',p.email,'','','','','','','','','','Aktif','','','Referans liste dışında; işlem yapılmadı',p.uid]);
    return [headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
