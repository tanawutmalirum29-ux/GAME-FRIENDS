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
// An online lobby is still a real PeerJS room. A full-core reload would
// disconnect everyone even between rounds (or during BOARD roulette).
// Minigame-only updates continue through GamePlatform's hot registry.
window.GAME_CAN_AUTO_RELOAD=()=>{
 if(round||gameSelection||boardSession||onlineHost||hostPeer||hostNetworkLoad||
    controllerReady||controllerPeer||controllerConn||controllerNetworkLoad)return false;
 if(currentView==='home')return true;
 if(currentView==='hostLobby')return saveOffline();
 return currentView==='controller';
};
window.GAME_PREPARE_AUTO_RELOAD=()=>{
 if(currentView==='hostLobby')return onlineHost?saveHost():(!hostPeer&&saveOffline());
 if(currentView==='controller'&&controllerReady)return savePhone();
 return true;
};
window.GAME_NOTIFY_UPDATE=()=>showToast('มีแพตช์ใหม่ • ระบบจะอัปเดตเมื่อออกจากห้อง');
requestAnimationFrame(animate);
