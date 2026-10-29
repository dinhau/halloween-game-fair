/** Single-instance event server. No database or external runtime dependencies.
 * Staff controls the phone. Timing is measured on the phone, NOT via network RTT.
 * Rooms and results live in RAM; a process restart requires pairing again.
 */
import http from 'node:http';
import {randomBytes, randomInt, timingSafeEqual} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const QRCode=require('./vendor/QRCode/index.js');
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
export const APP_VERSION='4.2.1';
export const API_PROTOCOL='lizhe303-rooms-v1';
const token=()=>randomBytes(32).toString('hex');
const fault=(status,message)=>Object.assign(new Error(message),{status});
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function scoreMilliseconds(ms){
  if(!Number.isInteger(ms)||ms<0||ms>120000)throw fault(400,'無效的計時數值。');
  const centiseconds=Math.round(ms/10);
  return {milliseconds:ms,centiseconds,seconds:(centiseconds/100).toFixed(2),win:centiseconds>=950&&centiseconds<=1050};
}
export function makeQR(text){
  const qr=new QRCode(-1,0);qr.addData(text);qr.make();
  const n=qr.getModuleCount(),p=4;let d='';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))d+=`M${x+p} ${y+p}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+8} ${n+8}" role="img" aria-label="工作人員手機配對 QR code"><path fill="white" d="M0 0h${n+8}v${n+8}H0z"/><path fill="black" d="${d}" shape-rendering="crispEdges"/></svg>`;
}
export function createApp({eventPin=process.env.EVENT_PIN||'',clock=()=>Date.now(),roomTTL=12*3600*1000}={}){
 const rooms=new Map(), limits=new Map();
 const headers={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Frame-Options':'SAMEORIGIN',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
 };
 function limit(req,name,max,windowMs=60000){
  const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  const key=name+':'+ip;let e=limits.get(key);if(!e||clock()-e.start>windowMs)e={start:clock(),n:0};
  e.n++;limits.set(key,e);if(e.n>max)throw fault(429,'操作太頻繁，請稍後再試。');
 }
 function snapshot(r,role){
  return {id:r.id,revision:r.rev,scene:r.scene,phase:r.round?.phase||'idle',round:r.round,
   paired:!!r.phoneToken,phoneOnline:[...r.clients].some(c=>c.role==='phone'),
   displayOnline:[...r.clients].some(c=>c.role==='host'),giftCount:r.giftCount,
   rounds:r.counter,history:r.history,
   ...(role==='host'?{pairCode:r.pairCode,pairUntil:r.pairUntil}:{}),serverTime:clock()};
 }
 function writeState(r,c){if(!c.res.destroyed&&!c.res.writableEnded)c.res.write(`event: state\ndata: ${JSON.stringify(snapshot(r,c.role))}\n\n`);}
 function broadcast(r){r.rev++;for(const c of r.clients)writeState(r,c);}
 function remember(r){if(!r.round)return;const i=r.history.findIndex(x=>x.id===r.round.id);const row={...r.round};if(i<0)r.history.push(row);else r.history[i]=row;if(r.history.length>200)r.history.shift();}
 function issueCode(r){let code;do{code=String(randomInt(100000,1000000));}while([...rooms.values()].some(x=>x.pairCode===code));r.pairCode=code;r.pairUntil=clock()+10*60*1000;}
 function auth(req,id){
  const r=rooms.get(id);if(!r||clock()-r.touched>roomTTL)throw fault(410,'房間已失效。請在大螢幕重新建立房間並配對。');
  const value=(req.headers.authorization||'').replace(/^Bearer /,'');
  const role=equal(value,r.hostToken)?'host':r.phoneToken&&equal(value,r.phoneToken)?'phone':null;
  if(!role)throw fault(401,'連線憑證失效，請重新配對。');r.touched=clock();return{r,role};
 }
 async function body(req){let b='';for await(const chunk of req){b+=chunk;if(Buffer.byteLength(b)>16384)throw fault(413,'資料過大。');}try{return b?JSON.parse(b):{};}catch{throw fault(400,'資料格式錯誤。');}}
 function json(res,data,status=200){res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function origin(req){const host=req.headers.host||'localhost';if(!/^[a-z0-9.:[\]-]+$/i.test(host))throw fault(400,'無效主機。');return `${req.headers['x-forwarded-proto']==='https'||req.socket.encrypted?'https':'http'}://${host}`;}
 function checkOrigin(req){const o=req.headers.origin;if(o&&o!==origin(req))throw fault(403,'不接受跨網站控制請求。');}
 function operate(r,role,a){
  if(typeof a.actionId!=='string'||!/^[\w-]{8,100}$/.test(a.actionId))throw fault(400,'缺少操作識別碼。');
  const old=r.done.get(a.actionId);const fingerprint=JSON.stringify(a);
  if(old){if(old!==fingerprint)throw fault(409,'操作識別碼不可重複使用於不同指令。');return;}
  const q=r.round;
  const match=()=>{if(!q||q.id!==a.roundId)throw fault(409,'本局已變更，請重新整理狀態。');};
  const phone=()=>{if(role!=='phone')throw fault(403,'請由工作人員手機操作。');};
  switch(a.type){
   case 'scene':
    if(!['house','seal'].includes(a.scene))throw fault(400,'無效場景。');
    if(q?.phase==='running')throw fault(409,'挑戰進行中，請先完成或中止本局。');
    r.scene=a.scene;break;
   case 'pair-code':
    if(role!=='host')throw fault(403,'只有大螢幕能重新配對。');
    if(['ready','running'].includes(q?.phase))throw fault(409,'請先結束或中止目前挑戰。');
    r.phoneToken=null;
    for(const c of [...r.clients])if(c.role==='phone'){c.res.write('event: expired\ndata: {}\n\n');c.res.end();r.clients.delete(c);}
    issueCode(r);break;
   case 'prepare':
    phone();if(q)throw fault(409,'請先由工作人員結束上一局。');
    if(a.eligible!==true||a.exchanged!==true)throw fault(400,'請先確認資格及自願兌換。');
    r.counter++;r.round={id:randomBytes(12).toString('hex'),number:r.counter,phase:'ready',giftGiven:false,createdAt:clock()};r.scene='seal';break;
   case 'start':
    phone();match();if(q.phase!=='ready')throw fault(409,'本局已開始或已結束，不能重玩。');
    q.phase='running';q.startedReceivedAt=clock();break;
   case 'stop':
    phone();match();if(q.phase!=='running')throw fault(409,'本局不是計時狀態，請由工作人員確認。');
    q.result=scoreMilliseconds(a.milliseconds);q.phase='result';q.finishedAt=clock();remember(r);break;
   case 'abort':
    match();if(!['ready','running'].includes(q.phase))throw fault(409,'本局已結束。');
    q.phase='interrupted';q.reason='操作中斷，請工作人員確認；不自動重試。';q.finishedAt=clock();remember(r);break;
   case 'gift':
    phone();match();if(q.phase!=='result'||!q.result?.win)throw fault(409,'本局不是成功結果。');
    if(!q.giftGiven){q.giftGiven=true;r.giftCount++;remember(r);}break;
   case 'next':
    match();if(['ready','running'].includes(q.phase))throw fault(409,'請先中止或完成本局。');
    if(q.result?.win&&!q.giftGiven)throw fault(409,'請先確認成功者的小禮物已發放。');
    r.round=null;r.scene=a.scene==='seal'?'seal':'house';break;
   default:throw fault(400,'不支援的操作。');
  }
  r.done.set(a.actionId,fingerprint);if(r.done.size>800)r.done.delete(r.done.keys().next().value);broadcast(r);
 }
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');const p=url.pathname;
   if(req.method==='POST'){checkOrigin(req);if(!(req.headers['content-type']||'').includes('application/json'))throw fault(415,'請使用 JSON。');}
   if(p==='/healthz'){json(res,{ok:true,version:APP_VERSION,apiProtocol:API_PROTOCOL});return;}
   if(p==='/api/config'&&req.method==='GET'){json(res,{pinRequired:!!eventPin,version:APP_VERSION,apiProtocol:API_PROTOCOL});return;}
   if(p==='/api/rooms'&&req.method==='POST'){
    limit(req,'create',20);const a=await body(req);if(eventPin&&!equal(a.pin,eventPin))throw fault(403,'活動密碼不正確。');
    if(rooms.size>=100)throw fault(503,'房間已滿，請稍後再試。');
    const id=randomBytes(8).toString('hex');const r={id,hostToken:token(),phoneToken:null,pairCode:null,pairUntil:0,touched:clock(),rev:1,scene:'house',round:null,counter:0,giftCount:0,history:[],clients:new Set(),done:new Map()};issueCode(r);rooms.set(id,r);
    json(res,{id,token:r.hostToken,state:snapshot(r,'host')},201);return;
   }
   if(p==='/api/pair'&&req.method==='POST'){
    limit(req,'pair',12);const a=await body(req);const r=[...rooms.values()].find(x=>x.pairCode===a.code&&x.pairUntil>clock()&&clock()-x.touched<roomTTL);
    if(!r)throw fault(404,'配對碼不正確、已使用或已到期；請查看大螢幕。');
    r.phoneToken=token();r.pairCode=null;r.pairUntil=0;r.touched=clock();broadcast(r);json(res,{id:r.id,token:r.phoneToken,state:snapshot(r,'phone')});return;
   }
   const m=p.match(/^\/api\/rooms\/([a-f0-9]{16})\/(state|events|action|pairing)$/);
   if(m){
    const{r,role}=auth(req,m[1]);const route=m[2];
    if(route==='state'&&req.method==='GET'){json(res,snapshot(r,role));return;}
    if(route==='pairing'&&req.method==='GET'){
     if(role!=='host')throw fault(403,'僅大螢幕可取得配對資料。');
     const phoneURL=origin(req)+'/phone'+(r.pairCode?'#code='+r.pairCode:'');
     json(res,{phoneURL,code:r.pairCode,expires:r.pairUntil,svg:r.pairCode?makeQR(phoneURL):null});return;
    }
    if(route==='action'&&req.method==='POST'){limit(req,'action:'+r.id,240);operate(r,role,await body(req));json(res,snapshot(r,role));return;}
    if(route==='events'&&req.method==='GET'){
     if(r.clients.size>=12)throw fault(429,'此房間開啟太多分頁。');
     res.writeHead(200,{...headers,'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
     const c={res,role};r.clients.add(c);broadcast(r);
     const h=setInterval(()=>{if(!res.destroyed){res.write('event: ping\ndata: {}\n\n');r.touched=clock();}},15000);h.unref();
     req.on('close',()=>{clearInterval(h);r.clients.delete(c);broadcast(r);});return;
    }
    throw fault(405,'不支援的請求方式。');
   }
   if(p.startsWith('/api/'))throw fault(404,'找不到 API；請確認 server.mjs 與 public/ 已一起更新為 v4.2.1，並重新部署。');
   if(!['GET','HEAD'].includes(req.method))throw fault(405,'不支援的請求方式。');
   const routes={'/':'index.html','/display':'display.html','/phone':'phone.html','/guide':'guide.html'};
   const rel=routes[p]||decodeURIComponent(p).replace(/^\/+/, '');
   const f=path.resolve(ROOT,rel);if(!f.startsWith(ROOT+path.sep))throw fault(403,'無法存取此路徑。');
   const info=await stat(f).catch(()=>null);if(!info?.isFile())throw fault(404,'找不到檔案。');
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.json':'application/json; charset=utf-8'};
   res.writeHead(200,{...headers,'Content-Type':types[path.extname(f)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:await readFile(f));
  }catch(err){if(!res.headersSent)json(res,{error:err.status?err.message:'系統暫時無法處理，請重試。'},err.status||500);else res.end();}
 });
 const housekeeping=setInterval(()=>{
  for(const [id,r] of rooms){if(clock()-r.touched>roomTTL){for(const c of r.clients)c.res.end();rooms.delete(id);continue;}
   if(r.round?.phase==='running'&&clock()-r.round.startedReceivedAt>125000){r.round.phase='interrupted';r.round.reason='超過兩分鐘未收到結果，請工作人員確認。';r.round.finishedAt=clock();remember(r);broadcast(r);}}
  for(const[k,v]of limits)if(clock()-v.start>120000)limits.delete(k);
 },5000);housekeeping.unref();
 server.on('close',()=>{clearInterval(housekeeping);for(const r of rooms.values())for(const c of r.clients)c.res.end();});
 server.shutdown=()=>{for(const r of rooms.values())for(const c of r.clients)c.res.end();return new Promise(resolve=>{server.close(resolve);server.closeIdleConnections?.();});};
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createApp();const port=Number(process.env.PORT||3000);
 server.listen(port,'0.0.0.0',()=>console.log(`麗喆303班同步服務 v4.2.1 啟動：port ${port} /display /phone`));
 process.on('SIGTERM',()=>{server.shutdown().finally(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
