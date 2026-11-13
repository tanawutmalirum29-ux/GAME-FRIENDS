/* GAME-FRIENDS shared character rules.
 * Every minigame imports this module, so solid/pushable characters are the
 * default. A map MUST explicitly opt out using {playersSolid:false}.
 *
 * Physics is host-authoritative and uses logical world coordinates (NOT canvas
 * pixels). Maps supply their own playable bounds/obstacle projection.
 */
(() => {
'use strict';
const DEFAULTS=Object.freeze({
 playersSolid:true,
 radius:15,
 iterations:6,
 maxShift:Infinity,
 pressure:true,
 basePressure:.24,
 speedReference:170
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(x,f=0)=>Number.isFinite(x)?x:f;
const defaultActive=p=>p?.active===true;
function activate(players){
 for(const p of players||[])if(p)p.active=true;
 return players;
}
function control(input){
 const k=input||{};
 let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(Math.hypot(x,y)<.10){
  x=Number(!!k.right)-Number(!!k.left);
  y=Number(!!k.down)-Number(!!k.jump);
 }
 const strength=Math.hypot(x,y);
 if(strength>1){x/=strength;y/=strength;}
 return {x,y,action:!!k.action,alt:!!k.alt};
}
function project(p,x,y,r,opts){
 const box=opts.bounds;
 const padding=Number.isFinite(opts.boundaryRadius)?opts.boundaryRadius:r;
 if(box){
  const minX=box.x+padding,maxX=box.x+box.w-padding;
  const minY=box.y+padding,maxY=box.y+box.h-padding;
  x=clamp(x,Math.min(minX,maxX),Math.max(minX,maxX));
  y=clamp(y,Math.min(minY,maxY),Math.max(minY,maxY));
 }
 // The map owns world-specific constraints (circle arenas, graveyard stones,
 // worktops, etc). Do not drop them when centralizing character collisions.
 if(typeof opts.constrain==='function'){
  const result=opts.constrain(p,x,y,r);
  if(result&&Number.isFinite(result.x)&&Number.isFinite(result.y)){
   x=result.x;y=result.y;
  }
 }
 return {x,y};
}
function move(p,vector,dt,opts={}){
 if(!p)return null;
 const radius=Number.isFinite(opts.radius)?opts.radius:DEFAULTS.radius;
 let x=finite(vector?.x),y=finite(vector?.y);
 const length=Math.hypot(x,y);
 if(length>1){x/=length;y/=length;}
 const speed=Math.max(0,finite(opts.speed,170)),step=clamp(finite(dt),0,.1);
 const fromX=finite(p.x),fromY=finite(p.y);
 const position=project(p,fromX+x*speed*step,fromY+y*speed*step,radius,opts);
 p.x=position.x;p.y=position.y;
 p.vx=step>0?(p.x-fromX)/step:0;
 p.vy=step>0?(p.y-fromY)/step:0;
 if(Math.hypot(x,y)>.12&&!opts.lockHeading){
  const size=Math.hypot(x,y);
  p.dir={x:x/size,y:y/size};p.face=x<0?-1:1;
 }
 return p;
}
function resolve(players,opts={}){
 // Opt-out must be EXPLICIT. An omitted option always means solid characters.
 if(opts.playersSolid===false)return {contacts:0,moved:0,enabled:false};
 const eligible=typeof opts.filter==='function'?opts.filter:defaultActive;
 const people=(players||[]).filter(p=>p&&eligible(p)&&Number.isFinite(p.x)&&Number.isFinite(p.y))
  .slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const radius=Number.isFinite(opts.radius)&&opts.radius>0?opts.radius:DEFAULTS.radius;
 const iterations=Math.max(1,Math.min(12,Math.trunc(finite(opts.iterations,DEFAULTS.iterations))));
 const maxShift=Number.isFinite(opts.maxShift)?Math.max(0,opts.maxShift):Infinity;
 const minDistance=radius*2;
 let contacts=0,moved=0;
 const force=(p,nx,ny)=>{
  if(typeof opts.force==='function'){
   const f=opts.force(p,nx,ny);
   if(Number.isFinite(f))return Math.max(.01,f);
  }
  if(opts.pressure===false)return 1;
  const ref=Math.max(1,finite(opts.speedReference,DEFAULTS.speedReference));
  const approach=Math.max(0,finite(p.vx)*nx+finite(p.vy)*ny);
  return Math.max(.01,finite(opts.basePressure,DEFAULTS.basePressure)+approach/ref);
 };
 for(let pass=0;pass<iterations;pass++){
  let found=false;
  for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
   const a=people[i],b=people[j];
   if(typeof opts.canCollide==='function'&&opts.canCollide(a,b)===false)continue;
   let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
   if(dist>=minDistance-1e-6)continue;
   if(dist<1e-7){
    // Deterministic even if several spawn at the same exact coordinates.
    const angle=((i+1)*17+(j+1)*29)*2.399963;
    dx=Math.cos(angle);dy=Math.sin(angle);dist=1;
   }
   const nx=dx/dist,ny=dy/dist,overlap=minDistance-Math.min(dist,minDistance);
   const af=force(a,nx,ny),bf=force(b,-nx,-ny),sum=af+bf;
   const shiftA=Math.min(maxShift,overlap*bf/sum);
   const shiftB=Math.min(maxShift,overlap*af/sum);
   const beforeA={x:a.x,y:a.y},beforeB={x:b.x,y:b.y};
   const nextA=project(a,a.x-nx*shiftA,a.y-ny*shiftA,radius,opts);
   const nextB=project(b,b.x+nx*shiftB,b.y+ny*shiftB,radius,opts);
   a.x=nextA.x;a.y=nextA.y;b.x=nextB.x;b.y=nextB.y;
   if(Math.hypot(a.x-beforeA.x,a.y-beforeA.y)+
      Math.hypot(b.x-beforeB.x,b.y-beforeB.y)>1e-6)moved++;
   found=true;contacts++;
  }
  if(!found)break;
 }
 return {contacts,moved,enabled:true};
}
// Every avatar carries the same combat API and visual feedback in any map.
function combat(){return window.PartyCombatMotion;}
function startPunch(p){return combat().startAttack(p);}
function stepPunch(p,dt,onImpact){return combat().stepAttack(p,dt,onImpact);}
function punchFriends(attacker,players,opts){return combat().hitPlayers(attacker,players,opts);}
// One shared readable nameplate for NORMAL games, mounts and lobby.
// Existing health/status UI keeps its own position; game-specific mounts can
// request a larger gap with offsetY without moving the health indicator.
const nameRects=new WeakMap();
function beginNameFrame(ctx){if(ctx)nameRects.set(ctx,[]);}
function drawName(ctx,p,opts={}){
 if(!ctx||!p||opts.nameTag===false||typeof ctx.fillText!=='function')return;
 const raw=String(p.name??(p.isBot?'บอท':'')).trim();
 if(!raw)return;
 const x=Number.isFinite(opts.x)?opts.x:(opts.local?0:Number(p.x)||0);
 const y=Number.isFinite(opts.y)?opts.y:(opts.local?0:Number(p.y)||0);
 const scale=Number.isFinite(opts.scale)&&opts.scale>0?opts.scale:1;
 const offset=Number.isFinite(opts.offsetY)?opts.offsetY:Math.max(35,36*scale);
 const fontSize=Number.isFinite(opts.fontSize)?opts.fontSize:12;
 const maxWidth=Number.isFinite(opts.maxWidth)?opts.maxWidth:94;
 ctx.save();
 ctx.font='800 '+fontSize+'px system-ui,sans-serif';
 const measured=value=>{
  if(typeof ctx.measureText==='function'){
   const metrics=ctx.measureText(value);
   if(Number.isFinite(metrics?.width))return metrics.width;
  }
  return Array.from(value).length*fontSize*.62;
 };
 const units=Array.from(raw);
 let name=raw;
 while(units.length>1&&measured(name)>maxWidth-12){
  units.pop();name=units.join('')+'…';
 }
 // Use the SAME shaped-text measurement to size the plate and place its
 // actual glyphs. The left-edge anchor is stable on iPad Safari; a centred
 // fillText(..., maxWidth) was painting Thai labels shifted to the right while
 // the plate stayed correctly centred over the actor.
 const textWidth=measured(name);
 const width=Math.min(maxWidth,Math.max(26,textWidth+16));
 const height=fontSize+8;
 let left=x-width/2,top=y-offset-height;
 const occupied=nameRects.get(ctx);
 if(occupied){
  const m=typeof ctx.getTransform==='function'?ctx.getTransform():null;
  const rect=(lx,ty)=>{
   const a=m?.a??1,b=m?.b??0,c=m?.c??0,d=m?.d??1,e=m?.e??0,f=m?.f??0;
   const corners=[[lx,ty],[lx+width,ty],[lx,ty+height],[lx+width,ty+height]]
    .map(([px,py])=>[a*px+c*py+e,b*px+d*py+f]);
   const xs=corners.map(q=>q[0]),ys=corners.map(q=>q[1]);
   return{x:Math.min(...xs),y:Math.min(...ys),r:Math.max(...xs),b:Math.max(...ys)};
  };
  // Stack crowded names instead of painting over another person's name.
  for(let i=0;i<12;i++){
   const candidate=rect(left,top);
   if(!occupied.some(q=>candidate.x<q.r+2&&candidate.r>q.x-2&&candidate.y<q.b+2&&candidate.b>q.y-2)){
    occupied.push(candidate);break;
   }
   top-=height+2;
   if(i===11)occupied.push(rect(left,top));
  }
 }
 ctx.fillStyle='rgba(8,20,37,.87)';
 if(typeof ctx.roundRect==='function'){ctx.beginPath();ctx.roundRect(left,top,width,height,5);ctx.fill();}
 else ctx.fillRect?.(left,top,width,height);
 // Explicit left alignment prevents the iOS canvas maxWidth/centre-anchor
 // discrepancy. Never pass a fourth maxWidth argument: the text was already
 // measured and ellipsized. Keep stroke and fill on the *identical* anchor.
 ctx.textAlign='left';ctx.textBaseline='middle';ctx.direction='ltr';
 const textX=left+(width-textWidth)/2,textY=top+height/2+0.5;
 // Clip unexpected font-fallback width changes without clipping Thai accents.
 if(typeof ctx.rect==='function'&&typeof ctx.clip==='function'){
  ctx.beginPath();ctx.rect(left+3,top-4,width-6,height+8);ctx.clip();
 }
 ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.strokeStyle='#071221';
 ctx.strokeText?.(name,textX,textY);
 ctx.fillStyle='#ffffff';ctx.fillText(name,textX,textY);
 ctx.restore();
}
function draw(ctx,p,opts={}){
 const fx=combat();
 if(window.PartyPlayerAvatar?.draw)
   window.PartyPlayerAvatar.draw(ctx,p,{
     ...opts,label:false,attacking:opts.attacking??!!fx?.isAttacking(p)
   });
 else{
   // Keep visible avatar art even before SVG images have decoded.
   const x=opts.local?0:p.x,y=opts.local?0:p.y;
   ctx.save();ctx.fillStyle=p.color||'#69dddc';
   ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 if(fx&&opts.combat!==false){
   if(!opts.local)fx.drawAttack(ctx,p);
   fx.drawStun(ctx,p,opts.time||0,{local:!!opts.local});
 }
 // Local riders are drawn inside rotating/scaled mounts. Their parent game
 // draws the tag after restoring that transform to keep text upright.
 if(opts.nameTag!==false&&!opts.local)drawName(ctx,p,opts);
}
window.PartyCharacters=Object.freeze({beginNameFrame,drawName,
 DEFAULTS,activate,control,move,resolve,startPunch,stepPunch,punchFriends,draw
});
})();
