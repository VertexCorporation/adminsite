// Only a confirmed mail submission earns a sent checkmark.
export const certificateAccepted = status => ['submitted','succeeded','delivered'].includes(status);
export const certificateInFlight = status => ['pending','processing'].includes(status);
export function watchCertificateDelivery({read, currentUser, viewerUid, update, failure, schedule=setTimeout, cancel=clearTimeout, keepWatching=false}) {
    let timer, stopped=false, failures=0;
    const known=new Map();
    const stop=()=>{stopped=true;cancel(timer);};
    const accept=data=>{
        if(stopped || currentUser()!==viewerUid){stop();return;}
        const active=new Set();
        for(const job of data.history){
            const key=job.id, prior=known.get(key);
            const sameAttempt=prior && (!prior.attemptId || prior.attemptId===job.attemptId);
            if(['failed','uncertain'].includes(job.status) && sameAttempt && (certificateAccepted(prior.status)||certificateInFlight(prior.status)))failure(job);
            known.set(key,{status:job.status,attemptId:job.attemptId});
            if(certificateInFlight(job.status))active.add(key);
        }
        update(data);
        if(!active.size && !keepWatching)stop();
    };
    const poll=async()=>{
        if(stopped || currentUser()!==viewerUid){stop();return;}
        try {const data=await read();if(!Array.isArray(data?.history))throw new Error('Invalid certificate history');failures=0;accept(data);}
        catch {failures++;} // A read failure cannot prove that email delivery failed.
        if(!stopped)timer=schedule(poll,failures||keepWatching?30000:5000);
    };
    return {start(data){accept(data);if(!stopped)timer=schedule(poll,5000);},stop};
}
