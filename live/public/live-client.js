/* Same-origin API + authenticated SSE. Secrets stay out of URLs and referrers. */
(() => {
 'use strict';
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 async function request(path,{method='GET',data,token,signal,keepalive=false}={}){
  const response=await fetch(path,{method,headers:{...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data),signal,keepalive,cache:'no-store'});
  const value=await response.json().catch(()=>({error:'伺服器尚未就緒，請稍後重試。'}));
  if(!response.ok)throw Object.assign(new Error(value.error||'連線未完成。'),{status:response.status});return value;
 }
 class Session {
  constructor(role,onState,onStatus){this.role=role;this.key='lizhe-live-v4-'+role;this.onState=onState;this.onStatus=onStatus;this.creds=null;this.last=null;this.alive=false;this.controller=null;this.lastContact=0;try{this.creds=JSON.parse(sessionStorage.getItem(this.key)||'null');}catch{}}
  adopt(creds){this.stop();this.creds={id:creds.id,token:creds.token};try{sessionStorage.setItem(this.key,JSON.stringify(this.creds));}catch{}if(creds.state)this.accept(creds.state);this.connect();}
  accept(state){this.lastContact=Date.now();if(this.last&&state.id===this.last.id&&state.revision<this.last.revision)return;this.last=state;this.onState?.(state);}
  url(suffix){return '/api/rooms/'+this.creds.id+'/'+suffix;}
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
 window.Live={Session,request,uid};
})();
