import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp,scoreMilliseconds,makeQR} from '../server.mjs';
const id=()=>randomUUID();
async function setup(t,opts={}){const app=createApp(opts);await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;t.after(()=>app.shutdown());
 async function call(p,method='GET',data,creds){const res=await fetch(base+p,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(creds?{Authorization:'Bearer '+creds.token}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json()};}
 const room=await call('/api/rooms','POST',{pin:opts.eventPin||''});const host=room.data;const pair=await call('/api/pair','POST',{code:host.state.pairCode});const phone=pair.data;
 const act=(who,type,extra={})=>call('/api/rooms/'+host.id+'/action','POST',{type,actionId:id(),...extra},who);
 return{app,base,call,host,phone,act};}
for(const [ms,seconds,win]of [[9494,'9.49',false],[9495,'9.50',true],[9500,'9.50',true],[10000,'10.00',true],[10500,'10.50',true],[10504,'10.50',true],[10505,'10.51',false],[300,'0.30',false]])
 test('rounding boundary '+ms,()=>assert.deepEqual(scoreMilliseconds(ms),{milliseconds:ms,centiseconds:Math.round(ms/10),seconds,win}));
test('reject invalid timing values',()=>{for(const v of [-1,120001,NaN,3.2,'10000'])assert.throws(()=>scoreMilliseconds(v));});
test('single chance, one gift, success workflow',async t=>{const{host,phone,act}=await setup(t);
 let r=await act(phone,'prepare',{eligible:true,exchanged:true});assert.equal(r.data.phase,'ready');const roundId=r.data.round.id;
 assert.equal((await act(phone,'prepare',{eligible:true,exchanged:true})).status,409);
 assert.equal((await act(host,'start',{roundId})).status,403);
 await act(phone,'start',{roundId});assert.equal((await act(phone,'start',{roundId})).status,409);
 assert.equal((await act(host,'scene',{scene:'house'})).status,409);
 r=await act(phone,'stop',{roundId,milliseconds:10120});assert.equal(r.data.round.result.seconds,'10.12');assert.equal(r.data.round.result.win,true);
 assert.equal((await act(phone,'stop',{roundId,milliseconds:10000})).status,409);
 assert.equal((await act(phone,'next',{roundId})).status,409);
 r=await act(phone,'gift',{roundId});assert.equal(r.data.giftCount,1);r=await act(phone,'gift',{roundId});assert.equal(r.data.giftCount,1);
 r=await act(phone,'next',{roundId});assert.equal(r.data.phase,'idle');assert.equal(r.data.scene,'house');assert.equal(r.data.history.length,1);
});
test('failure cannot claim gift',async t=>{const{phone,act}=await setup(t);const r=await act(phone,'prepare',{eligible:true,exchanged:true}),roundId=r.data.round.id;await act(phone,'start',{roundId});const stop=await act(phone,'stop',{roundId,milliseconds:11200});assert.equal(stop.data.round.result.win,false);assert.equal((await act(phone,'gift',{roundId})).status,409);assert.equal((await act(phone,'next',{roundId})).data.phase,'idle');});
test('both eligibility confirmations required',async t=>{const{phone,act}=await setup(t);assert.equal((await act(phone,'prepare',{eligible:true,exchanged:false})).status,400);});
test('idempotent retry does not repeat stop or gift',async t=>{const{call,phone,act,host}=await setup(t);const r=await act(phone,'prepare',{eligible:true,exchanged:true}),roundId=r.data.round.id;await act(phone,'start',{roundId});const a={type:'stop',roundId,milliseconds:10000,actionId:id()};const endpoint='/api/rooms/'+host.id+'/action';const one=await call(endpoint,'POST',a,phone);const two=await call(endpoint,'POST',a,phone);assert.equal(one.data.revision,two.data.revision);assert.equal((await call(endpoint,'POST',{...a,milliseconds:20000},phone)).status,409);});
test('reload preserves ready/result and interruption cannot restart',async t=>{const{call,phone,host,act}=await setup(t);const r=await act(phone,'prepare',{eligible:true,exchanged:true}),roundId=r.data.round.id;await act(phone,'start',{roundId});await act(phone,'abort',{roundId});assert.equal((await call('/api/rooms/'+host.id+'/state','GET',undefined,phone)).data.phase,'interrupted');assert.equal((await act(phone,'start',{roundId})).status,409);});
test('pair code one use, phone token rotation, authentication',async t=>{const{call,host,phone,act}=await setup(t);assert.equal((await call('/api/pair','POST',{code:host.state.pairCode})).status,404);assert.equal((await call('/api/rooms/'+host.id+'/state')).status,401);assert.equal((await act(phone,'pair-code')).status,403);const n=await act(host,'pair-code');assert.equal((await call('/api/rooms/'+host.id+'/state','GET',undefined,phone)).status,401);assert.equal((await call('/api/pair','POST',{code:n.data.pairCode})).status,200);});
test('phone cannot see host credentials or pairing code',async t=>{const{phone}=await setup(t);assert.equal(phone.state.pairCode,undefined);assert.equal(phone.state.hostToken,undefined);});
test('SSE delivers state to independent display client',async t=>{const{base,host,phone,act}=await setup(t);const abort=new AbortController();const res=await fetch(base+'/api/rooms/'+host.id+'/events',{headers:{Authorization:'Bearer '+host.token},signal:abort.signal});assert.equal(res.headers.get('content-type'),'text/event-stream; charset=utf-8');const reader=res.body.getReader();await reader.read();await act(phone,'prepare',{eligible:true,exchanged:true});const c=await reader.read();assert.match(new TextDecoder().decode(c.value),/"phase":"ready"/);abort.abort();});
test('host pairing QR is self-hosted and no auth token in URL',async t=>{const{host,act,call}=await setup(t);await act(host,'pair-code');const r=await call('/api/rooms/'+host.id+'/pairing','GET',undefined,host);assert.match(r.data.phoneURL,/\/phone#code=\d{6}$/);assert.ok(!r.data.phoneURL.includes(host.token));assert.match(r.data.svg,/<svg/);});
test('optional event pin protects creation',async t=>{const{call}=await setup(t,{eventPin:'test-only-secret'});assert.equal((await call('/api/rooms','POST',{pin:'wrong'})).status,403);});
test('static routes and no server source exposure',async t=>{const{base}=await setup(t);for(const p of ['/display','/phone','/live-client.js','/'])assert.equal((await fetch(base+p)).status,200);assert.equal((await fetch(base+'/server.mjs')).status,404);});
test('cross-origin writes rejected',async t=>{const{base}=await setup(t);const r=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);});
test('expired rooms require re-pairing',async t=>{let now=100000;const{host,call}=await setup(t,{clock:()=>now,roomTTL:1000});now+=1001;assert.equal((await call('/api/rooms/'+host.id+'/state','GET',undefined,host)).status,410);});
test('QR generator produces valid grid SVG',()=>{const svg=makeQR('https://example.test/phone#code=123456');assert.match(svg,/shape-rendering="crispEdges"/);});
