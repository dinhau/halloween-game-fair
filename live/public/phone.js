(()=>{'use strict';
 const $=id=>document.getElementById(id),KEY='lize303-live-phone-v4',PENDING='lize303-live-finish-v4';
 let auth=Live.load(KEY),state=null,stopStream=null,poll=null,connected=false,started=null,startPromise=null,localPhase=null,submitting=false,requestId=Live.id(),lastRender='',wake=null,interrupted=false;
 const hash=new URLSearchParams(location.hash.slice(1));const invitation=hash.get('secret')?{room:hash.get('room'),code:hash.get('code'),secret:hash.get('secret')}:null;
 const err=msg=>$('error').textContent=msg||'';
 const api=(action,data)=>Live.request(`/api/rooms/${auth.room}/${action}`,data,auth.token);
 const setOnline=(yes,e)=>{connected=yes;$('conn').className=yes?'online':'';$('conn').textContent=yes?'● 已連線大螢幕':'○ 連線暫時中斷';if(e){err(e.message||'正在重新連線。計時已開始時，仍可按停止暫存結果。');if([401,410].includes(e.status)){stopStream?.();$('disconnect').hidden=false;}}if(state?.phase==='idle'){const b=$('arm');if(b)b.disabled=!yes||!$('eligible')?.checked||!$('exchange')?.checked;}if(yes&&Live.load(PENDING)&&!submitting)sendFinish();};
 async function holdScreen(){try{if(navigator.wakeLock)wake=await navigator.wakeLock.request('screen');}catch{}}
 function releaseScreen(){wake?.release().catch(()=>{});wake=null;}
 function accept(s){if(auth&&s.id!==auth.room)return;if(state&&s.version<state.version)return;state=s;$('pair-stage').hidden=true;$('game-stage').hidden=false;$('disconnect').hidden=false;
  if(s.phase==='result'){Live.remove(PENDING);localPhase=null;started=null;releaseScreen();}
  if(s.phase==='interrupted'){localPhase=null;started=null;releaseScreen();}
  if(s.phase==='idle'){localPhase=null;started=null;interrupted=false;Live.remove(PENDING);requestId=Live.id();}
  // A running round after refresh has lost its monotonic clock; do not grant a replay.
  if(s.phase==='running'&&started===null&&!Live.load(PENDING)&&!interrupted){interrupted=true;api('interrupt',{roundId:s.round.id}).then(accept).catch(e=>err(e.message));}
  render();
 }
 async function join(){try{$('join-retry').hidden=true;err('');if(!invitation)throw new Error('請先掃描螢幕顯示的 QR code。');const d=await Live.request('/api/join',invitation);auth={room:d.room,token:d.token,request:d.request,verify:d.verify,approved:false};Live.save(KEY,auth);history.replaceState(null,'',location.pathname);await awaitApproval();}catch(e){err(e.message);$('join-retry').hidden=false;}}
 async function awaitApproval(){clearTimeout(poll);$('verify').textContent=auth.verify||'';$('pair-message').textContent='請在大螢幕核對此四位碼，按「核准」。';
  try{const d=await api('pair-status',{request:auth.request});if(d.approved){auth.approved=true;Live.save(KEY,auth);accept(d.state);connect();}else poll=setTimeout(awaitApproval,1200);}catch(e){err(e.message);$('join-retry').hidden=!invitation;}}
 function connect(){stopStream?.();stopStream=Live.stream(auth.room,auth.token,accept,setOnline);}
 function staffHTML(){return `<div class="staff-box"><label class="check"><input id="next-check" type="checkbox">工作人員確認：這位已完成，換下一位。</label><button id="next" class="primary" disabled>下一位 · 回鬼屋抽樓板</button></div>`;}
 function render(){
  if(!state)return;const phase=localPhase||state.phase;const sig=JSON.stringify([phase,state.round?.id,state.round?.result,state.round?.giftClaimed]);if(sig===lastRender)return;lastRender=sig;
  $('round').textContent=state.round?`挑戰者 ${String(state.round.number).padStart(3,'0')} · 僅此一次`:'工作人員開局確認';const box=$('game-content');
  if(phase==='idle'){
   box.innerHTML=`<h2>要用 5 顆糖，換一次挑戰嗎？</h2><div class="rules">停在 <b>9.50～10.50 秒</b>（含兩端）<br>成功：<b>小禮物 1 份</b><br>未成功：沒有小禮物，糖果不退回。<br>每人只有一次，請先清楚說明。</div><label class="check"><input id="eligible" type="checkbox">這位同學抽樓板第 1 次就成功。</label><label class="check"><input id="exchange" type="checkbox">同學自願用 5 顆糖兌換，糖果已處理。</label><button id="arm" class="primary" disabled>確認資格 · 開放本局</button>`;
   const check=()=>$('arm').disabled=!connected||!$('eligible').checked||!$('exchange').checked;for(const id of ['eligible','exchange'])$(id).onchange=check;
   $('arm').onclick=async()=>{const button=$('arm');button.disabled=true;try{err('');accept(await api('arm',{eligible:true,exchange:true,requestId}));}catch(e){err(e.message);button.disabled=false;}};
  }else if(phase==='ready'){
   box.innerHTML=`<h2 class="center">準備好了嗎？</h2><p class="hint">目標時間</p><div class="target">10.00<small>秒</small></div><button id="touch" class="game-button" aria-label="開始封印計時">開始</button><p class="hint">點一下開始，心裡估計 10 秒。<br>再點一下停止。過程不顯示秒數。</p>`;bindTouch(start);
  }else if(phase==='running'){
   box.innerHTML=`<h2 class="center">封印進行中</h2><div class="target">??.??</div><button id="touch" class="game-button stop" aria-label="停止封印計時">停止</button><p class="hint">相信你的感覺。<br>覺得到了 10 秒，就按停止。</p>`;bindTouch(stop);
  }else if(phase==='sending'){
   box.innerHTML=`<h2 class="center">已停止，正在揭曉</h2><div class="target">✦</div><p class="pending">結果已鎖定，等待同步大螢幕。</p><p class="hint">請勿重新整理或再按開始。</p><button class="subtle" id="retry-result">重新傳送同一結果</button>`;$('retry-result').onclick=sendFinish;
  }else if(phase==='interrupted'){
   box.innerHTML=`<h2 class="center">本局已中止</h2><div class="target">—</div><p class="hint">裝置或連線中斷。<br>不自動判定成功或失敗，請工作人員處理。</p>${staffHTML()}`;bindNext();
  }else if(phase==='result'){
   const r=state.round.result;box.innerHTML=`<h2 class="result-title ${r.success?'':'failure'}">${r.success?'封印成功！':'差一點點！'}</h2><div class="target">${r.seconds}<small>秒</small></div><p class="prize">${r.success?'獲得小禮物 1 份':'謝謝你的勇敢挑戰！'}</p><p class="hint">成績已同步大螢幕。<br>成功範圍：9.50～10.50 秒。</p>${r.success?`<button class="primary" id="gift" ${state.round.giftClaimed?'disabled':''}>${state.round.giftClaimed?'✓ 小禮物已發放':'工作人員：登記已發小禮物'}</button>`:''}${staffHTML()}`;
   if($('gift'))$('gift').onclick=()=>api('gift',{roundId:state.round.id}).then(accept).catch(e=>err(e.message));bindNext();
  }
 }
 function bindNext(){ $('next-check').onchange=()=>$('next').disabled=!$('next-check').checked;$('next').onclick=()=>{if($('next-check').checked)api('next',{roundId:state.round.id,confirmed:true}).then(accept).catch(e=>err(e.message));};}
 function bindTouch(fn){const b=$('touch');b.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;e.preventDefault();fn();});b.addEventListener('keydown',e=>{if(!e.repeat&&[' ','Enter'].includes(e.key)){e.preventDefault();fn();}});}
 function start(){if(localPhase==='running'||started!==null||state?.phase!=='ready')return;if(!connected){err('請先恢復網路連線再開始。');return;}started=performance.now();localPhase='running';interrupted=false;err('');holdScreen();render();
  startPromise=api('start',{roundId:state.round.id}).then(accept).catch(e=>{localPhase='interrupted';started=null;err(e.message);render();throw e;});startPromise.catch(()=>{});
 }
 function stop(){if(localPhase!=='running'||started===null)return;const elapsedMs=performance.now()-started;localPhase='sending';const pending={roundId:state.round.id,elapsedMs:Math.min(30000,elapsedMs)};
  if(elapsedMs>30000){interrupt();return;}Live.save(PENDING,pending);err('');render();releaseScreen();sendFinish(pending);
 }
 async function sendFinish(data=Live.load(PENDING)){
  if(submitting||!data||!auth)return;submitting=true;
  try{if(startPromise)await startPromise;const s=await api('finish',data);Live.remove(PENDING);localPhase=null;started=null;accept(s);}catch(e){err(e.message+'\n結果已鎖定，請恢復連線後重傳，不要重新挑戰。');if([409,410,401].includes(e.status)){localPhase='interrupted';Live.remove(PENDING);render();}}
  finally{submitting=false;}
 }
 function interrupt(){if(!state?.round||!['ready','running'].includes(state.phase)&&localPhase!=='running')return;interrupted=true;localPhase='interrupted';started=null;Live.remove(PENDING);releaseScreen();render();api('interrupt',{roundId:state.round.id}).then(s=>{localPhase=null;accept(s);}).catch(e=>err(e.message));}
 $('join-retry').onclick=join;$('disconnect').onclick=()=>{if(['ready','running'].includes(state?.phase)){err('本局進行中，請先完成或由螢幕中止。');return;}if(confirm('清除這台手機的配對資料？清除後請重新掃描螢幕 QR。')){Live.remove(KEY);Live.remove(PENDING);location.href='/phone.html';}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(localPhase==='running'||state?.phase==='running'))interrupt();else if(!document.hidden&&state?.phase==='running'&&interrupted)interrupt();});
 window.addEventListener('pagehide',()=>{stopStream?.();releaseScreen();});
 window.addEventListener('online',()=>{if(Live.load(PENDING))sendFinish();});
 setInterval(()=>{if(auth?.approved&&!document.hidden)api('ping',{}).then(s=>{if(!state||s.version>state.version)accept(s);}).catch(e=>setOnline(false,e));},12000);
 if(invitation){join();}else if(auth?.approved){connect();api('state',undefined).then(accept).catch(e=>err(e.message));}else if(auth)awaitApproval();
})();
