/* Movement + collisions. Uses the Host's PartyCharacters when present. */
import {C} from './config.js';
const hyp=Math.hypot;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const finite=(v,f=0)=>Number.isFinite(v)?v:f;

export function humanInput(p){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(p.input);
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}
export function clampBody(s,p){
 const b=s.world.bounds,d=p.dyn,r=C.radius;
 if(p.x<b.x+r){p.x=b.x+r;if(d.cvx<0)d.cvx=0;if(d.kx<0)d.kx=0;}
 if(p.x>b.x+b.w-r){p.x=b.x+b.w-r;if(d.cvx>0)d.cvx=0;if(d.kx>0)d.kx=0;}
 if(p.y<b.y+r){p.y=b.y+r;if(d.cvy<0)d.cvy=0;if(d.ky<0)d.ky=0;}
 if(p.y>b.y+b.h-r){p.y=b.y+b.h-r;if(d.cvy>0)d.cvy=0;if(d.ky>0)d.ky=0;}
}
export function isStunned(s,p){return s.clock<p.dyn.stunUntil;}
export function movePlayer(s,p,inp,dt){
 const d=p.dyn,stunned=isStunned(s,p)||s.over;
 d.ox=p.x;d.oy=p.y;
 let ix=finite(inp.x),iy=finite(inp.y);
 const m0=hyp(ix,iy);if(m0>1){ix/=m0;iy/=m0;}
 if(stunned){ix=0;iy=0;}
 const mag=hyp(ix,iy);
 const k=s.over?18:stunned?4:mag>.05?C.response:C.brake,a=1-Math.exp(-k*dt);
 d.cvx+=(ix*C.maxSpeed-d.cvx)*a;d.cvy+=(iy*C.maxSpeed-d.cvy)*a;
 const dec=Math.exp(-C.knockDecay*dt);d.kx*=dec;d.ky*=dec;
 if(hyp(d.kx,d.ky)<1){d.kx=0;d.ky=0;}
 p.x+=(d.cvx+d.kx)*dt;p.y+=(d.cvy+d.ky)*dt;
 clampBody(s,p);
 if(!stunned&&mag>.1){p.dir={x:ix/mag,y:iy/mag};p.face=p.dir.x<0?-1:1;}
 p.vx=d.cvx+d.kx;p.vy=d.cvy+d.ky;
}
// Equal-mass bump: push strength follows closing speed along the contact normal.
export function pairCollisions(s,live,impulse){
 const R2=C.radius*2;
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j];
  let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);
  if(d>=R2)continue;
  if(d<1e-4){dx=(a.id<b.id?1:-1);dy=0;d=1e-4;}
  const nx=dx/d,ny=dy/d,over=R2-d;
  if(impulse){
   const va={x:a.dyn.cvx+a.dyn.kx,y:a.dyn.cvy+a.dyn.ky},vb={x:b.dyn.cvx+b.dyn.kx,y:b.dyn.cvy+b.dyn.ky};
   const rel=(vb.x-va.x)*nx+(vb.y-va.y)*ny;
   if(rel<0){
    const j2=-(1+C.restitution)*rel/2;
    a.dyn.kx-=j2*nx;a.dyn.ky-=j2*ny;b.dyn.kx+=j2*nx;b.dyn.ky+=j2*ny;
   }
  }
  const sh=Math.min(over/2+.05,6);
  a.x-=nx*sh;a.y-=ny*sh;b.x+=nx*sh;b.y+=ny*sh;
 }
}
export function externalResolve(s,live){
 if(live.length>1&&window.PartyCharacters?.resolve){
  const b=s.world.bounds;
  window.PartyCharacters.resolve(live,{radius:C.radius,iterations:2,maxShift:4,bounds:{x:b.x,y:b.y,w:b.w,h:b.h}});
 }
 for(const p of live)clampBody(s,p);
}
