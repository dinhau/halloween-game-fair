(()=>{'use strict';
 const $=id=>document.getElementById(id),key='lize303-live-host-v4';let credentials=Live.load(key),state=null,stopStream=null,lastSound='',qrURL='',connected=false;
 const panel=$('phone-dialog'),badge=$('live-badge');
 const error=msg=>{$('pair-error').textContent=msg||'';};
 function setConnected(on,e){connected=on;badge.className='live-badge '+(on?'connected':'error');badge.textContent=on?(state?.connected?'● 手機已配對 · P':'● 房間已連線 · P'):'○ 連線中斷 · P';if(e?.status===410||e?.status===401){error(e.message);$('rebuild').hidden=false;}else if(e)error('連線暫時中斷；畫面保留，重新連線中。');}
 async function api(action,data){if(!credentials)throw new Error('請先建立配對房間');return Live.request(`/api/rooms/${credentials.room}/${action}`,data,credentials.token);}
 function accept(s){if(credentials&&s.id!==credentials.room)return;if(state&&s.version<state.version)return;state=s;window.liveState=s;error('');window.Haunted?.setScene(s.scene,true);window.Haunted?.audience(s.phase);
  $('create-room').hidden=true;$('pair-info').hidden=false;$('export').hidden=false;$('rebuild').hidden=false;$('unlink').hidden=!s.connected;
  $('room-code').textContent=s.pairCode;$('pair-status').textContent=s.connected?'已配對。只有此手機可開局與送出結果。':'尚無手機：掃描後，核對四位驗證碼再核准。';
  const u=new URL('/phone.html',location.href);u.hash=new URLSearchParams({room:s.id,code:s.pairCode,secret:s.pairSecret}).toString();
  if(qrURL!==u.href){qrURL=u.href;const a=$('pair-url');a.href=qrURL;if(window.qrcode){try{const qr=qrcode(0,'M');qr.addData(qrURL);qr.make();$('pair-qr').innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true});}catch{$('pair-qr').textContent='網址較長，請使用右側複製連結。';}}}
  $('pair-pending').replaceChildren();for(const p of s.pending||[]){const box=document.createElement('div');box.className='pair-request';const txt=document.createElement('span');txt.textContent='手機驗證碼 ';const n=document.createElement('strong');n.textContent=p.verify;box.append(txt,n);for(const [text,action]of [['核准','approve'],['拒絕','reject']]){const b=document.createElement('button');b.textContent=text;b.disabled=['ready','running'].includes(s.phase);b.onclick=()=>command(action,{request:p.id});box.append(b);}$('pair-pending').append(box);}
  if((s.pending||[]).length&&!panel.open)panel.showModal();
  const shown=['running','result','interrupted'].includes(s.phase);$('audience').hidden=!shown;
  if(shown){const result=s.round?.result,success=result?.success;$('audience').dataset.outcome=s.phase==='result'?(success?'success':'failure'):s.phase;
   $('round-label').textContent=`挑戰者 ${String(s.round.number).padStart(3,'0')}`;
   $('outcome-heading').textContent=s.phase==='running'?'封印挑戰中':s.phase==='interrupted'?'挑戰暫停':success?'封印成功！':'差一點點！';
   $('outcome-number').replaceChildren();$('outcome-number').textContent=result?result.seconds:'??.??';if(result){const small=document.createElement('small');small.textContent='秒';$('outcome-number').append(small);}
   $('outcome-detail').textContent=s.phase==='running'?'請保持神祕，不要報秒':s.phase==='interrupted'?'連線或操作中斷，請工作人員確認':success?'你抓住了神祕的十秒！':'挑戰未成功，謝謝你的勇敢挑戰！';
   $('outcome-prize').textContent=s.phase==='running'?'手機停止後，全場一起揭曉':s.phase==='interrupted'?'本局不自動判定成功或失敗':success?(s.round.giftClaimed?'✓ 小禮物已領取':'獲得小禮物 1 份'):'成功範圍 9.50～10.50 秒';
   $('audience-staff').hidden=s.phase==='running';$('abort-round').hidden=s.phase!=='running';
   if(s.phase==='result'&&lastSound!==s.round.id){lastSound=s.round.id;window.Haunted?.celebrate(success);$('confetti').replaceChildren();if(success&&window.Haunted?.motion)for(let i=0;i<34;i++){const e=document.createElement('i');e.className='confetto';e.style.setProperty('--x',`${(i*37)%100}%`);e.style.setProperty('--delay',`${(i%8)*.18}s`);e.style.setProperty('--dur',`${3+i%4*.45}s`);e.style.setProperty('--color',['#ffca7c','#9cf2ce','#d9b8ff','#fff3dd'][i%4]);$('confetti').append(e);}}
  }else{$('next-confirm').checked=false;$('next-round').disabled=true;}
  setConnected(connected);
 }
 async function command(action,d={}){try{accept(await api(action,d));if(action==='approve')window.Haunted?.toast('工作人員手機已配對，可以在手機準備下一局。');}catch(e){error(e.message);window.Haunted?.toast(e.message);}}
 function open(){if(!panel.open)panel.showModal();}
 function connect(){stopStream?.();stopStream=Live.stream(credentials.room,credentials.token,accept,setConnected);}
 async function create(){try{error('正在建立房間…');const d=await Live.request('/api/rooms',{});credentials={room:d.room,token:d.token};Live.save(key,credentials);state=null;accept(d.state);connect();}catch(e){error(e.message);}}
 $('phone-entry').textContent='連線手機';$('phone-entry').onclick=open;badge.onclick=open;$('close-pair').onclick=()=>panel.close();$('create-room').onclick=create;
 $('copy-pair').onclick=async()=>{try{await navigator.clipboard.writeText(qrURL);error('配對網址已複製，僅分享給工作人員。');}catch{error('請長按上方連結複製，或直接掃描 QR。');}};
 $('unlink').onclick=()=>{if(confirm('解除目前手機？要重新掃描並核准才能再玩。'))command('unpair');};
 $('export').onclick=()=>Live.csv(state?.history||[]);
 $('rebuild').onclick=()=>{if(confirm('重建後會與舊房間分開，請先匯出紀錄，手機也須重新掃描。確定重建？'))create();};
 $('next-confirm').onchange=e=>$('next-round').disabled=!e.target.checked;
 $('next-round').onclick=()=>{if($('next-confirm').checked)command('next',{roundId:state?.round?.id,confirmed:true});};
 $('abort-round').onclick=()=>{if(confirm('確認中止這局？不會直接判定成功或失敗。'))command('interrupt',{roundId:state?.round?.id});};
 window.addEventListener('live-scene',e=>{if(credentials)command('scene',{scene:e.detail});});
 document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&!e.target.matches('input,textarea,select')){e.preventDefault();open();}});
 if(credentials){connect();Live.request(`/api/rooms/${credentials.room}/state`,undefined,credentials.token).then(accept).catch(e=>{error(e.message);$('create-room').hidden=false;open();});}
 setInterval(()=>{if(credentials&&!document.hidden)api('ping',{}).catch(e=>setConnected(false,e));},15000);
 window.addEventListener('pagehide',()=>stopStream?.());
})();
