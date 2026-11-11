// PARTY PLAZA overlays never resize/reflow the map. Existing room, roster and
// session controls are retained; only their presentation changes.
const plazaHost=$('hostLobby');
// The header owns ONE popup at a time. Independent toggles previously left
// settings, QR and roster layered across each other (and under the safe-area
// header on iPad), obscuring both the scene and the existing controls.
const plazaPanelButtons={
 room:$('plazaRoomToggle'),roster:$('plazaRosterToggle'),controls:$('plazaSettingsToggle')
};
const plazaPanelNames=Object.keys(plazaPanelButtons);
function setPlazaPanel(name=null){
 if(!plazaHost)return;
 for(const key of plazaPanelNames){
  const open=key===name;
  plazaHost.classList.toggle('plaza-show-'+key,open);
  const btn=plazaPanelButtons[key];
  if(btn)btn.setAttribute('aria-expanded',String(open));
 }
}
function togglePlazaPanel(name){
 if(!plazaPanelNames.includes(name))return;
 setPlazaPanel(plazaHost?.classList.contains('plaza-show-'+name)?null:name);
}
$('plazaRoomToggle')?.addEventListener('click',()=>togglePlazaPanel('room'));
$('plazaRosterToggle')?.addEventListener('click',()=>togglePlazaPanel('roster'));
$('plazaSettingsToggle')?.addEventListener('click',()=>togglePlazaPanel('controls'));
plazaHost?.addEventListener('pointerdown',e=>{
 if(currentView!=='hostLobby')return;
 if(e.target?.closest?.('.lobby-bar,.lobby-qr-panel,.lobby-player-panel,.lobby-controls'))return;
 setPlazaPanel();
});
document.addEventListener('keydown',e=>{
 if(currentView==='hostLobby'&&e.key==='Escape')setPlazaPanel();
});
$('plazaStartBtn')?.addEventListener('click',()=>{if(!$('startBtn').disabled)beginParty();});
window.PartyPlaza?.configure({
 interact(p,z){
  if(!z)return;
  switch(z.id){
   case 'game_arcade':
    if(selectedSessionMode==='board'){showToast('เลือกเกมเดี่ยวได้ใน NORMAL PARTY');return;}
    if(p.conn?.open)send(p.conn,{t:'plaza-picker',open:true});
    else if(p.isBot)openBulkBotPicker();
    break;
   case 'ready_area':
    if(p.conn?.open)castLobbyReadyVote(p.conn);
    else showToast('บอทพร้อมเล่นอยู่แล้ว • เจ้าของห้องกดเริ่มได้');
    break;
   case 'board_portal':
    if(p.isBot)document.querySelector('[data-session-mode="board"]')?.click();
    else showToast(p.name+' ขอเล่น BOARD PARTY • เจ้าของห้องเลือกโหมดที่แถบตั้งค่า');
    break;
   case 'room_corner': togglePlazaPanel('room');break;
   case 'wardrobe':showToast('WARDROBE ยังไม่เปิดให้แต่งตัว');break;
  }
 },
 cancel(p){if(p.conn?.open)send(p.conn,{t:'plaza-picker',open:false});}
});

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
 // Restored offline lobbies can be visible before older compatibility
 // initialization has synchronized currentView. Protect the actual mounted
 // Host lobby as well as its logical view from a destructive Core reload.
 if(currentView==='hostLobby'||!$('hostLobby').classList.contains('hidden'))return false;
 if(currentView==='home')return true;
 return currentView==='controller';
};
window.GAME_PREPARE_AUTO_RELOAD=()=>{
 if(currentView==='hostLobby')return onlineHost?saveHost():(!hostPeer&&saveOffline());
 if(currentView==='controller'&&controllerReady)return savePhone();
 return true;
};
window.GAME_NOTIFY_UPDATE=()=>showToast('มีแพตช์ใหม่ • ระบบจะอัปเดตเมื่อออกจากห้อง');
requestAnimationFrame(animate);
