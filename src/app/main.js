const entryParams=new URLSearchParams(location.search);
const joinCode=parseRoomCode(entryParams.get('join'));
const launchedHost=entryParams.get('host')==='1';
const savedHost=getSession(HOST_SESSION);
const savedOffline=getSession(OFFLINE_SESSION);
const savedPhone=getSession(PHONE_SESSION);
function restoreRoomOptions(snapshot){
 selectedSessionMode=['endless','board'].includes(snapshot.selectedSessionMode)?snapshot.selectedSessionMode:'queue';
 $('autoNext').checked=snapshot.autoNext!==false;
 for(const btn of document.querySelectorAll('[data-session-mode]')){
  const active=btn.dataset.sessionMode===selectedSessionMode;
  btn.classList.toggle('active',active);
  btn.setAttribute('aria-pressed',String(active));
 }
 restorePlayers(snapshot.players);
 nextId=Math.max(nextId,Number(snapshot.nextId)||1);
}
// Reloads and software updates restore the SAME view and room, not the home page.
// A newly opened invite still shows the name/code join form.
if(launchedHost&&!joinCode){
 if(savedHost&&parseRoomCode(savedHost.code)){
  restoreRoomOptions(savedHost);
  // Keep HOME visible until PeerJS confirms the restored room actually opens.
  // Never reveal a ghost "ห้องปิดแล้ว" lobby during failed restoration.
  setView('home');renderRoster();
  startHost(0,savedHost.code);
 }else if(savedOffline&&Array.isArray(savedOffline.players)){
  restoreRoomOptions(savedOffline);
  openOfflineLobby();
 }else{setView('home');renderRoster();}
}else{
 setView('controller');
 const code=joinCode||parseRoomCode(savedPhone?.code);
 if(code)selectRoomCode(code);
 $('nick').value=savedPhone?.name||getSavedNickname();
 setStatus('พร้อมเข้าร่วมห้อง • กรอกรหัสหรือสแกน QR');
 if(code&&savedPhone?.code===code)setTimeout(()=>joinRoom(true),250);
}
// The live in-memory game cannot survive host navigation. Defer updates
// while actually playing; all other host/controller pages can patch in place.
window.GAME_CAN_AUTO_RELOAD=()=>(
 (currentView==='home'&&!onlineHost&&!hostPeer&&!round)
 ||(currentView==='hostLobby'&&!round&&(
     onlineHost?saveHost():(!hostPeer&&saveOffline())
   ))
 ||(currentView==='controller'&&
   !['countdown','playing','paused'].includes(controllerGamePhase)&&
   (controllerReady?savePhone():true))
);
window.GAME_PREPARE_AUTO_RELOAD=()=>{
 if(currentView==='hostLobby')return onlineHost?saveHost():(!hostPeer&&saveOffline());
 if(currentView==='controller'&&controllerReady)return savePhone();
 return true;
};
window.GAME_NOTIFY_UPDATE=()=>showToast('มีแพตช์ใหม่ • ระบบจะอัปเดตเมื่อออกจากเกม');
requestAnimationFrame(animate);
