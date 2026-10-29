(() => {
 'use strict';const $=id=>document.getElementById(id);let state=null,link='offline',busy=false,flushing=false,localMode=null,started=0,provisional=null,outbox=[],blockError=false;
 const OUT='lizhe-live-v4-outbox';const session=new Live.Session('phone',s=>{state=s;render();},status);
 function message(text){$('phone-message').hidden=!text;$('phone-message').textContent=text;}
 function save(){try{sessionStorage.setItem(OUT,JSON.stringify({room:session.creds?.id,outbox,provisional,localMode:localMode==='running'?'lost':localMode}));}catch{message('此瀏覽器無法保存斷線備份，請保持連線且不要關閉分頁。');}}
 function status(s){link=s;$('connection').textContent={online:'已連線',polling:'備援同步',offline:'斷線重連中',connecting:'連線中',expired:'配對已失效'}[s]||s;$('connection').classList.toggle('online',['online','polling'].includes(s));
  if(s==='expired'){blockError=true;message('房間或配對已失效。先保存本局資訊，請工作人員到螢幕重新建立房間。');}
  render();
 }
 const connected=()=>session.creds&&['online','polling'].includes(link)&&Date.now()-session.lastContact<35000;
 // v4.1 layout-only addition: fit the visible mobile viewport, keeping the tap target in place.
 // Ignore pinch-zoom height changes; zooming remains available for accessibility.
 let lastScreen='';
 function fitViewport(){
  if(window.visualViewport&&Math.abs(window.visualViewport.scale-1)>.02)return;
  const h=Math.floor(Math.min(window.innerHeight,window.visualViewport?.height||window.innerHeight));
  if(h>0)document.documentElement.style.setProperty('--phone-height',h+'px');
 }
 fitViewport();window.addEventListener('resize',fitViewport,{passive:true});
 window.visualViewport?.addEventListener('resize',fitViewport,{passive:true});
 window.addEventListener('orientationchange',()=>requestAnimationFrame(fitViewport),{passive:true});
 const staffDialog=$('staff-dialog');
 $('open-staff').addEventListener('click',()=>{if(!staffDialog.open)staffDialog.showModal();});
 for(const id of ['close-staff','done-staff'])$(id).addEventListener('click',()=>staffDialog.close());
 staffDialog.addEventListener('click',e=>{
  if(e.target!==staffDialog)return;const r=staffDialog.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)staffDialog.close();
 });
 function panels(show){
  for(const id of ['join-panel','setup-panel','game-panel','result-panel'])$(id).hidden=id!==show;
  const next=show.replace('-panel','');document.body.dataset.screen=next;
  if(next!==lastScreen){
   lastScreen=next;
   if(document.activeElement?.matches('input'))document.activeElement.blur();
   if(staffDialog.open)staffDialog.close();
   $(show).scrollTop=0;window.scrollTo(0,0);fitViewport();
  }
 }
 function render(){
  if(!session.creds){panels('join-panel');return;}
  $('round-info').textContent=`本房間 ${state?.rounds||0} 局 · 已確認發出 ${state?.giftCount||0} 份禮物`;
  if(localMode==='running') {panels('game-panel');$('touch-pad').disabled=false;$('touch-pad').classList.add('running');$('tap-title').textContent='點一下停止';$('tap-sub').textContent='時間藏起來了，跟著你的直覺。';$('abort').hidden=false;return;}
  if(outbox.length||localMode==='stopped'||localMode==='interrupted'){
   panels('result-panel');$('result-panel').classList.remove('success');$('result-tag').textContent='本局已結束，不能重試';$('result-title').textContent=localMode==='interrupted'?'挑戰已中止':'結果同步中';
   $('result-number').textContent=provisional?.seconds||'—';$('result-text').textContent='正式結果以伺服器確認後的畫面為準。';$('pending-text').hidden=false;$('retry-sync').hidden=false;$('give-gift').hidden=true;$('next-player').hidden=true;return;
  }
  const q=state?.round;
  if(!q){panels('setup-panel');$('prepare').disabled=!$('eligible').checked||!$('exchanged').checked||!connected()||busy;return;}
  $('player-label').textContent=`第 ${String(q.number).padStart(3,'0')} 位挑戰者`;
  if(q.phase==='ready'){
   panels('game-panel');$('touch-pad').classList.remove('running');$('touch-pad').disabled=!connected()||busy;$('tap-title').textContent='點一下開始';$('tap-sub').textContent='看不到秒數 · 心裡估計 10 秒';$('abort').hidden=false;return;
  }
  if(q.phase==='running'){panels('result-panel');$('result-title').textContent='計時狀態待確認';$('result-tag').textContent='請勿重複開始';$('result-number').textContent='—';$('result-text').textContent='頁面可能曾重新整理，請工作人員中止本局。';$('pending-text').hidden=true;$('give-gift').hidden=true;$('next-player').hidden=true;$('retry-sync').hidden=false;return;}
  panels('result-panel');const win=q.phase==='result'&&q.result?.win;
  $('result-panel').classList.toggle('success',!!win);$('result-tag').textContent=`第 ${String(q.number).padStart(3,'0')} 位 · 結果已同步`;
  $('result-title').textContent=q.phase==='interrupted'?'挑戰已中止':win?'封印成功！':'封印差一點！';
  $('result-number').textContent=q.result?.seconds||'—';$('result-text').textContent=q.phase==='interrupted'?'請由工作人員確認，不自動重試。':win?(q.giftGiven?'小禮物已確認發放。':'獲得神祕小禮物 × 1！'):'謝謝挑戰！本次沒有小禮物，糖果不退回。';
  $('pending-text').hidden=true;$('retry-sync').hidden=true;$('give-gift').hidden=!win||q.giftGiven;$('give-gift').disabled=!connected()||busy;
  $('next-player').hidden=win&&!q.giftGiven;$('next-player').disabled=!connected()||busy;
 }
 function enqueue(type,extra={}){outbox.push({type,actionId:Live.uid(),...extra});save();flush();}
 async function flush(){
  if(flushing||!session.creds||!outbox.length||blockError)return;flushing=true;
  try{while(outbox.length){await session.send(outbox[0]);outbox.shift();save();}
   if(localMode!=='running'){localMode=null;provisional=null;}save();message('');render();
  }catch(e){if(e.status&&e.status!==429&&e.status<500){blockError=true;message('同步未完成：'+e.message+' 請勿重試遊戲或發獎。');}else message('網路不穩，正在保留本局並重試同步。請留在這個頁面。');}
  finally{flushing=false;render();}
 }
 async function recover(){
  try{const saved=JSON.parse(sessionStorage.getItem(OUT)||'null');if(saved?.room===session.creds?.id){outbox=Array.isArray(saved.outbox)?saved.outbox:[];provisional=saved.provisional||null;localMode=provisional?'stopped':saved.localMode==='interrupted'?'interrupted':null;}}
  catch{}
  const pendingEnd=outbox.some(a=>['stop','abort'].includes(a.type));const pendingStart=outbox.find(a=>a.type==='start');
  if(!pendingEnd&&(pendingStart||state?.phase==='running')){
   localMode='interrupted';outbox.push({type:'abort',roundId:pendingStart?.roundId||state.round.id,actionId:Live.uid()});save();
  }
  if(outbox.length)flush();else render();
 }
 async function control(fn){if(busy)return;busy=true;render();try{await fn();message('');}catch(e){message(e.message);}finally{busy=false;render();}}
 $('join').onclick=()=>control(async()=>{
  const code=$('pair-input').value.replace(/\D/g,'');if(code.length!==6)throw new Error('請輸入六位數字配對碼。');
  const c=await Live.request('/api/pair',{method:'POST',data:{code}});outbox=[];provisional=null;localMode=null;blockError=false;session.adopt(c);history.replaceState(null,'',location.pathname);save();
 });
 for(const id of ['eligible','exchanged'])$(id).onchange=render;
 $('prepare').onclick=()=>control(async()=>{if(!connected())throw new Error('請先恢復連線。');await session.action('prepare',{eligible:$('eligible').checked,exchanged:$('exchanged').checked});$('eligible').checked=false;$('exchanged').checked=false;});
 function touch(){
  if(localMode==='running'){
   const ms=Math.max(0,Math.round(performance.now()-started));localMode='stopped';provisional={milliseconds:ms,seconds:(Math.round(ms/10)/100).toFixed(2)};
   enqueue(ms<=120000?'stop':'abort',{roundId:state.round.id,...(ms<=120000?{milliseconds:ms}:{})});render();return;
  }
  if(state?.phase!=='ready'||!connected()||outbox.length||localMode)return;
  started=performance.now();localMode='running';enqueue('start',{roundId:state.round.id});render();
 }
 let lastPointerAt=-Infinity;
 $('touch-pad').addEventListener('pointerdown',e=>{if(e.button!==0||$('touch-pad').disabled)return;lastPointerAt=performance.now();e.preventDefault();touch();});
 // Mobile may emit a zero-detail synthetic click after pointerdown. Do not count one tap twice.
 $('touch-pad').addEventListener('click',e=>{if(e.detail===0&&performance.now()-lastPointerAt>700&&!$('touch-pad').disabled)touch();});
 function interrupt(){if(!state?.round||!['running','ready'].includes(state.phase)&&localMode!=='running')return;localMode='interrupted';provisional=null;enqueue('abort',{roundId:state.round.id});render();}
 $('abort').onclick=()=>{if(confirm('確定中止本局？不會自動獲得重試機會。'))interrupt();};
 $('retry-sync').onclick=()=>{if(blockError){message('此局需要工作人員確認。請先匯出紀錄，勿重新挑戰冒領。');return;}if(state?.phase==='running'&&localMode!=='running'&&!outbox.length)interrupt();else flush();};
 $('give-gift').onclick=()=>control(async()=>{await session.action('gift',{roundId:state.round.id});});
 $('next-player').onclick=()=>{if(!confirm('已確認本局結果，結束並準備下一位？'))return;control(async()=>{await session.action('next',{roundId:state.round.id});$('eligible').checked=false;$('exchanged').checked=false;});};
 $('show-secret').onclick=()=>control(()=>session.action('scene',{scene:'seal'}));$('return-house').onclick=()=>control(()=>session.action('scene',{scene:'house'}));
 $('reset-pair').onclick=()=>{if(!confirm('清除手機配對？有未同步結果時請先匯出，並通知大螢幕操作員。'))return;session.clear();outbox=[];localMode=null;provisional=null;blockError=false;sessionStorage.removeItem(OUT);state=null;message('');render();};
 $('export').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),room:state?.id,rounds:state?.history||[],current:state?.round,pending:outbox,provisional},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='麗喆303班_闖關紀錄_'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&localMode==='running')interrupt();else if(!document.hidden&&session.creds){session.refresh().catch(()=>{});flush();}});
 window.addEventListener('pagehide',()=>{if(localMode==='running')interrupt();if(session.creds&&outbox.length){fetch(session.url('action'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.creds.token},body:JSON.stringify(outbox[0]),keepalive:true}).catch(()=>{});}});
 window.addEventListener('online',()=>{flush();if(session.creds)session.refresh().catch(()=>{});});setInterval(flush,2000);
 const code=new URLSearchParams(location.hash.slice(1)).get('code');if(code&&/^\d{6}$/.test(code))$('pair-input').value=code;
 if(session.creds){session.refresh().then(async()=>{await recover();session.connect();}).catch(e=>{message(e.message);if([401,410].includes(e.status))session.clear();render();});}else render();
})();
