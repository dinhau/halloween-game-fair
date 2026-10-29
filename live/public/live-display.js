(() => {
 'use strict';const $=id=>document.getElementById(id);let state=null,lastRound=null,lastPhase=null,pairData=null;
 const panel=$('live-connect'),badge=$('live-status'),overlay=$('live-result');let offline=false;
 const session=new Live.Session('host',apply,status);
 function err(e){$('live-error').textContent=e.message||String(e);}
 function status(s){badge.dataset.status=s;badge.querySelector('span').textContent={online:'即時連線中',connecting:'連線中…',offline:'連線中斷・正在重連',polling:'備援同步中',expired:'房間失效・請重新配對'}[s]||s;offline=['offline','expired','connecting'].includes(s);$('live-warning').hidden=!offline||!session.creds;
  $('live-warning').textContent=s==='expired'?'房間已失效，請按 K 重新建立並配對。':'連線中斷：螢幕可能不是最新結果，請暫停發獎。';
  if(s==='expired'){$('create-room').hidden=false;$('live-create-box').hidden=false;$('live-pair-box').hidden=true;session.clear();}
 }
 function resultSound(win){window.DisplayBridge?.resultSound(win);}
 function apply(s){
  state=s;const q=s.round;window.DisplayBridge?.setScene(s.scene);
  $('live-room-info').textContent=`房間 ${s.id.slice(0,6).toUpperCase()} · 手機${s.phoneOnline?'已連線':s.paired?'已配對':'尚未配對'}`;
  if(panel.open&&s.paired){$('live-pair-note').textContent='手機已配對。關閉此視窗即可展示；不要把控制手機交給其他人自由操作。';$('live-qr').innerHTML='';$('live-code').textContent='已配對';}
  const show=q&&['running','result','interrupted'].includes(q.phase)&&s.scene==='seal';overlay.hidden=!show;
  if(show){
   const number=String(q.number).padStart(3,'0');$('live-tag').textContent=`十秒封印術 · 第 ${number} 位挑戰者`;
   const running=q.phase==='running',interrupted=q.phase==='interrupted',win=q.result?.win;
   const kind=running?'running':interrupted?'interrupted':win?'success':'failure';overlay.dataset.kind=kind;
   $('live-title').textContent=running?'封印進行中':interrupted?'挑戰暫停':win?'封印成功！':'封印差一點！';
   $('live-score').hidden=running||interrupted;$('live-ghost').toggleAttribute('hidden',!running&&!interrupted);
   $('live-seconds').textContent=q.result?.seconds||'';
   $('live-message').textContent=running?'把時間藏起來，讓直覺發光。':interrupted?'請工作人員確認本局狀況。':win?'神祕小禮物 × 1':'謝謝挑戰，勇氣滿分！';
   $('live-detail').textContent=running?'大家一起靜靜等待，請不要報秒。':interrupted?'本局不會自動重新開始，也不自動發獎。':win?(q.giftGiven?'工作人員已確認禮物發放':'成功範圍 9.50～10.50 秒 · 請向工作人員領取小禮物'):'本次未獲小禮物；兌換的糖果不退回。';
   $('live-footer-note').textContent=running?'停止後才揭曉成績｜此畫面不顯示秒數或倒數':'結果將保留至工作人員確認下一位';
   if(q.phase==='result'&&(lastRound!==q.id||lastPhase!=='result')){resultSound(!!win);if(win)confetti();}
  }
  lastRound=q?.id;lastPhase=q?.phase;
 }
 function confetti(){const box=$('live-confetti');box.replaceChildren();if(document.body.dataset.motion==='off')return;for(let i=0;i<48;i++){const p=document.createElement('i');p.style.cssText=`--x:${Math.random()*100}%;--c:${['#b9f8d4','#ffdb94','#d8b9fa'][i%3]};--t:${2+Math.random()*2}s;--d:${Math.random()*.7}s`;box.append(p);}setTimeout(()=>box.replaceChildren(),5000);}
 async function pairing(){
  if(!session.creds){$('live-create-box').hidden=false;$('live-pair-box').hidden=true;return;}
  pairData=await Live.request(session.url('pairing'),{token:session.creds.token});$('live-create-box').hidden=true;$('live-pair-box').hidden=false;
  $('live-qr').innerHTML=pairData.svg||'';$('live-code').textContent=pairData.code||'已配對';$('live-phone-url').textContent=location.origin+'/phone';
  $('live-pair-note').textContent=pairData.code?'僅供工作人員掃描。配對碼限用一次，10 分鐘有效。':'手機已配對。切勿再用舊 QR code 加入。';
 }
 async function openPanel(){try{if(!panel.open)panel.showModal();$('live-error').textContent='';const c=await Live.ensureApi();if($('live-api-version'))$('live-api-version').textContent='同步伺服器 v'+c.version+' · API 已確認';await pairing();}catch(e){err(e);}}
 $('live-open').onclick=openPanel;$('live-close').onclick=()=>panel.close();$('live-skip').onclick=()=>panel.close();
 $('create-room').onclick=async()=>{const b=$('create-room');b.disabled=true;try{const c=await Live.request('/api/rooms',{method:'POST',data:{pin:$('event-pin').value}});session.adopt(c);await pairing();}catch(e){err(e);}finally{b.disabled=false;}};
 $('live-repair').onclick=async()=>{if(!confirm('重新配對會讓原手機失去控制權。確定更換手機？'))return;try{await session.action('pair-code');await pairing();}catch(e){err(e);}};
 $('live-copy').onclick=async()=>{try{await navigator.clipboard.writeText(pairData?.phoneURL||location.origin+'/phone');$('live-pair-note').textContent='手機入口已複製。請只傳給工作人員。';}catch{err(new Error('請手動開啟 '+location.origin+'/phone 並輸入配對碼。'));}};
 async function scene(next){if(!session.creds)return window.DisplayBridge?.setScene(next);try{await session.action('scene',{scene:next});}catch(e){window.DisplayBridge?.toast(e.message);}}
 // Capture existing controls before the standalone handlers, preserving F/M/A/H.
 document.addEventListener('click',e=>{if(e.target.closest('#phone-entry')){e.preventDefault();e.stopImmediatePropagation();openPanel();}else if(e.target.closest('#scene-toggle')&&session.creds){e.preventDefault();e.stopImmediatePropagation();scene(state?.scene==='seal'?'house':'seal');}},true);
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if(k==='k'){e.preventDefault();e.stopImmediatePropagation();openPanel();}else if(session.creds&&['s','g'].includes(k)){e.preventDefault();e.stopImmediatePropagation();scene(k==='g'?'house':state?.scene==='seal'?'house':'seal');}},true);
 Live.ensureApi().then(c=>{$('pin-label').hidden=!c.pinRequired;if($('live-api-version'))$('live-api-version').textContent='同步伺服器 v'+c.version+' · API 已確認';}).catch(err);
 if(session.creds){session.refresh().then(()=>session.connect()).catch(()=>{session.clear();openPanel();});}else openPanel();
})();
