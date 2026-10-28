/** 麗喆303班 live game relay. Node >=22, zero runtime dependencies.
 * Single-process, ephemeral rooms. Staff-controlled timing, not an anti-cheat system.
 * No children's names, cookies, telemetry, or third-party requests.
 */
import http from 'node:http';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const token=()=>randomBytes(24).toString('hex');
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export const score=ms=>{if(!Number.isFinite(ms)||ms<0||ms>30000)throw new Error('無效秒數');const cs=Math.round(ms/10);return {centiseconds:cs,seconds:(cs/100).toFixed(2),success:cs>=950&&cs<=1050};};
class APIError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,msg)=>{throw new APIError(status,msg);};
export function createApp({now=()=>Date.now(),maxRooms=40,rateLimits=true}={}){
 const rooms=new Map(),limits=new Map();
 const emit=(res,event,data)=>res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
 const view=(r,role)=>({id:r.id,version:r.version,scene:r.scene,phase:r.phase,round:r.round?{id:r.round.id,number:r.round.number,result:r.round.result??null,giftClaimed:!!r.round.giftClaimed,reason:r.round.reason??null}:null,connected:!!r.controller,stats:{...r.stats},...(role==='host'?{pairCode:r.code,pairSecret:r.secret,pending:r.pending.map(p=>({id:p.id,verify:p.verify})),history:r.history.slice(-200)}:{})});
 function broadcast(r){r.version++;r.touched=now();for(const c of r.clients){if(c.res.destroyed){r.clients.delete(c);continue;}emit(c.res,'state',view(r,c.role));}}
 function interrupt(r,reason){if(!['ready','running'].includes(r.phase))return;r.phase='interrupted';r.round.reason=reason;broadcast(r);}
 function auth(req,r){const key=(req.headers.authorization||'').replace(/^Bearer /,'');if(eq(key,r.host))return 'host';if(r.controller&&eq(key,r.controller))return 'controller';fail(401,'配對失效，請重新連線。');}
 const requireHost=role=>{if(role!=='host')fail(403,'此操作只限螢幕工作人員。');};
 function limited(req,kind,count,windowMs){if(!rateLimits)return;const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim();const key=kind+':'+ip;let l=limits.get(key);if(!l||now()>l.until){l={n:0,until:now()+windowMs};limits.set(key,l);}if(++l.n>count)fail(429,'操作太頻繁，請稍後再試。');}
 async function readJSON(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'請使用 JSON');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)fail(413,'資料過大');}try{return JSON.parse(raw||'{}');}catch{fail(400,'JSON 格式錯誤');}}
 function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
   const u=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&u.pathname==='/healthz')return reply(res,200,{ok:true,version:'4.0.0'});
   if(u.pathname.startsWith('/api/')){
    if(req.headers.origin){let h;try{h=new URL(req.headers.origin).host;}catch{fail(403,'無效來源');}if(h!==req.headers.host)fail(403,'不同網站不能操作這場遊戲。');}
    if(req.method==='POST')limited(req,'post',200,60000);
    if(req.method==='POST'&&u.pathname==='/api/rooms'){
     limited(req,'create',12,3600000);if(rooms.size>=maxRooms)fail(503,'房間已滿，請稍後重試。');
     const id=randomBytes(8).toString('hex');let code;do{code=String(randomInt(100000,1000000));}while([...rooms.values()].some(r=>r.code===code));
     const r={id,code,secret:token(),host:token(),controller:null,pending:[],clients:new Set(),version:1,touched:now(),scene:'house',phase:'idle',round:null,stats:{rounds:0,successes:0,gifts:0},history:[]};rooms.set(id,r);return reply(res,201,{room:id,token:r.host,state:view(r,'host')});
    }
    if(req.method==='POST'&&u.pathname==='/api/join'){
     limited(req,'join',20,60000);const d=await readJSON(req),r=[...rooms.values()].find(x=>x.code===d.code||x.id===d.room);
     if(!r||!eq(r.secret,d.secret))fail(404,'配對邀請不正確或已失效，請重新掃描螢幕 QR。');
     if(r.pending.length>=5)fail(429,'有太多待核准手機，請由螢幕先清除。');
     const p={id:token(),token:token(),verify:String(randomInt(1000,10000)),created:now(),status:'pending'};r.pending.push(p);broadcast(r);return reply(res,201,{room:r.id,request:p.id,token:p.token,verify:p.verify});
    }
    const match=u.pathname.match(/^\/api\/rooms\/([a-f0-9]{16})(?:\/([a-z-]+))?$/);if(!match)fail(404,'找不到 API');
    const r=rooms.get(match[1]);if(!r)fail(410,'房間已結束或服務已重啟。請在螢幕重建房間並重新配對。');const action=match[2]||'state';
    if(req.method==='POST'&&action==='pair-status'){
     const d=await readJSON(req);const key=(req.headers.authorization||'').replace(/^Bearer /,'');
     if(r.controller&&eq(key,r.controller))return reply(res,200,{approved:true,state:view(r,'controller')});
     const p=r.pending.find(x=>x.id===d.request&&eq(key,x.token));if(!p)fail(401,'配對已取消，請重新掃描。');return reply(res,200,{approved:false});
    }
    const role=auth(req,r);r.touched=now();
    if(req.method==='GET'&&action==='events'){
     if(r.clients.size>=12)fail(429,'同一房間連線數已滿。');res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
     const c={res,role};r.clients.add(c);emit(res,'state',view(r,role));const hb=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n');},10000);req.on('close',()=>{clearInterval(hb);r.clients.delete(c);});return;
    }
    if(req.method==='GET'&&action==='state')return reply(res,200,view(r,role));
    if(req.method!=='POST')fail(405,'不支援此方法');const d=await readJSON(req);
    if(action==='approve'){
     requireHost(role);if(['ready','running'].includes(r.phase))fail(409,'本局進行中，不可更換手機。');const p=r.pending.find(x=>x.id===d.request);if(!p)fail(404,'配對請求已失效');
     r.controller=p.token;r.pending=[];r.secret=token();for(const c of [...r.clients])if(c.role==='controller'){c.res.end();r.clients.delete(c);}broadcast(r);
    }else if(action==='reject'){
     requireHost(role);r.pending=r.pending.filter(x=>x.id!==d.request);broadcast(r);
    }else if(action==='unpair'){
     requireHost(role);if(['ready','running'].includes(r.phase))fail(409,'先中止這局再解除手機。');r.controller=null;r.pending=[];r.secret=token();for(const c of [...r.clients])if(c.role==='controller'){c.res.end();r.clients.delete(c);}broadcast(r);
    }else if(action==='scene'){
     if(!['house','seal'].includes(d.scene))fail(400,'不正確場景');if(['ready','running'].includes(r.phase))fail(409,'本局進行中，不能切換。');r.scene=d.scene;broadcast(r);
    }else if(action==='arm'){
     if(role!=='controller')fail(403,'請在已配對的工作人員手機開局。');
     if(r.phase==='ready'&&d.requestId===r.round?.requestId)return reply(res,200,view(r,role));
     if(r.phase!=='idle')fail(409,'請先由工作人員結束上一局。');if(d.eligible!==true||d.exchange!==true)fail(400,'請確認首次成功與自願兌換。');if(!/^[a-f0-9-]{16,80}$/i.test(d.requestId||''))fail(400,'缺少開局識別碼');
     r.round={id:token(),requestId:d.requestId,number:++r.stats.rounds,created:now(),result:null,giftClaimed:false};r.phase='ready';r.scene='seal';broadcast(r);
    }else if(action==='start'){
     if(role!=='controller')fail(403,'請用手機開始');if(!r.round||d.roundId!==r.round.id)fail(409,'這不是目前的回合');
     if(r.phase==='running')return reply(res,200,view(r,role));if(r.phase!=='ready')fail(409,'這局已使用或尚未開放');r.round.startAt=now();r.phase='running';broadcast(r);
    }else if(action==='finish'){
     if(role!=='controller')fail(403,'請用手機停止');if(!r.round||d.roundId!==r.round.id)fail(409,'這不是目前的回合');
     if(r.phase==='result')return reply(res,200,view(r,role));if(r.phase!=='running')fail(409,'本局未計時或已中止');
     let result;try{result=score(d.elapsedMs);}catch{fail(400,'無效的計時結果');}
     if(Math.abs((now()-r.round.startAt)-d.elapsedMs)>5000){interrupt(r,'連線延遲過大，請工作人員判定，不自動算失敗。');}
     else{r.round.result=result;r.phase='result';if(result.success)r.stats.successes++;r.history.push({number:r.round.number,...result,giftClaimed:false});r.history=r.history.slice(-200);broadcast(r);}
    }else if(action==='interrupt'){
     if(!r.round||d.roundId!==r.round.id)fail(409,'這不是目前的回合');interrupt(r,'裝置切至背景、離線或工作人員中止。請工作人員判定。');
    }else if(action==='gift'){
     if(r.phase!=='result'||!r.round?.result?.success)fail(409,'本局未成功，不能登記禮物');if(d.roundId!==r.round.id)fail(409,'這不是目前的回合');
     if(!r.round.giftClaimed){r.round.giftClaimed=true;r.stats.gifts++;const row=r.history.find(x=>x.number===r.round.number);if(row)row.giftClaimed=true;broadcast(r);}
    }else if(action==='next'){
     if(d.confirmed!==true)fail(400,'請確認下一位參加者');if(['running','ready'].includes(r.phase))fail(409,'請先中止進行中的回合');
     if(r.round&&d.roundId!==r.round.id)fail(409,'請重新整理回合狀態');r.round=null;r.phase='idle';r.scene='house';broadcast(r);
    }else if(action==='ping'){/* keeps connection/liveness observable, no state mutation */}
    else fail(404,'找不到操作');return reply(res,200,view(r,role));
   }
   if(!['GET','HEAD'].includes(req.method))fail(405,'不支援此方法');const routes={'/':'index.html','/display':'display.html','/phone':'phone.html'};
   let pathname;try{pathname=decodeURIComponent(u.pathname);}catch{fail(400,'無效路徑');}const rel=routes[pathname]||pathname.replace(/^\//,'');const file=path.resolve(ROOT,rel);if(!file.startsWith(ROOT+path.sep)||rel.startsWith('.'))fail(403,'禁止存取');
   let data;try{if(!(await stat(file)).isFile())fail(404,'找不到檔案');data=await readFile(file);}catch{fail(404,'找不到檔案');}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.json':'application/json'};
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
  }catch(err){if(!res.headersSent)reply(res,err.status||500,{error:err.status?err.message:'伺服器忙碌，請重試。'});else res.end();}
 });
 const timer=setInterval(()=>{for(const[id,r]of rooms){r.pending=r.pending.filter(p=>now()-p.created<180000);if(r.phase==='running'&&now()-r.round.startAt>45000)interrupt(r,'本局逾時或連線中斷，請工作人員判定。');if(now()-r.touched>12*3600000){for(const c of r.clients)c.res.end();rooms.delete(id);}}for(const[k,v]of limits)if(now()>v.until)limits.delete(k);},1000);timer.unref();
 const close=()=>{clearInterval(timer);for(const r of rooms.values())for(const c of r.clients)c.res.end();return new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});};
 return {server,close,rooms};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createApp();const port=Number(process.env.PORT||3000);app.server.listen(port,'0.0.0.0',()=>console.log(`麗喆303班 live server ready on port ${port}`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
