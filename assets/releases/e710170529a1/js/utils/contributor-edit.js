// Only transmit changed application fields. Unchanged linked-account identity
// fields must not trigger personnel ownership or department preconditions.
export const EDIT_FIELDS=Object.freeze(['name','email','phone','age','department','language','linkedin','github','interviewDate','about']);
export function changedContributorFields(person,entered,{department,interviewDate}={}){
    const baseline={
        name:person.name??'',email:person.email??'',phone:person.phone??'',age:person.age??'',
        department:department??person.department??'',language:person.language||'en',
        linkedin:person.linkedin??'',github:person.github??'',
        interviewDate:interviewDate??person.interviewDate??'',about:person.about??''
    };
    const updates={};
    for(const key of EDIT_FIELDS){
        const before=String(baseline[key]??'').trim(),after=String(entered[key]??'').trim();
        if(before!==after)updates[key]=after;
    }
    return updates;
}
