const uncertainCodes=new Set(['functions/unavailable','functions/deadline-exceeded',
    'functions/internal','functions/unknown','functions/cancelled']);
const identity=person=>typeof person==='string'
    ? 'legacy:'+person.trim().normalize('NFC')
    : typeof person?.id==='string'?'id:'+person.id:null;
function matches(current,expected){
    const title=expected.title.trim().normalize('NFC').slice(0,160)||`Hafta ${expected.weekNumber}, ${expected.year}`;
    return current?.year===expected.year && current.weekNumber===expected.weekNumber &&
        current.title===title && Array.isArray(current.contributors) &&
        current.contributors.length===expected.contributors.length &&
        current.contributors.every((person,i)=>identity(person)!==null && identity(person)===identity(expected.contributors[i]));
}

// A write is sent exactly once. If its response is lost, read back the saved
// selection before deciding what to tell the user; never retry a mutation.
export async function persistWeeklyStars(expected,{write,read}){
    let originalError;
    try{
        const {data}=await write(expected);
        if(data?.success===true && matches(data.current,expected))return data;
        originalError=Object.assign(new Error('Unverified weekly stars response'),{code:'functions/internal'});
    }catch(error){
        if(!uncertainCodes.has(error.code))throw error;
        originalError=error;
    }
    try{
        const {data}=await read({});
        if(matches(data?.current,expected))return data;
    }catch(_error){/* Keep uncertainty distinct from a confirmed rejection. */}
    const failure=new Error('Weekly stars save could not be confirmed');
    failure.code=originalError.code;
    failure.reason='weekly-stars-save-unconfirmed';
    throw failure;
}
