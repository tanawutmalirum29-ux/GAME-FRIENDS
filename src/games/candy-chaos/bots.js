/* Bots play by the player rules: same speed, same hit radius, they only see candies
   that already exist and bombs whose warning ring is already on the floor. */
import {C,TAU} from './config.js';
import {rng} from './rng.js';
import {clamp} from './physics.js';
const hyp=Math.hypot;

export function makeBot(s){
 return{skill:.72+rng(s)*.22,interval:.09+rng(s)*.07,at:rng(s)*.2,ax:0,ay:0,dx:0,dy:0,
  react:.12+rng(s)*.22,speedBias:.9+rng(s)*.1,target:null,lockUntil:0,switches:0,switchT:0,
  wx:0,wy:0,wanderUntil:0,ignore:Object.create(null),
  lastX:0,lastY:0,stuckT:0,unstick:0,ux:0,uy:0};
}
function noticed(s,b,bm){
 if(s.clock<(b.ignore[bm.id]||0))return false;
 return bm.state==='live'?bm.age>=b.react*.5:bm.t>=b.react;
}
function decide(s,p,ps){
 const b=p.dyn.bot,bd=s.world.bounds,R=C.radius,sp=C.maxSpeed;
 // a short lapse of attention now and then, so bots can miss a ring
 for(const bm of s.bombs)if(rng(s)<(1-b.skill)*.06&&s.clock>=(b.ignore[bm.id]||0)+.6)b.ignore[bm.id]=s.clock+.5;
 const vis=s.bombs.filter(bm=>noticed(s,b,bm));
 const danger=(x,y)=>{
  let cost=0;
  for(const bm of vis){
   const d=hyp(x-bm.x,y-bm.y),lim=R+C.bombR+(bm.state==='warn'?12:5);
   if(d<lim)cost+=80+(lim-d)*3;else if(d<lim+18)cost+=(lim+18-d)*1.1;
  }
  return cost;
 };
 const others=ps.filter(q=>q.active&&q!==p&&s.clock>=q.dyn.stunUntil);
 /* ---- choose a candy: distance, rivals that are closer, bombs on the way ---- */
 let best=null,bestScore=Infinity,cur=null,curScore=Infinity;
 for(const c of s.candies){
  if(s.clock-c.born<b.react)continue;
  const dist=hyp(c.x-p.x,c.y-p.y);
  let score=dist+(rng(s)-.5)*(1-b.skill)*60;
  for(const q of others){const dq=hyp(c.x-q.x,c.y-q.y);if(dq<dist*.75-8){score+=(dist-dq)*.7+25;break;}}
  let risk=0;
  for(let k=1;k<=5;k++)if(danger(p.x+(c.x-p.x)*k/5,p.y+(c.y-p.y)*k/5)>20){risk=1;break;}
  if(danger(c.x,c.y)>20)risk=2;
  score+=risk===2?120:risk?45:0;
  if(score<bestScore){bestScore=score;best=c;}
  if(c.id===b.target){cur=c;curScore=score;}
 }
 let pick=best;
 if(cur&&(s.clock<b.lockUntil||curScore<=bestScore*1.25+30))pick=cur;
 if(pick&&pick.id!==b.target){b.switches++;if(b.switches>=4){b.lockUntil=s.clock+1.2;b.switches=0;}}
 b.target=pick?pick.id:null;
 let aim;
 if(pick)aim={x:pick.x,y:pick.y};
 else{ // nothing visible yet: drift around the middle instead of standing still
  if(s.clock>=b.wanderUntil||hyp(p.x-b.wx,p.y-b.wy)<30){
   b.wx=bd.x+bd.w*(.25+rng(s)*.5);b.wy=bd.y+bd.h*(.25+rng(s)*.5);b.wanderUntil=s.clock+1.5+rng(s);
  }
  aim={x:b.wx,y:b.wy};
 }
 /* ---- steering: 16 headings, scored on danger + progress + wall/crowd avoidance ---- */
 const prevA=Math.atan2(b.dy,b.dx),hasPrev=hyp(b.dx,b.dy)>.1;
 let bestC=null,bestCost=Infinity;
 for(let k=0;k<16;k++){
  const a=k*TAU/16,dx=Math.cos(a),dy=Math.sin(a);
  const px=clamp(p.x+dx*sp*.6,bd.x+R,bd.x+bd.w-R),py=clamp(p.y+dy*sp*.6,bd.y+R,bd.y+bd.h-R);
  let cost=0;
  for(const f of[.22,.45,.68])
   cost+=danger(clamp(p.x+dx*sp*f,bd.x+R,bd.x+bd.w-R),clamp(p.y+dy*sp*f,bd.y+R,bd.y+bd.h-R));
  cost+=hyp(px-aim.x,py-aim.y)*(pick?1:.5);
  const cxm=Math.min(px-bd.x,bd.x+bd.w-px)-R,cym=Math.min(py-bd.y,bd.y+bd.h-py)-R;
  cost+=Math.max(0,50-cxm)*.5+Math.max(0,50-cym)*.5;
  for(const q of others){const dq=hyp(px-q.x,py-q.y);if(dq<40)cost+=(40-dq)*.25;}
  if(hasPrev){
   const da=Math.abs(Math.atan2(Math.sin(a-prevA),Math.cos(a-prevA)));
   if(da<.4)cost-=5;
  }
  cost+=(rng(s)-.5)*4;
  if(cost<bestCost){bestCost=cost;bestC={dx,dy};}
 }
 /* ---- stuck breaker: leaning on a wall or a crowd -> slide toward open floor ---- */
 b.stuckT+=b.interval;
 if(b.stuckT>.8){
  if(hyp(p.x-b.lastX,p.y-b.lastY)<7&&s.clock>=p.dyn.stunUntil){
   const cx=bd.x+bd.w/2-p.x,cy=bd.y+bd.h/2-p.y,m=hyp(cx,cy)||1,side=rng(s)<.5?-1:1;
   b.unstick=s.clock+.55;b.ux=cx/m*.6+(-cy/m)*.8*side;b.uy=cy/m*.6+(cx/m)*.8*side;
   b.lockUntil=0;b.target=null;
  }
  b.lastX=p.x;b.lastY=p.y;b.stuckT=0;
 }
 if(s.clock<b.unstick){b.dx=b.ux;b.dy=b.uy;}
 else if(bestC){b.dx=bestC.dx;b.dy=bestC.dy;}
}
export function botInput(s,p,ps,dt){
 // Takeovers during an active round preserve candy, bomb and score state.
 const b=p.dyn.bot||(p.dyn.bot=Object.assign(makeBot(s),{lastX:p.x,lastY:p.y}));
 b.at-=dt;b.switchT+=dt;
 if(b.switchT>3){b.switchT=0;b.switches=0;}
 if(b.at<=0){decide(s,p,ps);b.at=b.interval*(.85+rng(s)*.3);}
 const a=1-Math.exp(-13*dt);
 b.ax+=(b.dx-b.ax)*a;b.ay+=(b.dy-b.ay)*a;
 return{x:b.ax*b.speedBias,y:b.ay*b.speedBias};
}
