/* PARTY PLAZA: independent lobby simulation and renderer; no minigame rules. */
(() => {
'use strict';
const WORLD={width:960,height:540},R=15,SPEED=112;
const FALLBACK={
 world:WORLD,walkableBounds:{type:'rect',x:20,y:42,width:920,height:480},
 zones:[
  {id:'wardrobe',label:'WARDROBE',center:{x:151,y:190},interactionRadiusPx:49,priority:60},
  {id:'game_arcade',label:'GAME ARCADE',center:{x:480,y:181},interactionRadiusPx:53,priority:70},
  {id:'board_portal',label:'BOARD PARTY',center:{x:809,y:187},interactionRadiusPx:52,priority:65},
  {id:'main_plaza',label:'MAIN PLAZA',center:{x:480,y:327},interactionRadiusPx:0,priority:0},
  {id:'ready_area',label:'READY / START',center:{x:480,y:457},interactionRadiusPx:46,priority:80},
  {id:'room_corner',label:'ROOM CORNER',center:{x:816,y:439},interactionRadiusPx:43,priority:35},
  {id:'color_studio',label:'COLOR STUDIO',center:{x:144,y:437},interactionRadiusPx:49,priority:45}
 ],
 obstacles:[
  {id:'wardrobe-building',type:'rect',x:68,y:52,width:167,height:100},
  {id:'arcade-building',type:'rect',x:367,y:38,width:226,height:100},
  {id:'board-portal',type:'rect',x:742,y:47,width:143,height:104},
  {id:'room-booth',type:'rect',x:762,y:372,width:111,height:41},
  {id:'play-prop-a',type:'circle',cx:110,cy:405,r:13},
  {id:'play-prop-b',type:'circle',cx:189,cy:410,r:13},
  {id:'neon-pool',type:'circle',cx:62,cy:300,r:34},
  ...[[318,214],[642,214],[314,330],[646,330],[398,502],[562,502]].map(([cx,cy],i)=>({id:'lamp-'+i,type:'circle',cx,cy,r:5})),
  ...[[732,160],[898,166],[716,60]].map(([cx,cy],i)=>({id:'light-tower-'+i,type:'circle',cx,cy,r:8})),
  ...[[30,28],[300,24],[336,34],[640,26],[690,36],[930,34],[934,150],[938,300],[936,372],[934,486],[26,110],[24,232],[26,498],[214,522],[334,524],[630,524],[760,522],[880,520],[922,236],[236,200]].map(([cx,cy],i)=>({id:'edge-prop-'+i,type:'circle',cx,cy,r:10}))
 ],
 spawnPoints:Array.from({length:12},(_,i)=>({slot:i+1,x:Math.round(480+85*Math.cos(-Math.PI/2+i*Math.PI/6)),y:Math.round(327+85*Math.sin(-Math.PI/2+i*Math.PI/6))}))
};
let layout=FALLBACK,canvas=null,ctx=null,image=null,active=false,callbacks={},clock=0,loaded=false,loading=null,playerCache=[],debug=false;
let sceneAttempts=0,sceneRetryTimer=null;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function initialize(){
 if(canvas)return;
 canvas=$('plazaCanvas');if(!canvas)return;
 ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return;
 const dpr=Math.max(window.devicePixelRatio||1,1);
 canvas.width=Math.round(WORLD.width*dpr);canvas.height=Math.round(WORLD.height*dpr);
 canvas.style.aspectRatio='16 / 9';
 $('hostLobby')?.classList.add('plaza-loaded');
 void loadScene();
}
// The lobby is ready ONLY after the authored SVG has decoded into the canvas.
// Zone JSON failure may use the existing fallback geometry; art failure may not
// expose the diagnostic grid or radius circles as a visible temporary map.
function loadScene(){
 if(loaded||loading)return loading||Promise.resolve();
 const zoneLoad=fetch('./src/lobby/lobby-zones.json',{cache:'force-cache'}).then(r=>{
  if(!r.ok)throw Error('Party Plaza layout '+r.status);
  return r.json();
 }).then(data=>{
  if(data?.world?.width===960&&data?.world?.height===540&&
     Array.isArray(data.obstacles)&&Array.isArray(data.zones)&&Array.isArray(data.spawnPoints))layout=data;
 }).catch(error=>console.warn('Party Plaza using bundled collision geometry',error));
 loading=Promise.all([zoneLoad,loadArt()]).then(()=>{
  if(!image||!image.naturalWidth)throw Error('Party Plaza scene did not decode');
  loaded=true;sceneAttempts=0;
  paint(); // Paint the finished map BEFORE removing the transition curtain.
  callbacks.ready?.();
 }).catch(error=>{
  loaded=false;image=null;
  console.warn('Party Plaza SVG load failed',error);
  window.PartyPlazaArt?.reset?.();
  if(!active)return;
  sceneAttempts++;
  if(sceneAttempts<=2){
   callbacks.progress?.('กำลังลองโหลดฉากอีกครั้ง ('+sceneAttempts+'/2)...');
   sceneRetryTimer=setTimeout(()=>{sceneRetryTimer=null;void loadScene();},900*sceneAttempts);
  }else callbacks.error?.(error);
 }).finally(()=>{loading=null;});
 return loading;
}
async function loadArt(){
 const uri=await window.PartyPlazaArt?.sceneUrl?.();
 if(!uri)throw Error('Party Plaza scene URL unavailable');
 const next=new Image();next.decoding='async';
 await new Promise((resolve,reject)=>{next.onload=resolve;next.onerror=()=>reject(Error('Party Plaza SVG image load failed'));next.src=uri;});
 if(typeof next.decode==='function')await next.decode();
 image=next;
}
function retry(){
 if(sceneRetryTimer!==null){clearTimeout(sceneRetryTimer);sceneRetryTimer=null;}
 if(loaded){callbacks.ready?.();return Promise.resolve();}
 sceneAttempts=0;callbacks.progress?.('กำลังโหลดภาพล็อบบี้ใหม่...');
 return loadScene();
}
// Render the compressed SVG only while a live host lobby is visible.
 // Preloading it on every game/controller entry caused WebKit to report
 // blocked blob loads if an unrelated host test immediately reloaded.
 function configure(hooks){callbacks=hooks||{};if(active)initialize();}
function setActive(value){
 active=!!value;
 if(active){
  initialize();
  if(!loaded&&!loading&&sceneRetryTimer===null)void loadScene();
 }else if(sceneRetryTimer!==null){clearTimeout(sceneRetryTimer);sceneRetryTimer=null;}
}
function getSpawn(slot){return layout.spawnPoints[(slot%layout.spawnPoints.length+layout.spawnPoints.length)%layout.spawnPoints.length]||{x:480,y:327};}
function isFree(x,y,exclude){
 const b=layout.walkableBounds;
 if(x<R+b.x||x>b.x+b.width-R||y<R+b.y||y>b.y+b.height-R)return false;
 if(layout.obstacles.some(o=>overlap(x,y,o)))return false;
 if(exclude&&playerCache.some(p=>p!==exclude&&Number.isFinite(p.plazaX)&&Math.hypot(x-p.plazaX,y-p.plazaY)<R*2+.4))return false;
 return true;
}
function nearEdge(x,y,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len?clamp(((x-ax)*dx+(y-ay)*dy)/len,0,1):0;
 return Math.hypot(x-(ax+t*dx),y-(ay+t*dy));
}
function inPoly(x,y,pts){
 let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function overlap(x,y,o){
 if(o.type==='rect'){
  const nx=clamp(x,o.x,o.x+o.width),ny=clamp(y,o.y,o.y+o.height);
  return Math.hypot(x-nx,y-ny)<R || (x>=o.x&&x<=o.x+o.width&&y>=o.y&&y<=o.y+o.height);
 }
 if(o.type==='circle')return Math.hypot(x-o.cx,y-o.cy)<R+o.r;
 if(o.type==='polygon'&&Array.isArray(o.points)){
  if(inPoly(x,y,o.points))return true;
  return o.points.some((p,i)=>{
   const q=o.points[(i+1)%o.points.length];
   return nearEdge(x,y,p[0],p[1],q[0],q[1])<R;
  });
 }
 return false;
}
function sync(players){
 playerCache=players||[];
 for(let i=0;i<playerCache.length;i++){
  const p=playerCache[i];
  if(Number.isFinite(p.plazaX)&&Number.isFinite(p.plazaY))continue;
  const occupied=new Set(playerCache.filter(q=>Number.isInteger(q.plazaSlot)).map(q=>q.plazaSlot));
  let slot=i;while(occupied.has(slot)&&slot<12)slot++;
  if(slot>=12)slot=[...Array(12).keys()].find(s=>!occupied.has(s))??i%12;
  const spot=getSpawn(slot);
  p.plazaSlot=slot;p.plazaX=spot.x;p.plazaY=spot.y;p.plazaVX=0;p.plazaVY=0;p.plazaHeading={x:0,y:-1};
  p.plazaAPressed=false;p.plazaBPressed=false;p.plazaWalkClock=0;
  p.plazaBotPhase=0;p.plazaBotAngle=(i*.97+1.9)%(Math.PI*2);p.plazaBotChange=0;
 }
}
function zoneAt(p){
 if(!p||!Number.isFinite(p.plazaX))return null;
 return layout.zones.filter(z=>z.interactionRadiusPx>0&&Math.hypot(p.plazaX-z.center.x,p.plazaY-z.center.y)<=z.interactionRadiusPx).sort((a,b)=>b.priority-a.priority||Math.hypot(p.plazaX-a.center.x,p.plazaY-a.center.y)-Math.hypot(p.plazaX-b.center.x,p.plazaY-b.center.y))[0]||null;
}
function inZone(p,id){return zoneAt(p)?.id===id;}
const key={up:false,down:false,left:false,right:false};
function keyEvent(e,pressed){
 if(!active||e.target?.matches?.('input,textarea,select,button,[contenteditable]'))return;
 const k={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'}[e.code];
 if(k){e.preventDefault();key[k]=pressed;}
 if(pressed&&e.code==='Space'&&playerCache.length) {
  e.preventDefault();
  const p=playerCache.find(q=>q.isBot)||playerCache[0];
  if(p&&!p.plazaAPressed){p.plazaAPressed=true;callbacks.interact?.(p,zoneAt(p));}
 }
 if(!pressed&&e.code==='Space')for(const p of playerCache)p.plazaAPressed=false;
}
document.addEventListener('keydown',e=>keyEvent(e,true));
document.addEventListener('keyup',e=>keyEvent(e,false));
window.addEventListener('blur',()=>{for(const k of Object.keys(key))key[k]=false;});
function move(p,dx,dy,dt){
 const speed=Math.hypot(dx,dy);
 if(speed>.02){dx/=Math.max(1,speed);dy/=Math.max(1,speed);}else{dx=0;dy=0;}
 p.plazaVX=dx*SPEED;p.plazaVY=dy*SPEED;
 if(dx||dy){p.plazaHeading={x:dx,y:dy};p.plazaWalkClock+=dt;}
 const steps=Math.max(1,Math.ceil(SPEED*dt/7));
 for(let i=0;i<steps;i++){
  const nx=p.plazaX+p.plazaVX*dt/steps,ny=p.plazaY+p.plazaVY*dt/steps;
  if(isFree(nx,p.plazaY))p.plazaX=nx;
  if(isFree(p.plazaX,ny))p.plazaY=ny;
 }
}
function botInput(p,dt,i){
 p.plazaBotChange-=dt;
 if(p.plazaBotChange<=0){
   p.plazaBotPhase++;
   p.plazaBotAngle+=(Math.sin((i+1)*17+p.plazaBotPhase*12.13)*1.3);
   p.plazaBotChange=1.2+Math.abs(Math.sin(p.plazaBotPhase*7.3+i))*1.7;
 }
 const angle=p.plazaBotAngle;
 return {x:Math.cos(angle)*.5,y:Math.sin(angle)*.5};
}
function tick(dt,players){
 if(!active||!canvas||!ctx)return;
 clock+=dt;sync(players);
 const p0=playerCache.find(p=>p.isBot);
 const hostAxisX=Number(key.right)-Number(key.left),hostAxisY=Number(key.down)-Number(key.up);
 for(let i=0;i<playerCache.length;i++){
  const p=playerCache[i];let vx=0,vy=0;
  if(p.isBot){const b=(p===p0&&(hostAxisX||hostAxisY))?{x:hostAxisX,y:hostAxisY}:botInput(p,dt,i);vx=b.x;vy=b.y;}
  else if(p.conn?.open){
   const k=p.input||{};
   vx=Number.isFinite(k.axisX)?k.axisX:Number(!!k.right)-Number(!!k.left);
   vy=Number.isFinite(k.axisY)?k.axisY:Number(!!k.down)-Number(!!k.jump);
  }
  const oldX=p.plazaX,oldY=p.plazaY;
  move(p,vx,vy,dt);
  if(p.isBot&&oldX===p.plazaX&&oldY===p.plazaY){p.plazaBotAngle+=2.2;p.plazaBotChange=0;}
  // A and B are interpreted only when the player is physically in a zone.
  if(!p.isBot&&p.conn?.open){
   const a=!!p.input.action,b=!!p.input.alt;
   if(a&&!p.plazaAPressed)callbacks.interact?.(p,zoneAt(p));
   if(b&&!p.plazaBPressed){
    const zone=zoneAt(p);
    if(zone?.id==='wardrobe')callbacks.changeCosmetic?.(p);
    else if(zone?.id==='color_studio')callbacks.changeColor?.(p);
    else callbacks.cancel?.(p);
   }
   p.plazaAPressed=a;p.plazaBPressed=b;
  }
 }
 for(let iter=0;iter<3;iter++)for(let i=0;i<playerCache.length;i++)for(let j=i+1;j<playerCache.length;j++){
  const a=playerCache[i],b=playerCache[j],dx=b.plazaX-a.plazaX,dy=b.plazaY-a.plazaY,d=Math.hypot(dx,dy);
  if(d>=R*2||!Number.isFinite(d))continue;
  const ux=d>0?dx/d:1,uy=d>0?dy/d:0,shift=(R*2-d)*.5;
  const ax=a.plazaX-ux*shift,ay=a.plazaY-uy*shift,bx=b.plazaX+ux*shift,by=b.plazaY+uy*shift;
  if(isFree(ax,ay)) {a.plazaX=ax;a.plazaY=ay;}
  if(isFree(bx,by)) {b.plazaX=bx;b.plazaY=by;}
 }
 paint();
}
function backgroundFallback(c){
 c.fillStyle='#10132c';c.fillRect(0,0,960,540);
 c.strokeStyle='#293d75';c.lineWidth=1;for(let x=0;x<960;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,540);c.stroke();}
 for(let y=0;y<540;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
 for(const z of layout.zones){
  if(!z.interactionRadiusPx)continue;
  c.beginPath();c.arc(z.center.x,z.center.y,z.interactionRadiusPx,0,Math.PI*2);
  c.fillStyle='#2c1d5280';c.fill();c.strokeStyle='#68dffa';c.lineWidth=3;c.stroke();
  c.fillStyle='#f0d6ff';c.font='bold 14px sans-serif';c.textAlign='center';c.fillText(z.label,z.center.x,z.center.y);
 }
}
function paintColorStudio(c){
 const zone=layout.zones.find(z=>z.id==='color_studio');
 if(!zone)return;
 const {x,y}=zone.center;
 c.save();
 // Overlay the formerly unused PLAY CORNER without reducing the original
 // high-resolution Party Plaza SVG fidelity or altering collision geometry.
 c.beginPath();c.arc(x,y,zone.interactionRadiusPx,0,Math.PI*2);
 c.strokeStyle='rgba(139,236,246,.65)';c.lineWidth=2;c.stroke();
 c.fillStyle='rgba(11,19,39,.96)';
 c.fillRect(x-96,y-81,192,65);
 c.strokeStyle='#79dbe8';c.lineWidth=1.5;
 c.strokeRect(x-96.5,y-81.5,193,66);
 c.textAlign='center';c.textBaseline='middle';
 c.font='bold 14px sans-serif';c.fillStyle='#f4fdff';
 c.fillText('COLOR STUDIO',x,y-66);
 const colors=callbacks.colorPalette?.()||[];
 const count=Math.min(colors.length,12);
 for(let i=0;i<count;i++){
  const px=x+(i-(count-1)/2)*14.5,py=y-47;
  c.beginPath();c.arc(px,py,5.7,0,Math.PI*2);
  c.fillStyle=colors[i];c.fill();
  c.strokeStyle='rgba(255,255,255,.62)';c.lineWidth=.8;c.stroke();
 }
 c.font='bold 12px sans-serif';c.fillStyle='#c1f5ff';
 c.fillText('B เปลี่ยนสี',x,y-28);
 c.restore();
}
function paint(){
 const c=ctx;if(!c)return;
 const t=canvas.width/960;c.setTransform(t,0,0,canvas.height/540,0,0);
 c.clearRect(0,0,960,540);
 if(image)c.drawImage(image,0,0,960,540);
 else{c.fillStyle='#0c1030';c.fillRect(0,0,960,540);} // Never flash zone circles or grid.
 paintColorStudio(c);
 const avatar=window.PartyPlayerAvatar;
 window.PartyCharacters?.beginNameFrame?.(c);
 for(const p of [...playerCache].sort((a,b)=>a.plazaY-b.plazaY)){
  const state={x:p.plazaX,y:p.plazaY,vx:p.plazaVX,vy:p.plazaVY,dir:p.plazaHeading,color:p.color,name:p.name,cosmetic:p.cosmetic};
  if(avatar?.draw)avatar.draw(c,state,{time:clock,scale:1,label:true});
  else{
   c.beginPath();c.arc(p.plazaX,p.plazaY,18,0,Math.PI*2);
   c.fillStyle=p.color||'#82e4f2';c.fill();
   c.fillStyle='#fff';c.textAlign='center';c.font='bold 12px sans-serif';c.fillText(p.name||'',p.plazaX,p.plazaY-29);
  }
 }
 if(debug){
  for(const z of layout.zones)if(z.interactionRadiusPx){
   c.strokeStyle='#76eeeb';c.lineWidth=1;c.beginPath();c.arc(z.center.x,z.center.y,z.interactionRadiusPx,0,Math.PI*2);c.stroke();
  }
 }
 const focus=playerCache.find(p=>!p.isBot&&p.conn?.open)||playerCache[0];
 const zone=zoneAt(focus),hint=$('plazaZoneHint');
 if(hint)hint.textContent=zone?.id==='wardrobe'?'WARDROBE • B เปลี่ยนเครื่องแต่งกาย':
  zone?.id==='color_studio'?'COLOR STUDIO • กด B เปลี่ยนสี (ไม่ซ้ำเพื่อน)':
  zone?zone.label+' • A ใช้งาน':'เดินด้วยจอย • ไปที่จุดต่าง ๆ แล้วกด A';
}
window.PartyPlaza=Object.freeze({configure,setActive,sync,tick,inZone,zoneAt,retry,getLayout:()=>layout,getPlayers:()=>playerCache,isReady:()=>loaded,debug:v=>{debug=!!v;}});
})();