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
function draw(ctx,p,opts={}){
 if(window.PartyPlayerAvatar?.draw)
   return window.PartyPlayerAvatar.draw(ctx,p,opts);
 // Keep a visible character even while SVG images are still decoding.
 ctx.save();ctx.fillStyle=p.color||'#69dddc';
 ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.fill();ctx.restore();
}
window.PartyCharacters=Object.freeze({
 DEFAULTS,activate,control,move,resolve,draw
});
})();
