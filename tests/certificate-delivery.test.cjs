const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const code=fs.readFileSync('js/modules/certificateDelivery.js','utf8');
const moduleReady=import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const history=(status,attemptId)=>({history:[{id:'person--tenacity',certificateType:'tenacity',status,attemptId}]});
async function fixture(initial='processing',keepWatching=false){
    const {watchCertificateDelivery}=await moduleReady;
    let queued,uid='owner',next=history('submitted','attempt-1'),reads=0;
    const updates=[],errors=[];
    const watcher=watchCertificateDelivery({
        keepWatching,read:async()=>{reads++;if(next instanceof Error)throw next;return next;},
        currentUser:()=>uid,viewerUid:'owner',update:data=>updates.push(data),failure:job=>errors.push(job),
        schedule:fn=>{queued=fn;return fn;},cancel:()=>{queued=undefined;}
    });
    watcher.start(history(initial));
    return {updates,errors,watcher,setNext:value=>{next=value;},signOut:()=>{uid=null;},
        poll:async()=>{const fn=queued;queued=undefined;await fn?.();},get queued(){return queued;},get reads(){return reads;}};
}
test('accepted request shows approval before delivery, then stops on submission',async()=>{
    const f=await fixture();assert.equal(f.updates[0].history[0].status,'processing');
    assert.ok(f.queued);await f.poll();assert.equal(f.updates[1].history[0].status,'submitted');assert.equal(f.queued,undefined);assert.equal(f.errors.length,0);
});
test('later PDF failure rolls back optimistic approval and notifies once',async()=>{
    const f=await fixture();f.setNext(history('failed','attempt-1'));await f.poll();
    assert.equal(f.errors.length,1);assert.equal(f.updates.at(-1).history[0].status,'failed');assert.equal(f.queued,undefined);
});
test('Gmail uncertainty removes approval without allowing an automatic resend',async()=>{
    const f=await fixture();f.setNext(history('uncertain','attempt-1'));await f.poll();assert.equal(f.errors.length,1);assert.equal(f.queued,undefined);
});
test('network read failure preserves approval and retries reconciliation',async()=>{
    const f=await fixture();f.setNext(new Error('offline'));await f.poll();assert.equal(f.updates.length,1);assert.equal(f.errors.length,0);assert.ok(f.queued);
    f.setNext(history('submitted','attempt-1'));await f.poll();assert.equal(f.updates.length,2);
});
test('sign out stops reads and discards any late private response',async()=>{
    const f=await fixture();f.signOut();await f.poll();assert.equal(f.reads,0);assert.equal(f.queued,undefined);
});
test('stopping a watcher prevents further updates',async()=>{
    const f=await fixture();f.watcher.stop();await f.poll();assert.equal(f.reads,0);
});
test('only accepted ledger states render a persistent check',async()=>{
    const {certificateAccepted}=await moduleReady;
    for(const status of ['submitted','succeeded','delivered'])assert.equal(certificateAccepted(status),true,status);
    for(const status of ['pending','processing','legacy','failed','uncertain','revoked',undefined])assert.equal(certificateAccepted(status),false,status);
});

test('an open drawer refreshes terminal jobs and removes a tick after late failure',async()=>{
    const f=await fixture('submitted',true);
    assert.ok(f.queued);f.setNext(history('failed','attempt-1'));await f.poll();
    assert.equal(f.updates.at(-1).history[0].status,'failed');assert.equal(f.errors.length,1);
    await f.poll();assert.equal(f.errors.length,1);f.watcher.stop();assert.equal(f.queued,undefined);
});
