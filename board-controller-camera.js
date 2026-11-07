/* BOARD PARTY phone camera mode. Capture joystick gestures without forwarding
 * movement; host performs the actual authenticated pan/zoom. */
(() => {
'use strict';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function attach(zone,{allowed,onMode,onGesture,releaseStick,isRotated}){
 if(!zone)throw Error('BOARD camera gesture zone missing');
 let mode=false,down=null,lastTap=null,priorAt=0,pinch=0;
 const fingers=new Map();
 const coords=e=>({x:e.clientX,y:e.clientY});
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const delta=(dx,dy)=>isRotated()?{x:dy,y:-dx}:{x:dx,y:dy};
 function toggle(next,notify=true){
  if(mode===next||next&&!allowed())return false;
  mode=next;fingers.clear();pinch=0;down=null;lastTap=null;priorAt=0;
  // Must clear held movement immediately BEFORE sending the camera-mode packet.
  releaseStick();
  zone.classList.toggle('board-camera-mode',mode);
  zone.setAttribute('aria-label',mode?
   'โหมดเลื่อนแผนที่ ลากนิ้วเพื่อเลื่อน หุบกางนิ้วเพื่อซูม ดับเบิลแท็บเพื่อกลับมาเดิน':
   'พื้นที่ใช้เดิน ดับเบิลแท็บเพื่อสลับโหมดเลื่อนแผนที่');
  onMode(mode,notify);
  return true;
 }
 const tap=(p,at)=>{
  if(!allowed()){lastTap=null;return;}
  if(lastTap&&at-priorAt<=340&&distance(p,lastTap)<=46)toggle(!mode);
  else{lastTap=p;priorAt=at;}
 };
 function suppress(e){e.preventDefault();e.stopImmediatePropagation();}
 zone.addEventListener('pointerdown',e=>{
  const p=coords(e);
  if(!mode){
   if(!allowed()){down=null;lastTap=null;return;}
   // In walk mode the existing floating stick stays fully operational.
   // Only a quick, stationary two-tap sequence is recognized.
   if(!down)down={id:e.pointerId,start:p,at:Date.now(),moved:false};
   else{down.moved=true;lastTap=null;}
   return;
  }
  suppress(e);
  if(!allowed()){toggle(false);return;}
  fingers.set(e.pointerId,{...p,start:p,at:Date.now(),moved:false,multi:fingers.size>0});
  if(fingers.size>=2){
   for(const f of fingers.values())f.multi=true;
   const pair=[...fingers.values()];
   pinch=distance(pair[0],pair[1])||1;
   lastTap=null;
  }
  try{zone.setPointerCapture(e.pointerId);}catch(_){}
 },true);
 zone.addEventListener('pointermove',e=>{
  const p=coords(e);
  if(!mode){
   if(down?.id===e.pointerId&&distance(p,down.start)>12){down.moved=true;lastTap=null;}
   return;
  }
  suppress(e);
  const f=fingers.get(e.pointerId);
  if(!f)return;
  if(!allowed()){toggle(false);return;}
  const dx=p.x-f.x,dy=p.y-f.y;
  if(distance(p,f.start)>12)f.moved=true;
  f.x=p.x;f.y=p.y;
  if(fingers.size>=2){
   const pair=[...fingers.values()],next=distance(pair[0],pair[1])||1;
   const scale=next/(pinch||next);
   if(Number.isFinite(scale)&&Math.abs(scale-1)>.003)
    onGesture({kind:'pinch',scale:clamp(scale,.75,1.35)});
   pinch=next;
  }else if(dx||dy){
   // Mapping in logical, normalized screen units lets identical finger swipes
   // affect the same fraction of the host viewport on every phone resolution.
   const d=delta(dx,dy),rect=zone.getBoundingClientRect();
   const w=isRotated()?rect.height:rect.width,h=isRotated()?rect.width:rect.height;
   onGesture({kind:'pan',dx:clamp(d.x/Math.max(w,1)*960,-320,320),
     dy:clamp(d.y/Math.max(h,1)*400,-240,240)});
  }
 },true);
 function end(e){
  if(!mode){
   if(down?.id!==e.pointerId)return;
   const p=coords(e),valid=e.type==='pointerup'&&!down.moved&&
    distance(p,down.start)<=12&&Date.now()-down.at<=300;
   down=null;
   if(valid)tap(p,Date.now());
   else lastTap=null;
   return;
  }
  suppress(e);
  const f=fingers.get(e.pointerId);
  if(!f)return;
  fingers.delete(e.pointerId);
  if(fingers.size<2)pinch=0;
  if(!fingers.size&&!f.moved&&!f.multi&&e.type==='pointerup'&&Date.now()-f.at<=300)
   tap(coords(e),Date.now());
  else if(f.moved||f.multi)lastTap=null;
 }
 for(const name of ['pointerup','pointercancel','lostpointercapture'])
  zone.addEventListener(name,end,true);
 return Object.freeze({reset:()=>toggle(false),enabled:()=>mode});
}
window.BoardControllerCamera=Object.freeze({attach});
})();
