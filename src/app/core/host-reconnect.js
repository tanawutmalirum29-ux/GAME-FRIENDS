/* Host-only PeerJS signaling recovery. DataConnections/Board session are
 * intentionally untouched: disconnect() keeps live WebRTC channels alive. */
const HOST_RECONNECT_MAX=8;
let hostReconnectTimer=null,hostReconnectWatchdog=null;
let hostReconnectTries=0,hostReconnectPending=false,hostReconnectStopped=false;
let hostReconnectSuppressDisconnect=false;
function clearHostReconnectTimers(){
 if(hostReconnectTimer!==null)clearTimeout(hostReconnectTimer);
 if(hostReconnectWatchdog!==null)clearTimeout(hostReconnectWatchdog);
 hostReconnectTimer=null;hostReconnectWatchdog=null;
}
function resetHostReconnect(){
 clearHostReconnectTimers();
 hostReconnectTries=0;hostReconnectPending=false;hostReconnectStopped=false;
}
function stopHostReconnect(){
 clearHostReconnectTimers();
 hostReconnectPending=false;hostReconnectStopped=true;
}
function scheduleHostReconnect(peer,attempt){
 if(hostReconnectStopped||!onlineHost||hostPeer!==peer||
    attempt!==hostOpenAttempt||peer.destroyed||peer.open||hostReconnectTimer!==null)return;
 if(hostReconnectTries>=HOST_RECONNECT_MAX){
  stopHostReconnect();
  setStatus('ห้องยังอยู่ แต่เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ • ลองเปิดห้องใหม่เมื่อพร้อม',true);
  return;
 }
 const delay=Math.min(16000,1000*2**hostReconnectTries);
 // Jitter prevents reconnect storms when many clients lose signaling together.
 const wait=Math.round(delay*(1+Math.random()*.2));
 setStatus('ห้องยังเล่นได้ • กำลังเชื่อมต่อเซิร์ฟเวอร์ ('+
  (hostReconnectTries+1)+'/'+HOST_RECONNECT_MAX+')',true);
 hostReconnectTimer=setTimeout(()=>{
  hostReconnectTimer=null;
  if(hostReconnectStopped||hostPeer!==peer||attempt!==hostOpenAttempt||
     !onlineHost||peer.destroyed||peer.open)return;
  // An earlier, unanswered reconnect can leave PeerJS "connecting", where
  // reconnect() is a no-op. Restore its disconnected precondition first.
  if(!peer.disconnected){
   hostReconnectSuppressDisconnect=true;
   try{peer.disconnect();}catch(_){}
   hostReconnectSuppressDisconnect=false;
  }
  if(!peer.disconnected){scheduleHostReconnect(peer,attempt);return;}
  hostReconnectTries++;
  hostReconnectPending=true;
  try{peer.reconnect();}
  catch(_){
   hostReconnectPending=false;
   scheduleHostReconnect(peer,attempt);
   return;
  }
  // A failed handshake may never emit another event. Timeout safely without
  // replacing the Peer or touching any existing DataConnections.
  if(hostReconnectPending&&hostPeer===peer&&attempt===hostOpenAttempt){
   hostReconnectWatchdog=setTimeout(()=>{
    hostReconnectWatchdog=null;
    if(!hostReconnectPending||hostPeer!==peer||attempt!==hostOpenAttempt)return;
    hostReconnectPending=false;
    if(!peer.disconnected){
      hostReconnectSuppressDisconnect=true;
      try{peer.disconnect();}catch(_){}
      hostReconnectSuppressDisconnect=false;
    }
    scheduleHostReconnect(peer,attempt);
   },5000);
  }
 },wait);
}
function recoverHostSignal(peer,attempt){
 if(hostReconnectSuppressDisconnect)return;
 if(hostReconnectStopped||hostPeer!==peer||attempt!==hostOpenAttempt||!onlineHost)return;
 if(hostReconnectWatchdog!==null){clearTimeout(hostReconnectWatchdog);hostReconnectWatchdog=null;}
 hostReconnectPending=false;
 scheduleHostReconnect(peer,attempt);
}
