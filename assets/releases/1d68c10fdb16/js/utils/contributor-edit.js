// Only transmit changed application fields. Unchanged linked-account identity
// fields must not trigger personnel ownership or department preconditions.
export const EDIT_FIELDS=Object.freeze(['name','email','phone','birthDate','department','language','linkedin','github','interviewDate','applicationDate','about']);
export function changedContributorFields(person,entered,{department,interviewDate,applicationDate}={}){
    const baseline={
        name:person.name??'',email:person.email??'',phone:person.phone??'',birthDate:person.birthDate??'',
        department:department??person.department??'',language:person.language||'en',
        linkedin:person.linkedin??'',github:person.github??'',
        interviewDate:interviewDate??person.interviewDate??'',applicationDate:applicationDate??person.applicationDate??'',about:person.about??''
    };
    const updates={};
    for(const key of EDIT_FIELDS){
        const before=String(baseline[key]??'').trim(),after=String(entered[key]??'').trim();
        if(before!==after)updates[key]=after;
    }
    return updates;
}
