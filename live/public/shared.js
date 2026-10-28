'use strict';
window.Live={
 id(){if(crypto.randomUUID)return crypto.randomUUID();const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');},
 async request(url,body,token,method=body===undefined?'GET':'POST'){
  const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),7000);
  try{const r=await fetch(url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal,cache:'no-store'});let d;try{d=await r.json();}catch{throw new Error('服務啟動中或連線不穩，請稍後重試。');}if(!r.ok){const e=new Error(d.error||'連線失敗');e.status=r.status;throw e;}return d;}catch(e){if(e.name==='AbortError')throw new Error('連線逾時，請確認網路後重試。');throw e;}finally{clearTimeout(t);}
 },
 save(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}},
 load(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}},
 remove(key){try{sessionStorage.removeItem(key);}catch{}},
 stream(room,token,onState,onConnection){
  let stopped=false,ctrl=null,delay=500,timer=null,heartbeat=null;
  const run=async()=>{
   if(stopped)return;ctrl=new AbortController();
   try{const r=await fetch(`/api/rooms/${room}/events`,{headers:{Authorization:'Bearer '+token},signal:ctrl.signal,cache:'no-store'});if(!r.ok){let d=await r.json();let e=new Error(d.error);e.status=r.status;throw e;}
    onConnection(true);delay=500;let text='';const reader=r.body.getReader(),decoder=new TextDecoder();
    const reset=()=>{clearTimeout(heartbeat);heartbeat=setTimeout(()=>ctrl.abort(),28000);};reset();
    while(!stopped){const {value,done}=await reader.read();if(done)break;reset();text+=decoder.decode(value,{stream:true});let i;while((i=text.indexOf('\n\n'))>=0){const packet=text.slice(0,i);text=text.slice(i+2);const data=packet.split('\n').find(l=>l.startsWith('data: '));if(data)onState(JSON.parse(data.slice(6)));}}
    if(!stopped)throw new Error('正在重新連線…');
   }catch(e){if(stopped)return;onConnection(false,e);if([401,410].includes(e.status)){stopped=true;return;}}
   finally{clearTimeout(heartbeat);}
   if(!stopped){timer=setTimeout(run,delay);delay=Math.min(delay*1.8,5000);}
  };run();return()=>{stopped=true;clearTimeout(timer);clearTimeout(heartbeat);ctrl?.abort();};
 },
 csv(rows){const data='\uFEFF'+[['序號','秒數','成功','已領禮物'],...rows.map(r=>[r.number,r.seconds,r.success?'是':'否',r.giftClaimed?'是':'否'])].map(r=>r.join(',')).join('\r\n');const a=document.createElement('a');const u=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='麗喆303班_挑戰紀錄.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
};
