/* Same-origin API + authenticated SSE. Secrets stay out of URLs and referrers. */
(() => {
 'use strict';
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const VERSION='4.2.1', PROTOCOL='lizhe303-rooms-v1';
 const mismatch='前後端版本不一致。請將 live/server.mjs、live/vendor/ 與 live/public/ 一起更新為 v4.2.1，再到 Render 部署最新 commit，兩端重新整理後配對。';
 const validCreds=c=>Boolean(c&&typeof c.id==='string'&&/^[a-f0-9]{16}$/.test(c.id)&&typeof c.token==='string'&&/^[a-f0-9]{64}$/.test(c.token));
 const incompatible=status=>Object.assign(new Error(mismatch),{status,code:'API_VERSION_MISMATCH'});
 let configPromise=null;
 async function rawRequest(path,{method='GET',data,token,signal,keepalive=false}={}){
  if(!/^https?:$/.test(location.protocol))throw new Error('即時連線版請從 Render 網址開啟，不能直接雙擊 HTML 檔案。');
  let response;
  try{response=await fetch(path,{method,headers:{...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data),signal,keepalive,cache:'no-store'});}
  catch(error){if(error.name==='TimeoutError')throw new Error('連線逾時，服務可能正在啟動。請稍後重試；不要在挑戰中重新整理。');throw error;}
  let value;try{value=await response.json();}catch{throw Object.assign(new Error('目前網址沒有回傳遊戲 API。請開啟 Render Web Service 的 /display 或 /phone，不是 GitHub Pages 或本機 HTML。'),{status:response.status,code:'API_NOT_JSON'});}
  if(!response.ok){
   if(response.status===404&&(path==='/api/config'||/找不到\s*API/.test(value.error||'')))throw incompatible(404);
   throw Object.assign(new Error(value.error||'連線未完成。'),{status:response.status});
  }
  return value;
 }
 async function ensureApi(){
  if(!configPromise)configPromise=rawRequest('/api/config',{signal:AbortSignal.timeout(10000)}).then(c=>{
   if(!c||c.apiProtocol!==PROTOCOL)throw incompatible(409);return c;
  }).catch(e=>{configPromise=null;throw e;});
  return configPromise;
 }
 async function request(path,options={}){
  // Check protocol before creating/pairing, never while a child is timing a round.
  if((options.method||'GET')==='POST'&&(path==='/api/rooms'||path==='/api/pair'))await ensureApi();
  return rawRequest(path,options);
 }
 class Session {
  constructor(role,onState,onStatus){this.role=role;this.key='lizhe-live-v4.2.1-'+role;this.onState=onState;this.onStatus=onStatus;this.creds=null;this.last=null;this.alive=false;this.controller=null;this.lastContact=0;try{this.creds=JSON.parse(sessionStorage.getItem(this.key)||'null');}catch{}if(!validCreds(this.creds)){this.creds=null;try{sessionStorage.removeItem(this.key);}catch{}}}
  adopt(creds){if(!validCreds(creds))throw incompatible(409);this.stop();this.last=null;this.creds={id:creds.id,token:creds.token};try{sessionStorage.setItem(this.key,JSON.stringify(this.creds));}catch{}if(creds.state)this.accept(creds.state);this.connect();}
  accept(state){this.lastContact=Date.now();if(this.last&&state.id===this.last.id&&state.revision<this.last.revision)return;this.last=state;this.onState?.(state);}
  url(suffix){if(!validCreds(this.creds))throw new Error('房間資料無效，請重新建立房間並配對。');return '/api/rooms/'+this.creds.id+'/'+suffix;}
  async refresh(){const s=await request(this.url('state'),{token:this.creds.token,signal:AbortSignal.timeout(8000)});this.accept(s);return s;}
  async action(type,extra={}){const a={type,actionId:uid(),...extra};return this.send(a);}
  async send(a){const s=await request(this.url('action'),{method:'POST',data:a,token:this.creds.token,signal:AbortSignal.timeout(8000)});this.accept(s);return s;}
  async connect(){
   if(!this.creds)return;this.stop();this.alive=true;const generation=this.generation=(this.generation||0)+1;let delay=1000;
   this.onStatus?.('connecting');
   while(this.alive&&this.generation===generation){
    this.controller=new AbortController();let watch;
    try{
     const response=await fetch(this.url('events'),{headers:{Authorization:'Bearer '+this.creds.token},signal:this.controller.signal,cache:'no-store'});
     if(!response.ok)throw Object.assign(new Error('串流未建立'),{status:response.status});
     this.onStatus?.('online');delay=1000;let touched=Date.now();
     watch=setInterval(()=>{if(Date.now()-touched>35000)this.controller?.abort();},5000);
     const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
     while(this.alive&&generation===this.generation){const chunk=await reader.read();if(chunk.done)throw new Error('stream ended');touched=Date.now();this.lastContact=touched;buffer+=decoder.decode(chunk.value,{stream:true});
      let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);let name='message',payload='';for(const line of event.split('\n')){if(line.startsWith('event:'))name=line.slice(6).trim();if(line.startsWith('data:'))payload+=line.slice(5).trim();}
       if(name==='state'){this.accept(JSON.parse(payload));this.onStatus?.('online');}else if(name==='expired')throw Object.assign(new Error('配對已撤銷'),{status:401});}
     }
    }catch(error){
     if(!this.alive||generation!==this.generation)break;
     if([401,410].includes(error.status)){this.onStatus?.('expired');this.stop();break;}
     this.onStatus?.('offline');
     // If an intermediary buffers SSE, REST state refresh remains available.
     try{await this.refresh();this.onStatus?.('polling');}catch(e){if([401,410].includes(e.status)){this.onStatus?.('expired');this.stop();break;}}
    }finally{clearInterval(watch);}
    await wait(delay);delay=Math.min(6000,delay*1.6);
   }
  }
  stop(){this.alive=false;this.controller?.abort();}
  clear(){this.stop();this.creds=null;this.last=null;try{sessionStorage.removeItem(this.key);}catch{}}
 }
 window.Live={Session,request,uid,ensureApi,version:VERSION,protocol:PROTOCOL};
})();
