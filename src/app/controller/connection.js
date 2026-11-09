function updatePhoneGamePicker(phase,choice){
  phoneSelectionOpen=phase==='lobby'&&controllerReady&&controllerSessionMode!=='board';
  myChosenMode=Object.hasOwn(MODES,choice)?choice:null;
  $('phoneGamePicker').classList.toggle('hidden',!phoneSelectionOpen);
  // Picker and live game use the same permanent preview frame dimensions.
  // During selection the joystick hit zone is disabled so all seven
  // mini-game buttons stay tappable, including those on the left.
  $('controllerButtons').classList.toggle('is-picking',phoneSelectionOpen);
  // No joystick movement while selecting a game.
  if(phoneSelectionOpen)releaseStick();
  renderControllerPreviewToggle();
  for(const button of document.querySelectorAll('[data-pick]')){
    const selected=button.dataset.pick===myChosenMode;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  $('phoneChoiceStatus').textContent=myChosenMode?
    'เลือก '+MODES[myChosenMode]+' แล้ว • รอเจ้าของห้องสุ่มเกม':
    'เลือกหนึ่งเกม • เปลี่ยนใจก่อนเริ่มเล่นได้';
}
let controllerMediaCall=null;
let videoStreamActive=false;
let controllerVideoWatchdog=null;
let controllerPreviewEnabled=false; // Default OFF on every fresh page load.
const VIDEO_QUALITY_CYCLE=['high','medium','low','auto'];
const VIDEO_QUALITY_TEXT={
  high:{short:'ส',long:'สูง · 720p'},
  medium:{short:'ก',long:'กลาง · 540p'},
  low:{short:'ต',long:'ต่ำ · 144p'},
  auto:{short:'A',long:'อัตโนมัติตามหน้าจอ'}
};
let controllerVideoQuality='medium';
let lastControllerAutoHeight=null;
function controllerAutoHeight(){
  // CSS screen pixels × device pixel ratio estimate the display's native pixels.
  // Never mistake browser support/actual network throughput for a guaranteed FPS.
  const screen=window.screen||{};
  const dims=[Number(screen.width),Number(screen.height)];
  const viewport=[Number(window.innerWidth),Number(window.innerHeight)];
  const usable=dims.every(n=>Number.isFinite(n)&&n>0)?dims:viewport;
  const shortSide=usable.every(n=>Number.isFinite(n)&&n>0)?Math.min(...usable):540;
  const dpr=Number(window.devicePixelRatio);
  return normalizeAutoHeight(shortSide*(Number.isFinite(dpr)&&dpr>0?dpr:1));
}
function videoQualityPacket(quality){
  if(quality==='auto'){
    const height=controllerAutoHeight();
    lastControllerAutoHeight=height;
    return {t:'video-quality',quality,autoHeight:height};
  }
  lastControllerAutoHeight=null;
  return {t:'video-quality',quality};
}
function savedVideoQuality(){
  try{
    const name=window.localStorage.getItem('gf-video-quality-v1');
    if(Object.hasOwn(VIDEO_QUALITY,name))return name;
  }catch(_){}
  return 'medium';
}
function renderVideoQualityButton(){
  const quality=VIDEO_QUALITY_TEXT[controllerVideoQuality]||VIDEO_QUALITY_TEXT.medium;
  const button=$('videoQualityBtn');
  button.textContent=quality.short;
  button.title='คุณภาพภาพ '+quality.long+' · กดเพื่อเปลี่ยนระดับ';
  button.setAttribute('aria-label',button.title);
  button.dataset.quality=controllerVideoQuality;
}
function setControllerVideoQuality(quality){
  if(!Object.hasOwn(VIDEO_QUALITY,quality))return;
  controllerVideoQuality=quality;
  renderVideoQualityButton();
  try{window.localStorage.setItem('gf-video-quality-v1',quality);}catch(_){}
  if(controllerReady&&controllerPreviewEnabled)send(controllerConn,videoQualityPacket(quality));
}
function renderControllerPreviewToggle(){
  const btn=$('videoPreviewToggleBtn');
  btn.textContent=controllerPreviewEnabled?'จอเปิด':'จอปิด';
  btn.dataset.preview=controllerPreviewEnabled?'on':'off';
  btn.setAttribute('aria-pressed',String(controllerPreviewEnabled));
  btn.setAttribute('aria-label',controllerPreviewEnabled?'จอพรีวิวเปิดอยู่ กดเพื่อปิด':'จอพรีวิวปิดอยู่ กดเพื่อเปิด');
  btn.title=controllerPreviewEnabled?'ปิดจอพรีวิวของจอย':'เปิดจอพรีวิวของจอย';
  // Keep the lobby game-picker clickable even while the preview is off.
  $('controllerPreviewOff').classList.toggle('hidden',controllerPreviewEnabled||phoneSelectionOpen);
}
function setControllerPreviewEnabled(enabled){
  controllerPreviewEnabled=enabled===true;
  if(!controllerPreviewEnabled){
    stopControllerVideo();
    resetPhonePreview();
  }else if(controllerReady){
    // Quality preference is passed first, before asking the host to stream.
    send(controllerConn,videoQualityPacket(controllerVideoQuality));
  }
  renderControllerPreviewToggle();
  if(controllerReady)send(controllerConn,{t:'preview-toggle',enabled:controllerPreviewEnabled});
}
function stopControllerVideo(){
 const call=controllerMediaCall;controllerMediaCall=null;videoStreamActive=false;
 if(controllerVideoWatchdog!==null)clearTimeout(controllerVideoWatchdog);
 controllerVideoWatchdog=null;
 if(call)try{call.close();}catch(_){}
 const video=$('controllerPreviewVideo');
 video.onloadeddata=null;video.onplaying=null;
 video.classList.remove('pending-video');
 try{video.pause();}catch(_){}
 video.srcObject=null;video.classList.add('hidden');
 $('videoStartBtn').classList.add('hidden');
}
function activateControllerVideoIfReady(call){
 const video=$('controllerPreviewVideo');
 if(controllerMediaCall!==call||!controllerPreviewEnabled||videoStreamActive||
    video.paused||video.readyState<2||video.videoWidth<1)return false;
 videoStreamActive=true;
 if(controllerVideoWatchdog!==null)clearTimeout(controllerVideoWatchdog);
 controllerVideoWatchdog=null;
 video.classList.remove('pending-video');
 video.classList.remove('hidden');
 $('controllerPreviewImage').classList.add('hidden');
 $('controllerPreviewPlaceholder').classList.add('hidden');
 $('videoStartBtn').classList.add('hidden');
 send(controllerConn,{t:'video-ready',quality:call.metadata?.quality||'medium'});
 return true;
}
function showControllerVideo(stream,call){
 if(controllerMediaCall!==call||!controllerPreviewEnabled||!stream)return;
 const video=$('controllerPreviewVideo');
 video.srcObject=stream;video.muted=true;video.playsInline=true;
 // JPEG stays visible until a real frame is decoded and playback is active.
 video.classList.remove('hidden');video.classList.add('pending-video');
 videoStreamActive=false;
 video.onloadeddata=()=>activateControllerVideoIfReady(call);
 video.onplaying=()=>activateControllerVideoIfReady(call);
 if(controllerVideoWatchdog!==null)clearTimeout(controllerVideoWatchdog);
 controllerVideoWatchdog=setTimeout(()=>{
  controllerVideoWatchdog=null;
  if(controllerMediaCall===call&&!videoStreamActive&&controllerPreviewEnabled)
   $('videoStartBtn').classList.remove('hidden');
 },4000);
 if(typeof video.play==='function')try{
  const pending=video.play();
  if(pending&&typeof pending.then==='function')
   pending.then(()=>activateControllerVideoIfReady(call)).catch(()=>{
    if(controllerMediaCall===call)$('videoStartBtn').classList.remove('hidden');
   });
  else activateControllerVideoIfReady(call);
 }catch(_){$('videoStartBtn').classList.remove('hidden');}
}
function resetPhonePreview(){
  $('controllerPreviewImage').src='';
  $('controllerPreviewImage').classList.add('hidden');
  if(!videoStreamActive)$('controllerPreviewPlaceholder').classList.remove('hidden');
}
function receivePhonePreview(image){
  if(!controllerPreviewEnabled||videoStreamActive)return;
  if(typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>24000)return;
  $('controllerPreviewImage').src=image;
  $('controllerPreviewImage').classList.remove('hidden');
  $('controllerPreviewPlaceholder').classList.add('hidden');
}
function safePeerDestroy(){
  stopControllerVideo();
  const conn=controllerConn,peer=controllerPeer;
  controllerConn=null;controllerPeer=null;
  if(conn){try{conn.close();}catch(e){}}
  if(peer){try{peer.destroy();}catch(e){}}
}
function controllerState(msg,bad=false){$('joinMessage').textContent=msg;$('controllerState').textContent=msg;setStatus(msg,bad);}
function getSavedNickname(){
  try{return window.localStorage.getItem('gf-nick')||sessionStorage.getItem('gf-nick')||'';}
  catch(_){try{return sessionStorage.getItem('gf-nick')||'';}catch(__){return '';}}
}
function rememberNickname(){
  const value=$('nick').value.trim()?cleanName($('nick').value):'';
  if(!value)return;
  try{window.localStorage.setItem('gf-nick',value);}catch(_){}
  try{sessionStorage.setItem('gf-nick',value);}catch(_){}
}
function parseRoomCode(value){
  const raw=String(value||'').trim();
  let code=raw.toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code)){
    try{
      const parsed=new URL(raw);
      if(!['https:','http:'].includes(parsed.protocol))return null;
      code=String(parsed.searchParams.get('join')||'').toUpperCase();
    }catch(_){return null;}
  }
  return /^[A-Z2-9]{6}$/.test(code)?code:null;
}
function selectRoomCode(code){
  const parsed=parseRoomCode(code);
  if(!parsed)return false;
  $('roomCodeInput').value=parsed;
  $('joinCode').textContent=parsed;
  // Change URL without opening a new tab or reloading the current controller.
  try{
    const url=new URL(window.location.href);
    url.searchParams.set('join',parsed);
    window.history.replaceState(null,'',url.href);
  }catch(_){}
  return true;
}
// One active phone controller per browser profile: new Chrome QR tabs may still
// open, but an active new tab releases the previous controller cleanly.
const controllerTabToken=String(Date.now())+'-'+Math.random().toString(36).slice(2);
let controllerChannel=null;
try{
  if(typeof window.BroadcastChannel==='function'){
    controllerChannel=new window.BroadcastChannel('gf-controller-active-v1');
    controllerChannel.onmessage=event=>{
      const msg=event.data;
      if(msg&&msg.type==='active-controller'&&msg.token!==controllerTabToken&&controllerReady)
        resetControllerForRoomChange('จอยถูกย้ายไปแท็บใหม่แล้ว สามารถสแกนหรือกรอกรหัสห้องเพื่อกลับมาเล่นได้');
    };
  }
}catch(_){}
function announceControllerTakeover(){
  try{if(controllerChannel)controllerChannel.postMessage({type:'active-controller',token:controllerTabToken});}
  catch(_){}
}
const QR_READER_CDN='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
let qrLibraryPromise=null,activeQrSession=null;
function loadQrLibrary(){
  if(typeof window.Html5Qrcode==='function')return Promise.resolve();
  if(!qrLibraryPromise){
    qrLibraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=QR_READER_CDN;script.async=true;
      script.onload=()=>typeof window.Html5Qrcode==='function'?resolve():reject(new Error('QR scanner unavailable'));
      script.onerror=()=>reject(new Error('QR scanner could not be downloaded'));
      document.head.appendChild(script);
    }).catch(error=>{qrLibraryPromise=null;throw error;});
  }
  return qrLibraryPromise;
}
async function releaseQrSession(session){
  if(!session)return;
  if(session.started){try{await session.started;}catch(_){}}
  if(session.reader){
    try{await session.reader.stop();}catch(_){}
    try{session.reader.clear();}catch(_){}
  }
}
async function stopRoomScanner(){
  const session=activeQrSession;
  activeQrSession=null;
  $('roomScannerPanel').classList.add('hidden');
  await releaseQrSession(session);
}
async function startRoomScanner(){
  await stopRoomScanner();
  const session={reader:null,started:null,found:false};
  activeQrSession=session;
  $('roomScannerPanel').classList.remove('hidden');
  $('scanRoomStatus').textContent='กำลังเปิดกล้องเพื่อสแกน QR...';
  try{
    await loadQrLibrary();
    if(activeQrSession!==session)return;
    const config=window.Html5QrcodeSupportedFormats?
      {formatsToSupport:[window.Html5QrcodeSupportedFormats.QR_CODE]}:{};
    session.reader=new window.Html5Qrcode('roomQrReader',config);
    session.started=session.reader.start({facingMode:'environment'},{fps:8,qrbox:220},decoded=>{
      if(activeQrSession!==session||session.found)return;
      const code=parseRoomCode(decoded);
      if(!code){$('scanRoomStatus').textContent='QR ไม่ใช่รหัสห้อง GAME-FRIENDS';return;}
      session.found=true;
      void (async()=>{
        await stopRoomScanner();
        if(selectRoomCode(code))joinRoom();
      })();
    },()=>{});
    await session.started;
    if(activeQrSession===session)$('scanRoomStatus').textContent='ส่องกล้องไปยัง QR Code ห้องใหม่';
  }catch(_){
    if(activeQrSession===session){
      $('scanRoomStatus').textContent='เปิดกล้องไม่สำเร็จ ตรวจสอบสิทธิ์กล้องหรือกรอกรหัส 6 ตัวแทน';
      await releaseQrSession(session);
      if(activeQrSession===session)activeQrSession=null;
    }
  }
}
function resetControllerForRoomChange(message,awaitLeaveAck=false){
  disconnectRequested=true;
  if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
  reconnectTimer=null;reconnectTries=0;
  deleteSession(PHONE_SESSION);
  // A PeerJS DataConnection send may be queued; destroying the Peer
  // immediately used to drop the leave packet before the host could see it.
  const leavingConn=controllerConn;
  if(leavingConn?.open)send(leavingConn,{t:'leave'});
  $('leaveConfirm').classList.add('hidden');
  resetPhonePreview();
  void stopRoomScanner();
  // Switching/leaving rooms must not cancel the user's fullscreen or
  // orientation lock. The join form still renders inside #controller.
  if(awaitLeaveAck&&leavingConn?.open){
    // Keep the old data channel alive until the host acknowledges removal.
    // Fail-safe timeout prevents a dead room from trapping the controller.
    stopControllerVideo();
    setTimeout(()=>{
      if(controllerConn===leavingConn)safePeerDestroy();
    },1000);
  }else safePeerDestroy();
  controllerReady=false;controllerId=null;
  setControllerGameContext(null,'lobby',false);
  for(const k of INPUT_NAMES)controllerKeys[k]=false;
  controllerKeys.axisX=0;controllerKeys.axisY=0;
  clearPortraitFallback();
  document.body.classList.remove('controller-playing');
  syncZoomPolicy();
  $('controllerActive').classList.add('hidden');
  $('joinForm').classList.remove('hidden');
  $('joinBtn').disabled=false;
  controllerReady=false;updatePhoneGamePicker('closed',null);
  controllerState(message||'เลือกห้องใหม่ได้เลย โดยไม่ต้องเปิดแท็บใหม่');
  window.GameAutoUpdate?.onSafePoint();
}
let controllerNetworkLoad=null;
function joinRoom(recovery=false){
  recovery=recovery===true;
  if(typeof Peer!=='function'){
    const deps=window.GameRuntimeDeps;
    if(deps){
      if(controllerNetworkLoad)return;
      const code=$('roomCodeInput').value,view=currentView;
      $('joinBtn').disabled=true;controllerState('กำลังโหลดระบบจอยออนไลน์...');
      controllerNetworkLoad=deps.ensureController().then(()=>{
        controllerNetworkLoad=null;
        $('joinBtn').disabled=false;
        if(currentView===view&&view==='controller'&&$('roomCodeInput').value===code)
          joinRoom(recovery);
      }).catch(error=>{
        controllerNetworkLoad=null;$('joinBtn').disabled=false;
        controllerState('โหลดระบบจอยไม่สำเร็จ: '+String(error.message||error),true);
      });
      return;
    }
    controllerState('ไม่สามารถโหลดระบบจอยออนไลน์ได้',true);return;
  }
  if(!recovery)reconnectTries=0;
  if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
  reconnectTimer=null;
  const code=parseRoomCode($('roomCodeInput').value);
  if(!code){controllerState('รหัสห้องไม่ถูกต้อง กรุณากรอก 6 ตัวหรือสแกน QR',true);return;}
  selectRoomCode(code);
  const name=cleanName($('nick').value);$('nick').value=name;rememberNickname();
  void stopRoomScanner();
  if(!recovery)void requestLandscape();
  $('joinBtn').disabled=true;controllerState((recovery?'กำลังกลับเข้าห้อง ':'กำลังเชื่อมต่อห้อง ')+code+'...');
  disconnectRequested=true;safePeerDestroy();
  disconnectRequested=false;
  const peer=new Peer(undefined,partyPeerOptions());
  controllerPeer=peer;
  peer.on('open',()=>{
    if(controllerPeer!==peer)return;
    const conn=peer.connect('gf-party-'+code,{reliable:true,serialization:'json'});
    controllerConn=conn;
    conn.on('open',()=>{send(conn,{t:'join',name,clientToken:stablePhoneToken});controllerState('กำลังรอห้องรับผู้เล่น...');});
    peer.on('call',call=>{
      if(controllerPeer!==peer||call.peer!=='gf-party-'+code||!controllerPreviewEnabled){
        try{call.close();}catch(_){}
        return;
      }
      stopControllerVideo();
      controllerMediaCall=call;
      call.on('stream',stream=>showControllerVideo(stream,call));
      call.on('close',()=>{
        if(controllerMediaCall!==call)return;
        stopControllerVideo();resetPhonePreview();
      });
      call.on('error',()=>{
        if(controllerMediaCall!==call)return;
        stopControllerVideo();resetPhonePreview();
      });
      try{call.answer();}catch(_){stopControllerVideo();}
    });
    conn.on('data',data=>{
      if(controllerConn!==conn||!data||typeof data!=='object')return;
      if(data.t==='leave-ack'&&disconnectRequested){
        safePeerDestroy();return;
      }
      if(data.t==='welcome'){
        controllerId=data.id;controllerReady=true;
        reconnectTries=0;
        if(reconnectTimer!==null&&typeof clearTimeout==='function')clearTimeout(reconnectTimer);
        reconnectTimer=null;savePhone();
        $('leaveConfirm').classList.add('hidden');
        resetPhonePreview();
        $('controllerName').textContent=data.name;$('controllerAvatar').style.background=data.color;
     $('controllerAvatar').innerHTML=window.PartyPlayerAvatar?.svgForFront(data.color)||'';
        $('joinForm').classList.add('hidden');$('controllerActive').classList.remove('hidden');
        controllerState('เชื่อมต่อแล้ว • รอเจ้าของห้องเริ่มเกม');
        $('controllerInventory').classList.remove('is-ghost');
        setControllerGameContext(data.mode,data.phase||'lobby',!!data.active);
        document.body.classList.add('controller-playing');
        syncControllerVisibleViewport();
        syncZoomPolicy();
        showControllerMode(data.mode);
        updatePhoneGamePicker(data.phase||'lobby',data.choice||null);
        // Quality is remembered, but the live preview starts OFF on a fresh
        // controller page to save bandwidth and device battery.
        setControllerVideoQuality(savedVideoQuality());
        setControllerPreviewEnabled(controllerPreviewEnabled);
        sendInputs();announceControllerTakeover();
       }else if(data.t==='input-ack'){
        const ms=Math.floor(controllerNow()-Number(data.clientAt));
        if(Number.isSafeInteger(data.actionId)&&Number.isFinite(ms)&&ms>=0&&ms<60000){
          const latency=$('controllerLatency');
          if(latency){latency.textContent=ms+' ms';latency.dataset.latency=ms>400?'slow':'ok';}
        }
       }else if(data.t==='preview'){
        if(controllerReady)receivePhonePreview(data.image);
      }else if(data.t==='preview-reset'){
        resetPhonePreview();
      }else if(data.t==='reject'){
        controllerState(data.reason||'ห้องไม่รับผู้เล่น',true);$('joinBtn').disabled=false;
        safePeerDestroy();
      }else if(data.t==='board-state'){
        receiveBoardState(data);
      }else if(data.t==='roster'){
        controllerSessionMode=data.sessionMode||'queue';
        const ready=data.lobbyReady||{};
        controllerLobbyVotes={
          ready:Math.max(0,Math.min(MAX_PLAYERS,Number(ready.ready)||0)),
          total:Math.max(0,Math.min(MAX_PLAYERS,Number(ready.total)||0)),
          selfReady:Array.isArray(ready.voted)&&ready.voted.includes(controllerId)
        };
        showControllerMode(data.mode);
        const self=(data.players||[]).find(p=>p.id===controllerId);
        setControllerGameContext(data.mode,data.phase,!!(self&&self.active));
         controllerPlayerEliminated=!!(data.mode==='shockwave'&&self?.eliminated);
        updatePhoneGamePicker(data.phase,self&&self.choice);
        $('controllerState').textContent=data.phase==='paused'?'จอหลักหยุดเกมชั่วคราว':
          data.phase==='playing'?(self&&self.eliminated?'ตกรอบ • ดูเกมต่อ':self&&self.active?'กำลังเล่น • '+(MODES[data.mode]||'เกม'):'รอรอบถัดไป'):
          data.phase==='roulette'?'กำลังสุ่มเกมรอบถัดไป':data.phase==='countdown'?'เกมกำลังจะเริ่ม':data.phase==='summary'?'กำลังดูคะแนนรวม • กด B กลับล็อบบี้':data.phase==='results'?'จบรอบแล้ว • รอรอบใหม่':
          (controllerLobbyVotes.selfReady?'พร้อมแล้ว • กด A อีกครั้งเพื่อยกเลิก':'กด A เพื่อโหวตเริ่มเกม')+
          ' • '+controllerLobbyVotes.ready+'/'+controllerLobbyVotes.total+' พร้อม';
      }else if(data.t==='result-votes'){
        if(controllerReady&&['results','summary'].includes(controllerGamePhase)){
          controllerResultVotes={
            next:Math.max(0,Math.min(MAX_PLAYERS,Number(data.next)||0)),
            lobby:Math.max(0,Math.min(MAX_PLAYERS,Number(data.lobby)||0)),
            total:Math.max(0,Math.min(MAX_PLAYERS,Number(data.total)||0)),
            nextLabel:typeof data.nextLabel==='string'?data.nextLabel:'เกมถัดไป',
            backLabel:typeof data.backLabel==='string'?data.backLabel:'กลับล็อบบี้',
            autoNextSeconds:Number.isFinite(data.autoNextSeconds)&&data.autoNextSeconds>0?
              Math.ceil(data.autoNextSeconds):null
          };
          showControllerMode(controllerGameMode);
          $('controllerState').textContent='กด A เพื่อเล่นต่อ หรือ B เพื่อ'+controllerResultVotes.backLabel;
        }
      }else if(data.t==='inventory'){
        renderPhoneInventory(data);
       }else if(data.t==='lawn-status'){
        renderPhoneLawnStatus(data);
      }else if(data.t==='shopping-status'){
        renderPhoneShoppingStatus(data);
      }else if(data.t==='pizza-status'){
        renderPhonePizzaStatus(data);
      }else if(data.t==='fruit-status'){
        if(controllerReady&&controllerGameMode==='fruit_memory'&&data.mode==='fruit_memory'){
          const seconds=Math.max(0,Math.min(1.2,Number(data.cooldown)||0));
          $('buttonA').disabled=!!data.eliminated;
          $('buttonA').classList.toggle('cooldown-active',seconds>.03);
          $('buttonA').style.setProperty('--cooldown-sweep',Math.round(seconds/1.2*360)+'deg');
          if(data.eliminated)$('controllerState').textContent='ตกรอบ • ดูการแข่งขันต่อ';
          else if(data.stun>0)$('controllerState').textContent='ถูกสตั้น • '+Number(data.stun).toFixed(1)+' วิ';
        }
       }else if(data.t==='snow-status'){
          if(controllerReady&&controllerGameMode==='snow_brawl'&&data.mode==='snow_brawl'){
            const windup=Math.max(0,Number(data.windup)||0),flat=Math.max(0,Number(data.flat)||0);
            $('buttonA').disabled=!data.alive||flat>.01||windup>.01;
            $('buttonA').classList.toggle('cooldown-active',windup>.01);
            $('buttonA').style.setProperty('--cooldown-sweep',Math.round(Math.min(1,windup/.15)*360)+'deg');
            $('controllerRole').textContent=data.alive?'ผู้รอดชีวิต':'ตกรอบ';
            $('controllerState').textContent=!data.alive?'ตกน้ำ • ตกรอบ':
              flat>.01?'ถูกลูกหิมะทับ • ฟื้นใน '+flat.toFixed(1)+' วิ':
              windup>.01?'เตรียมปล่อยลูกหิมะ • '+windup.toFixed(1)+' วิ':
              'รอด '+data.survivors+' คน • A ปล่อยลูกหิมะ • B ไม่ใช้';
          }
        }else if(data.t==='claim-status'){
          if(controllerReady&&controllerGameMode==='color_claim')
            $('controllerState').textContent=data.eliminated?'COLOR CLAIM • พื้นที่หมด • ตกรอบถาวร':
              'COLOR CLAIM • '+Number(data.percent||0).toFixed(1)+'%'+
              (!data.alive?' • รอเกิดใหม่':data.frozen?' • แช่แข็ง':'');
        }else if(data.t==='ice-status'){
          if(controllerReady&&controllerGameMode==='ice_race')
            $('controllerState').textContent='เช็กพอยต์ '+data.score+' คะแนน'+(data.falling?' • กำลังเกิดใหม่':'');
        }else if(data.t==='gladiators-status'){
          if(controllerReady&&controllerGameMode==='gladiators'&&data.mode==='gladiators'){
           controllerPlayerEliminated=!data.alive;
           $('controllerRole').textContent=data.alive?'ผู้รอดชีวิต':'ตกรอบ';
           $('controllerState').textContent=data.alive?'GLADIATORS • รอด '+data.survivors+' คน':'ตกรอบ • ดูเกมต่อ';
          }
        }else if(data.t==='witch-status'){
          if(controllerReady&&controllerGameMode==='witching_snake')
           $('controllerState').textContent=data.alive?'บินหลบเส้นแสง • ดาว '+data.stars:'ตกรอบ • ดูเกมต่อ';
        }else if(data.t==='boulder-status'){
         if(controllerReady&&controllerGameMode==='boulder_bash'&&data.mode==='boulder_bash'){
           const mode=data.status||'alive',cd=Math.max(0,Number(data.cooldown)||0);
           $('buttonA').disabled=mode!=='alive';
           $('buttonA').classList.toggle('cooldown-active',mode==='alive'&&cd>.03);
           $('buttonA').style.setProperty('--cooldown-sweep',Math.round(Math.min(1,cd/.6)*360)+'deg');
           $('controllerRole').textContent=mode==='rock'?'หินสีของคุณ':mode==='alive'?'ผู้รอดชีวิต':'ตกรอบ';
           $('controllerState').textContent=mode==='rock'?'กำลังควบคุมหิน • เลี้ยวด้วยอนาล็อก':
             mode==='spectator'?'ตกรอบ • รอโอกาสเกิดเป็นหิน':
             'หลบหิน • A ผลัก • เหลือ '+data.survivorCount+' คน';
         }
       }else if(data.t==='shockwave-status'){
         if(controllerReady&&controllerGameMode==='shockwave'&&data.mode==='shockwave'){
            controllerPlayerEliminated=!!data.eliminated;
            $('controllerState').textContent=data.eliminated?'ตกรอบ • ดูเกมต่อ':'SHOCKWAVE • WAVE '+data.wave;
          }
        }else if(data.t==='color-status'){
         if(controllerReady&&controllerGameMode==='color_switch'&&data.mode==='color_switch'){
           const ca=Math.max(0,Math.min(1.1,Number(data.cooldownA)||0));
           const cb=Math.max(0,Math.min(2.8,Number(data.cooldownB)||0));
           for(const [button,seconds,max] of [[$('buttonA'),ca,1.1],[$('buttonB'),cb,2.8]]){
             button.classList.toggle('cooldown-active',seconds>.03);
             button.style.setProperty('--cooldown-sweep',Math.round(seconds/max*360)+'deg');
           }
           $('buttonBLabel').textContent='ระเบิดสี';
           $('buttonB').classList.remove('color-boost-ready');
           $('buttonB').title=cb>.03?'รอ '+cb.toFixed(1)+' วิ':'พร้อมระเบิด 3×3';
           $('controllerState').textContent='คะแนน '+(data.score||0)+
             (data.stun>0?' • สตั้น '+Number(data.stun).toFixed(1)+' วิ':'');
         }
       }else if(data.t==='chicken-status'){
        if(controllerReady&&controllerPlayerActive&&controllerGameMode==='chickens'&&
          data.mode==='chickens'){
          const seconds=Math.max(0,Math.min(1,Number(data.cooldown)||0));
          $('buttonA').classList.toggle('cooldown-active',seconds>.03);
          $('buttonA').style.setProperty('--cooldown-sweep',Math.round(seconds*360)+'deg');
          $('buttonA').title=seconds>.03?'รอตีอีก '+seconds.toFixed(1)+' วิ':'พร้อมตี';
        }
      }else if(data.t==='state'){
        showControllerMode(data.mode);
        setControllerGameContext(data.mode,data.phase,controllerPlayerActive);
        if(data.phase!=='lobby')updatePhoneGamePicker(data.phase,myChosenMode);
        const pluginStatus=data.phase==='playing'?pluginControllerPlayingStatus(data.mode,data):null;
        $('controllerState').textContent=data.phase==='paused'?'หยุดเกมชั่วคราว • รอเจ้าของห้อง':
          data.phase==='playing'?(pluginStatus||
            (MODES[data.mode]||data.mode||'เกม')+' • กำลังเล่น'):
          data.phase==='results'?'จบรอบแล้ว • พบผู้ชนะ':'รอเริ่มรอบ';
        if(data.mode==='board'&&data.phase==='playing')renderPhoneBoard();
      }else if(data.t==='closed'){
        resetControllerForRoomChange('เจ้าของห้องปิดห้องแล้ว');
      }
    });
    conn.on('close',()=>{if(controllerConn===conn)controllerDisconnected();});
    conn.on('error',()=>{if(controllerConn===conn)controllerDisconnected();});
  });
  peer.on('error',err=>{
    if(controllerPeer!==peer)return;
    controllerState('เชื่อมต่อไม่ได้ ('+(err.type||'network')+') • กำลังลองใหม่',true);
    retryPhone();
  });
}
function retryPhone(){
 if(disconnectRequested||reconnectTimer!==null)return;
 if(!parseRoomCode($('roomCodeInput').value))return;
 if(reconnectTries>=14){
   resetControllerForRoomChange('กลับเข้าห้องไม่สำเร็จ กรุณากดเข้าห้องเดิมเพื่อลองอีกครั้ง');
   return;
 }
 reconnectTries++;
 controllerState('กำลังเชื่อมต่อห้องเดิมใหม่ ('+reconnectTries+'/14)');
 reconnectTimer=setTimeout(()=>{
   reconnectTimer=null;
   if(!disconnectRequested)joinRoom(true);
 },Math.min(4800,1000+reconnectTries*360));
}
function controllerDisconnected(){
 if(disconnectRequested)return;
 retryPhone();
}
function isLiveGameContext(){
  return controllerReady&&controllerPlayerActive&&['ghost','pizza_time','shopping_time','lawn_mower','board','boulder_bash','snow_brawl'].includes(controllerGameMode)&&
    ['countdown','playing','paused'].includes(controllerGamePhase);
}
function setControllerGameContext(mode,phase,active){
  controllerGameMode=mode||null;
  if(mode!=='shockwave'||!['countdown','playing','paused'].includes(phase))controllerPlayerEliminated=false;
  const previousControllerPhase=controllerGamePhase;
  controllerGamePhase=phase||'lobby';
  // Remote board camera tools are never shown in a minigame or room lobby.
  const boardZoomActive=controllerReady&&mode==='board'&&
   controllerGamePhase==='playing'&&controllerBoard?.canZoom===true;
  for(const id of ['controllerBoardZoomInBtn','controllerBoardZoomOutBtn']){
   $(id).classList.toggle('hidden',!boardZoomActive);
   $(id).disabled=!boardZoomActive;
  }
  if(!['results','summary'].includes(controllerGamePhase)||
     !['results','summary'].includes(previousControllerPhase))
    controllerResultVotes={next:0,lobby:0,total:0,nextLabel:'เกมถัดไป',backLabel:'กลับล็อบบี้',autoNextSeconds:null};
  controllerPlayerActive=!!active;
  // Revoke camera mode when the walking turn ends or the owner loses control.
  if(boardCameraController?.enabled()&&(!controllerReady||mode!=='board'||
      controllerGamePhase!=='playing'||!controllerPlayerActive||
      controllerBoard?.canZoom!==true||
      !['ready','move_ready','branch','moving'].includes(controllerBoard?.boardPhase)))
    boardCameraController.reset();
  const visible=isLiveGameContext();
  document.body.classList.toggle('pizza-controller-game',visible&&mode==='pizza_time');
  $('controllerInventory').classList.toggle('hidden',!visible);
  if(!visible){
    // Clear stale items on results, lobby, switching rooms or future game modes.
    $('controllerInventory').classList.remove('is-ghost');
    $('controllerRole').textContent='';
    $('inventoryItem').replaceChildren();
    $('inventoryItem').classList.remove('pizza-order-icons','board-bag-icons');
    $('inventoryGuide').replaceChildren();
    $('targetCycleControls').classList.add('hidden');
    $('controllerButtons').classList.remove('has-target','board-bomber-aim');
    $('buttonC').disabled=true;
    $('targetName').textContent='ไม่มีเป้าหมาย';
  }
  showControllerMode(controllerGameMode);
}
function gameControllerDescriptor(mode){
 return window.GamePlatform?.descriptor(mode)||
  (typeof LEGACY_GAME_DATA==='object'?LEGACY_GAME_DATA[mode]:null);
}
function pluginControllerPlayingStatus(mode,data){
 const plugin=gameControllerDescriptor(mode);
 if(!plugin)return null;
 const template=plugin.controller?.status||(plugin.global?null:'{name} • กำลังเล่น');
 if(!template)return null;
 if(controllerPlayerEliminated)return 'ตกรอบ • ดูเกมต่อ';
 const values={
  name:plugin.name||mode,
  survivors:Number.isFinite(Number(data.survivors))?String(data.survivors):'?',
  remaining:data.remaining!=null&&Number.isFinite(Number(data.remaining))?
   String(Math.ceil(Math.max(0,Number(data.remaining)))):'?'
 };
 return template.replace(/\{(name|survivors|remaining)\}/g,(_,key)=>values[key]);
}
function showControllerMode(mode){
  const plugin=gameControllerDescriptor(mode);
  const ui=plugin?.controller||{},labels=ui.labels||{};
  if(mode==='board'&&controllerBoard&&!['results','summary'].includes(controllerGamePhase)){renderPhoneBoard();return;}
  const playing=controllerReady&&controllerPlayerActive&&
    ['countdown','playing','paused'].includes(controllerGamePhase);
  const ghost=playing&&mode==='ghost',chickens=playing&&mode==='chickens';
  const fruit=playing&&mode==='fruit_memory',shockwave=playing&&mode==='shockwave',colorSwitch=playing&&mode==='color_switch',knight=playing&&mode==='knight_match',boulder=playing&&mode==='boulder_bash',snow=playing&&mode==='snow_brawl';
  const lobbyVoting=controllerReady&&controllerGamePhase==='lobby'&&controllerLobbyVotes.total>0;
  const voting=controllerReady&&['results','summary'].includes(controllerGamePhase)&&controllerPlayerActive;
  const aLabel=lobbyVoting?(controllerLobbyVotes.selfReady?'ยกเลิกพร้อม':'พร้อมเริ่ม')+
    ' '+controllerLobbyVotes.ready+'/'+controllerLobbyVotes.total:
    voting?(controllerResultVotes.nextLabel==='สุ่มชุดใหม่จากตัวเลือกเดิม'?'เล่นชุดใหม่':
    controllerResultVotes.nextLabel)+
    (controllerResultVotes.autoNextSeconds!==null?' • อีก '+controllerResultVotes.autoNextSeconds+' วิ':'')+
    ' '+controllerResultVotes.next+'/'+controllerResultVotes.total:
    playing?(labels.A||''):'';
  const bLabel=voting?controllerResultVotes.backLabel+' '+controllerResultVotes.lobby+'/'+controllerResultVotes.total:
    ghost?($('controllerButtons').classList.contains('has-target')?
    'ยืนยันสโลว์':(labels.B||'ใช้ไอเทม')):(playing?(labels.B||''):'');
  $('controllerButtons').classList.remove('board-bomber-aim');
  $('buttonC').disabled=true;
  $('controllerButtons').classList.toggle('chickens-mode',chickens);
  $('controllerButtons').classList.toggle('fruit-memory-mode',fruit);
  $('controllerButtons').classList.toggle('color-switch-mode',colorSwitch);
  if(!colorSwitch){
    $('buttonB').classList.remove('cooldown-active','color-boost-ready');
    $('buttonB').style.removeProperty('--cooldown-sweep');$('buttonB').title='';
  }
   $('controllerButtons').classList.toggle('shockwave-mode',shockwave);
  if(!chickens&&!fruit&&!colorSwitch&&!snow){
    $('buttonA').classList.remove('cooldown-active');
    $('buttonA').style.removeProperty('--cooldown-sweep');
    $('buttonA').title='';
  }
  if(!fruit)$('buttonA').disabled=false;
  $('buttonB').disabled=false;
  if(playing&&plugin?.global){
    const actions=plugin.controls||[];
    if(!actions.includes('A'))$('buttonA').disabled=true;
    if(!actions.includes('B'))$('buttonB').disabled=true;
  }
  $('buttonALabel').textContent=aLabel;
  $('buttonBLabel').textContent=bLabel;
  $('buttonA').setAttribute('aria-label',aLabel?'ปุ่ม A '+aLabel:'ปุ่ม A');
  $('buttonB').setAttribute('aria-label',bLabel?'ปุ่ม B '+bLabel:'ปุ่ม B');
  $('controllerModeName').textContent=playing?(MODES[mode]||''):'';
  $('controllerHelp').textContent=lobbyVoting?
    'กด A เพื่อโหวตเริ่มเกม • ครบทุกคนแล้วเกมเริ่มอัตโนมัติ':
    playing?(ui.help||'ลากนิ้วบนพื้นที่ว่างเพื่อเคลื่อนที่'):
    'ลากนิ้วบนพื้นที่ว่างเพื่อเคลื่อนที่';
  // Native plug-ins describe their own controls through the versioned catalog.
  // The phone never downloads gameplay, physics, or host-only engine modules.
  if(playing&&plugin&&!plugin.global){
    const actions=plugin.controls||[];
    for(const key of ['A','B','C']){
      const button=$('button'+key),label=$('button'+key+'Label');
      const allowed=actions.includes(key),caption=allowed?(labels[key]||'ความสามารถ'):'';
      label.textContent=caption;
      button.disabled=!allowed;
      button.setAttribute('aria-label',caption?'ปุ่ม '+key+' '+caption:'ปุ่ม '+key);
    }
    $('controllerHelp').textContent=ui.help||'ใช้จอยเพื่อเคลื่อนที่และปุ่มความสามารถตามที่เกมกำหนด';
  }
}
function renderPhoneLawnStatus(info){
  if(!isLiveGameContext()||controllerGameMode!=='lawn_mower'||!info||
    info.id!==controllerId||info.phase!==controllerGamePhase)return;
  $('controllerInventory').classList.remove('is-ghost');
  $('controllerRole').textContent='คะแนน '+info.score+' • พระอาทิตย์ '+info.suns+' ดวง';
  $('inventoryItem').textContent=info.score+' คะแนน';
  $('inventoryGuide').textContent='บังคับด้วยจอย • A/B ไม่ใช้';
  $('targetCycleControls').classList.add('hidden');
 }
 function renderPhoneShoppingStatus(info){
 if(!isLiveGameContext()||controllerGameMode!=='shopping_time'||!info||
   info.id!==controllerId||info.phase!==controllerGamePhase)return;
 $('controllerInventory').classList.remove('is-ghost');
 $('controllerRole').textContent='คะแนน '+info.score+' • รถเข็น '+info.count+'/5';
 $('inventoryItem').classList.remove('pizza-order-icons','board-bag-icons');
 $('inventoryItem').textContent=info.count+'/5';
 $('inventoryGuide').textContent=info.stun>0?'โดนระเบิด • สตั้น '+info.stun.toFixed(1)+' วิ':
   'เก็บสินค้า → CHECKOUT • ระเบิด -5 • A/B ไม่ใช้';
 $('targetCycleControls').classList.add('hidden');
}
function renderPhonePizzaStatus(info){
 if(!isLiveGameContext()||controllerGameMode!=='pizza_time'||!info||
    info.id!==controllerId||info.phase!==controllerGamePhase)return;
 const art=window.PizzaIngredientArt,names=art.names;
 $('controllerInventory').classList.remove('is-ghost');
 $('controllerRole').textContent='ออร์เดอร์ '+(info.delivered?.length||0)+'/2 • '+(info.score||0)+' คะแนน';
 const items=$('inventoryItem');
 items.classList.remove('board-bag-icons');
 items.classList.add('pizza-order-icons');
 art.appendRow(items,info.order||[],info.delivered||[],{size:17,showName:true});
 const guide=$('inventoryGuide');
 guide.replaceChildren();
 if(info.held){
   const item=art.item(document,info.held,{size:15});
   if(item)guide.append(item);
   const text=document.createElement('span');
   text.textContent='ถือ '+(names[info.held]||'วัตถุดิบ')+' • ส่งเชฟหรือสลับที่โต๊ะอื่น';
   guide.append(text);
 }else{
   guide.textContent='มือว่าง • เดินไปรับวัตถุดิบ';
 }
 $('targetCycleControls').classList.add('hidden');
 $('controllerButtons').classList.remove('has-target');
}
function renderPhoneInventory(info){
  if(!isLiveGameContext()||!info||info.id!==controllerId||
     info.mode!==controllerGameMode||info.phase!==controllerGamePhase)return;
  if(controllerGameMode!=='ghost')return;
  const names=window.GhostAttack.ITEM_NAMES;
  const isGhost=!!info.ghost;
  $('controllerRole').textContent=isGhost?'ผี':'มนุษย์';
  $('controllerInventory').classList.toggle('is-ghost',isGhost);
  $('inventoryItem').classList.remove('pizza-order-icons','board-bag-icons');
  $('inventoryItem').textContent=isGhost?'เป้าหมาย: ไล่จับมนุษย์':
    'ไอเทม: '+(names[info.item]||'ว่าง');
  $('inventoryGuide').textContent=isGhost?'แตะมนุษย์เพื่อเปลี่ยนเป็นผี':
    info.selecting?'ใช้ ▲ ▼ เลือกเพื่อน · B ยืนยัน':
    info.item==='slow'?'B เพื่อเลือกเพื่อน':
    info.item?'B เพื่อใช้':'';
  $('targetCycleControls').classList.toggle('hidden',!info.selecting);
  $('controllerButtons').classList.toggle('has-target',!!info.selecting);
  $('targetName').textContent=info.targetName||'ไม่มีเป้าหมาย';
  showControllerMode(info.mode);
}
// Real browser time is monotonic; deterministic smoke harnesses may not expose
// performance. The bounded Date fallback is only used outside browsers.
function controllerNow(){
 return typeof performance!=='undefined'&&typeof performance.now==='function'?
  performance.now():Date.now()%1e10;
}
let analogInputTimer=null,lastAnalogInputAt=0;
function queueAnalogInput(){
 if(!controllerReady)return;
 const now=controllerNow(),remaining=33-(now-lastAnalogInputAt);
 if(remaining<=0){
  lastAnalogInputAt=now;sendInputs();
 }else if(analogInputTimer===null){
  analogInputTimer=setTimeout(()=>{
   analogInputTimer=null;lastAnalogInputAt=controllerNow();sendInputs();
  },remaining);
 }
}
function sendInputs(){
 if(analogInputTimer!==null){clearTimeout(analogInputTimer);analogInputTimer=null;}
 if(!controllerReady)return;
 const keys={...controllerKeys};
 // Never let a delayed heartbeat or a stale held stick move a walking avatar
 // while that player's controller is in camera inspection mode.
 if(boardCameraController?.enabled()){
   keys.axisX=0;keys.axisY=0;keys.left=false;keys.right=false;keys.jump=false;keys.down=false;
   if(controllerBoard?.boardPhase==='ready'){keys.action=false;keys.alt=false;keys.cancel=false;}
 }
 send(controllerConn,{t:'input',keys,turnId:controllerBoard?.turnId,mapVersion:controllerBoard?.mapVersion,actionId:++controllerActionId,clientAt:Math.floor(controllerNow())});
}
function isPortraitScreen(){
  if(window.matchMedia)return window.matchMedia('(orientation: portrait)').matches;
  return Number(window.innerHeight)>Number(window.innerWidth);
}
// Safari on iPhone can resize or offset the actually visible area when its
// address bar/toolbar moves, without matching 100dvw/100dvh immediately.
// Bound the phone gamepad to the visual viewport, never the oversized layout
// viewport. The CSS fallback still works on browsers missing this API.
let controllerViewportFrame=0,lastControllerViewport='';
function syncControllerVisibleViewport(){
 // Do not enqueue controller-only viewport rAF on host pages. This also
 // keeps BOARD's first held animation frame owned by its game loop.
 if(!document.body.classList.contains('controller-playing'))return;
 if(controllerViewportFrame)return;
 controllerViewportFrame=requestAnimationFrame(()=>{
  controllerViewportFrame=0;
  const style=$('controller')?.style;
  if(typeof style?.setProperty!=='function')return;
  const view=window.visualViewport;
  const w=Number(view?.width)||Number(window.innerWidth);
  const h=Number(view?.height)||Number(window.innerHeight);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
  const left=Number(view?.offsetLeft)||0,top=Number(view?.offsetTop)||0;
  const portrait=document.body.classList.contains('portrait-fallback')&&isPortraitScreen();
  const scale=Math.max(.1,Math.min((portrait?h:w)/844,(portrait?w:h)/390));
  const signature=[w,h,left,top,scale.toFixed(4)].join('|');
  if(signature===lastControllerViewport)return;
  lastControllerViewport=signature;
  style.setProperty('--gf-controller-visible-width',w+'px');
  style.setProperty('--gf-controller-visible-height',h+'px');
  style.setProperty('--gf-controller-visible-left',left+'px');
  style.setProperty('--gf-controller-visible-top',top+'px');
  style.setProperty('--gf-controller-action-track',Math.round(136*scale)+'px');
  style.setProperty('--gf-controller-face-size',Math.round(102*scale)+'px');
  style.setProperty('--gf-controller-stick-size',Math.round(72*scale)+'px');
  style.setProperty('--gf-controller-knob-size',Math.round(30*scale)+'px');
 });
}
// iOS fires visualViewport.resize independently of window.resize when the
// Safari controls retract or expand; address both and orientation changes.
window.addEventListener('resize',syncControllerVisibleViewport);
window.addEventListener('orientationchange',syncControllerVisibleViewport);
window.addEventListener('pageshow',syncControllerVisibleViewport);
window.visualViewport?.addEventListener?.('resize',syncControllerVisibleViewport);
window.visualViewport?.addEventListener?.('scroll',syncControllerVisibleViewport);
// Opt-in only: by default the existing real-landscape controller remains unchanged.
function clearPortraitFallback(){
  releaseStick();
  document.body.classList.remove('portrait-fallback');
  lastControllerViewport='';syncControllerVisibleViewport();
  $('portraitRestoreBtn').classList.add('hidden');
}
function enablePortraitFallback(){
  if(!controllerReady||!isPortraitScreen())return;
  releaseStick();
  document.body.classList.add('portrait-fallback');
  syncControllerVisibleViewport();
  $('portraitRestoreBtn').classList.remove('hidden');
}
// If the phone is eventually rotated, return to the normal landscape gamepad.
function followDeviceOrientation(){
  if(!isPortraitScreen()&&document.body.classList.contains('portrait-fallback'))
    clearPortraitFallback();
}
window.addEventListener('orientationchange',followDeviceOrientation);
window.addEventListener('resize',followDeviceOrientation);
// Request landscape from both the join form and the live controller. If a
// browser rejects the lock, leave the form usable and let the player rotate.
function requestLandscape(){
  const panel=$('controller');
  let request=null;
  try{
    if(panel.requestFullscreen&&!document.fullscreenElement)
      request=panel.requestFullscreen();
  }catch(_){/* Fullscreen is not available on this device. */}
  if(request&&typeof request.then==='function')
    return request.then(tryLandscapeOrientation,tryLandscapeOrientation);
  tryLandscapeOrientation();
  return Promise.resolve();
}
let releaseStick=()=>{};
function bindAnalogStick(zone,base,knob,target){
  let pointerId=null,originX=0,originY=0;
  const hintStorageKey='gf-joystick-hint-seen-v1';
  let hintDismissed=false;
  try{hintDismissed=window.localStorage.getItem(hintStorageKey)==='1';}catch(_){}
  if(hintDismissed)zone.classList.add('hint-dismissed');
  const dismissHint=()=>{
    if(hintDismissed)return;
    hintDismissed=true;
    zone.classList.add('hint-dismissed');
    try{window.localStorage.setItem(hintStorageKey,'1');}catch(_){}
  };
  const rotated=()=>document.body.classList.contains('portrait-fallback')&&isPortraitScreen();
  const reset=()=>{
    pointerId=null;originX=0;originY=0;
    target.axisX=0;target.axisY=0;
    base.style.transform='translate(-50%,-50%)';
     knob.style.transform='translate(-50%,-50%)';
    zone.classList.remove('is-active','is-moving');
    sendInputs();
  };
  const move=e=>{
    // Movement is measured from the first touch, not a fixed screen position.
    // CSS rotated portrait mode needs inverse rotation of the finger delta.
    const dx=e.clientX-originX,dy=e.clientY-originY;
    const localX=rotated()?dy:dx,localY=rotated()?-dx:dy;
    const box=base.getBoundingClientRect();
    // Input force derives from finger distance, not the visual ring's size.
    const travel=64;
    const knobTravel=Math.max(12,Math.min(box.width,box.height)*.28);
    const len=Math.hypot(localX,localY),factor=len>travel?travel/len:1;
    let x=Math.round(localX*factor/travel*100)/100;
    let y=Math.round(localY*factor/travel*100)/100;
    if(Math.hypot(x,y)<.14){x=0;y=0;}
    zone.classList.toggle('is-moving',Math.hypot(x,y)>=.14);
    if(x===0)x=0;if(y===0)y=0;
    knob.style.transform='translate(calc(-50% + '+Math.round(x*knobTravel)+'px),calc(-50% + '+Math.round(y*knobTravel)+'px))';
    if(target.axisX!==x||target.axisY!==y){
      target.axisX=x;target.axisY=y;queueAnalogInput();
    }
  };
  zone.addEventListener('pointerdown',e=>{
    if(pointerId!==null||!controllerReady)return;
    e.preventDefault();
    dismissHint();
    pointerId=e.pointerId;
    originX=e.clientX;originY=e.clientY;
    // Place the visual ring exactly under the finger in LOCAL UI coordinates,
    // including when the entire gamepad is CSS-rotated 90 degrees.
    const box=zone.getBoundingClientRect();
    const halfX=box.left+box.width/2,halfY=box.top+box.height/2;
    const localWidth=rotated()?box.height:box.width;
    const localHeight=rotated()?box.width:box.height;
    const offsetX=rotated()?e.clientY-halfY:e.clientX-halfX;
    const offsetY=rotated()?-(e.clientX-halfX):e.clientY-halfY;
    base.style.transform='translate3d('+offsetX+'px,'+offsetY+'px,0) translate(-50%,-50%)';
    knob.style.transform='translate(-50%,-50%)';
    zone.classList.add('is-active');
    target.axisX=0;target.axisY=0;
    try{zone.setPointerCapture(pointerId);}catch(_){}
    sendInputs();
  });
  zone.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;
    e.preventDefault();move(e);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    zone.addEventListener(type,e=>{if(e.pointerId===pointerId)reset();});
  }
  zone.addEventListener('contextmenu',e=>e.preventDefault());
  releaseStick=reset;
}
function bindControl(btn, target, id){
  const key=btn.dataset.control;if(!key)return;
  // Use the full, nonoverlapping A/B half of the right-side control column
  // instead of making players aim for the small circular button. The circle
  // remains visual feedback; its parent catches touches all the way to edges.
  const touchZone=btn.parentElement?.classList?.contains('face-button-wrap')?
    btn.parentElement:btn;
  const activePointers=new Set();
  const change=(pressed)=>{
    if(target[key]===pressed)return;
    target[key]=pressed;btn.classList.toggle('pressed',pressed);
    if(id==='remote'){
      if(pressed&&key==='action'&&controllerReady&&controllerGamePhase==='lobby')
        send(controllerConn,{t:'lobby-ready'});
      if(pressed&&controllerReady&&controllerPlayerActive&&['results','summary'].includes(controllerGamePhase)){
        const choice=key==='action'?'next':key==='alt'?'lobby':null;
        if(choice)send(controllerConn,{t:'result-vote',choice});
      }
      sendInputs();
    }
  };
  touchZone.addEventListener('pointerdown',e=>{
    if(btn.disabled)return;
    e.preventDefault();
    const pointer=e.pointerId??0;
    activePointers.add(pointer);
    try{touchZone.setPointerCapture(pointer);}catch(_){}
    change(true);
  });
  const release=e=>{
    const pointer=e.pointerId??0;
    if(!activePointers.delete(pointer))return;
    e.preventDefault?.();
    change(activePointers.size>0);
  };
  touchZone.addEventListener('pointerup',release);
  touchZone.addEventListener('pointercancel',release);
  touchZone.addEventListener('lostpointercapture',release);
  touchZone.addEventListener('contextmenu',e=>e.preventDefault());
}
document.addEventListener('keydown',e=>{
  if(currentView!=='game'||e.target.matches('input,select,textarea'))return;
  const locals=players.filter(p=>p.type==='local'&&!p.isBot);
  KEYS.forEach((mapping,i)=>{const p=locals[i];if(!p)return;for(const k of INPUT_NAMES)if(e.code===mapping[k]){p.input[k]=true;e.preventDefault();}});
});
document.addEventListener('keyup',e=>{
  const locals=players.filter(p=>p.type==='local'&&!p.isBot);
  KEYS.forEach((mapping,i)=>{const p=locals[i];if(!p)return;for(const k of INPUT_NAMES)if(e.code===mapping[k]){p.input[k]=false;e.preventDefault();}});
});
window.addEventListener('blur',()=>{
  resetInputs();for(const k of INPUT_NAMES)controllerKeys[k]=false;
  releaseStick();sendInputs();
  document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
});

// BOARD PARTY owns a session, not a seventh entry in the minigame registry.
// Catalog entries are eligible even when their engine bytes have not been
// fetched. The selected game is loaded and validated before the reel ends.
