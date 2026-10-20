// One lifetime per authenticated session. Failed reads can be retried on the
// next workspace visit; simultaneous entry events share the same load.
export function createWorkspaceLoader({tasks,canLoad,onError=()=>{}}){
    const loaded=new Set(),pending=new Map();
    let epoch=0;
    return {
        load(keys){
            const work=[];
            for(const [key,load]of tasks){
                if(!keys.includes(key)||!canLoad(key))continue;
                if(pending.has(load)){work.push(pending.get(load));continue;}
                if(loaded.has(load))continue;
                loaded.add(load);
                const session=epoch;
                let request;
                request=Promise.resolve().then(()=>{if(session===epoch)return load();})
                    .catch(error=>{if(session===epoch){loaded.delete(load);onError(key,error);}})
                    .finally(()=>{if(pending.get(load)===request)pending.delete(load);});
                pending.set(load,request);work.push(request);
            }
            return Promise.all(work);
        },
        invalidate(key){for(const [panel,load]of tasks)if(panel===key)loaded.delete(load);},
        clear(){epoch++;loaded.clear();pending.clear();}
    };
}
