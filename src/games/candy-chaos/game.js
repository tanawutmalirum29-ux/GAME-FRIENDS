/* CANDY CHAOS — host-authoritative candy collecting party game, fixed 60 Hz step.
   Run, grab candies (+35), dodge bombs that tend to land where you are heading
   (-35 and a 1.2 s stun). Highest score when the clock runs out wins.
   Native ES module: modules below are private to this folder; the Host provides
   PartyCharacters (input, collision resolve, avatar drawing). */
import {STEP,EPS,C,TAU,worldFor,bombCap} from './config.js';
import {rng} from './rng.js';
import {clamp,humanInput,movePlayer,pairCollisions,externalResolve} from './physics.js';
import {makeBot,botInput} from './bots.js';
import {fillCandies,updateCandySpawns,updateBombSpawns,removeBomb,removeCandy,candyTaken} from './spawn.js';
import {floatText,sparkle,blast,poof,updateFx,drawFx,drawFloats} from './fx.js';
import * as art from './art.js';

const hyp=Math.hypot;
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const SPARK=['#ff4f9a','#35c6ff','#ffd23a','#6fdc4a','#a66bff','#ff8a3a'];

/* ------------------------------ setup ------------------------------ */
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('CANDY CHAOS supports 1–12 players');
 const n=ps.length,world=worldFor(n),b=world.bounds;
 const seed=(((Number(round.candySeed??round.seed)||(Date.now()^0x51ed27))>>>0)||1);
 const s={world,unit:world.w/960,clock:0,tick:0,accumulator:0,seed,fxSeed:0x9e3779b1,uid:0,
  roster:ps,originalCount:n,duration:world.duration,over:false,finished:false,pendingFinish:0,
  candies:[],bombs:[],fx:[],floats:[],live:[],drawList:[],
  pool:{candy:[],bomb:[],fx:[],float:[]},
  candyTimer:0,candyGoal:0,bombTimer:0,bombCap:bombCap(n,world),recent:[],lastNear:[],rot:[],
  shake:0,layers:null,winnerIds:[],ranking:[]};
 round.candyChaos=s;
 s.layers=art.preload(world);
 // spread the start positions on an ellipse around the middle, order shuffled with the seed
 const cx=b.x+b.w/2,cy=b.y+b.h/2,order=ps.map((_,i)=>i);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 ps.forEach((p,i)=>{
  let x=cx,y=cy;
  if(n>1){const a=-Math.PI/2+order[i]*TAU/n;x=cx+Math.cos(a)*b.w*.30;y=cy+Math.sin(a)*b.h*.30;}
  p.active=true;p.score=0;p.x=x;p.y=y;p.vx=p.vy=0;
  const dx=cx-x,dy=cy-y,m=hyp(dx,dy)||1;p.dir={x:dx/m,y:dy/m};p.face=p.dir.x<0?-1:1;
  p.dyn={cvx:0,cvy:0,kx:0,ky:0,ox:x,oy:y,stunUntil:-9,immuneUntil:-9,hits:0,got:0,bot:p.isBot?makeBot(s):null};
  if(p.dyn.bot){p.dyn.bot.lastX=x;p.dyn.bot.lastY=y;}
 });
 fillCandies(s,ps);
 round.remaining=s.duration;
 return s;
}

/* ------------------------------ bombs & candies ------------------------------ */
function explode(s,p,bm){
 const d=p.dyn;
 p.score-=C.bombPenalty;d.hits++;
 d.stunUntil=s.clock+C.stun;
 d.immuneUntil=d.stunUntil+C.stunGrace;      // no re-hit right after waking up
 const dx=p.x-bm.x,dy=p.y-bm.y,m=hyp(dx,dy)||1;
 d.kx+=dx/m*C.hitKnock;d.ky+=dy/m*C.hitKnock;d.cvx*=.2;d.cvy*=.2;
 blast(s,bm.x,bm.y);
 floatText(s,p.x,p.y-24,'-'+C.bombPenalty,'#ff4a4a');
 s.shake=Math.max(s.shake,.7);
}
function updateBombs(s,live,dt){
 for(let i=s.bombs.length-1;i>=0;i--){
  const bm=s.bombs[i];
  if(bm.state==='warn'){
   bm.t+=dt;
   if(bm.t<C.warnTime)continue;
   // never arm on top of a stunned / protected player: wait a moment, then give up
   let held=false;
   for(const p of live)if(s.clock<p.dyn.immuneUntil&&hyp(p.x-bm.x,p.y-bm.y)<C.radius+C.bombR+10){held=true;break;}
   if(held){bm.hold+=dt;if(bm.hold>C.holdMax)removeBomb(s,i);continue;}
   bm.state='live';bm.life=C.bombLife;bm.age=0;
   continue;
  }
  bm.life-=dt;bm.age+=dt;
  if(bm.life<=0){poof(s,bm.x,bm.y);removeBomb(s,i);continue;}
  let hit=null,best=Infinity;
  for(const p of live){
   if(s.clock<p.dyn.immuneUntil)continue;
   const d=hyp(p.x-bm.x,p.y-bm.y);
   if(d<C.radius+C.bombR-2&&d<best){best=d;hit=p;}
  }
  if(hit){explode(s,hit,bm);removeBomb(s,i);}
 }
}
function collectCandies(s,live){
 for(let i=s.candies.length-1;i>=0;i--){
  const c=s.candies[i];let who=null,best=Infinity;
  for(const p of live){
   if(s.clock<p.dyn.stunUntil)continue;
   const d=hyp(p.x-c.x,p.y-c.y);
   if(d<C.radius+C.candyR+2&&d<best){best=d;who=p;}
  }
  if(!who)continue;
  who.score+=C.candyScore;who.dyn.got++;
  sparkle(s,c.x,c.y,SPARK[c.color%SPARK.length]);
  floatText(s,who.x,who.y-24,'+'+C.candyScore,who.color||'#fff');
  removeCandy(s,i);       // removed immediately: one candy can never score twice
  candyTaken(s);
 }
}

/* ------------------------------ step / update ------------------------------ */
function endMatch(s,round){
 // order matters: stop spawning/scoring first, clear hazards, then let everybody coast to a stop
 s.over=true;round.remaining=0;
 for(let i=s.bombs.length-1;i>=0;i--){poof(s,s.bombs[i].x,s.bombs[i].y);removeBomb(s,i);}
 s.pendingFinish=C.finishDelay;
}
function finish(s,round,ps){
 s.finished=true;round.remaining=0;
 const list=ps.filter(p=>p.active),top=list.reduce((m,p)=>Math.max(m,p.score),-Infinity);
 s.winnerIds=list.filter(p=>p.score===top).map(p=>p.id);
 s.ranking=list.map(p=>({id:p.id,value:p.score,rank:1+list.filter(q=>q.score>p.score).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
}
function step(dt,round,ps){
 const s=round.candyChaos;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;
 const live=s.live;live.length=0;
 for(const p of ps)if(p.active&&p.dyn)live.push(p);
 for(const p of live){
  const inp=s.over?{x:0,y:0}:p.isBot?botInput(s,p,live,dt):humanInput(p);
  movePlayer(s,p,inp,dt);
 }
 pairCollisions(s,live,true);
 pairCollisions(s,live,false);
 externalResolve(s,live);
 for(const p of live){p.vx=p.dyn.cvx+p.dyn.kx;p.vy=p.dyn.cvy+p.dyn.ky;}
 if(!s.over){
  updateBombs(s,live,dt);
  collectCandies(s,live);
  updateCandySpawns(s,live,dt);
  updateBombSpawns(s,live,dt);
  round.remaining=Math.max(0,s.duration-s.clock);
  if(s.clock>=s.duration)endMatch(s,round);
 }else{
  s.pendingFinish-=dt;
  if(s.pendingFinish<=0)finish(s,round,ps);
 }
 updateFx(s,dt);
}
function update(dt,round,ps){
 const s=round.candyChaos;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.candyChaos;
 return{remaining:round.remaining??null,elapsed:s?.clock||0,winnerIds:s?.winnerIds||[],
  scores:ps.filter(p=>p.active).map(p=>({id:p.id,score:p.score||0,stunned:!!s&&!!p.dyn&&s.clock<p.dyn.stunUntil}))};
}

/* ------------------------------ drawing ------------------------------ */
function draw(g,time,round,ps){
 const s=round.candyChaos;if(!s)return;
 const w=s.world;
 g.save();
 g.fillStyle='#b9a4ff';g.fillRect(0,0,960,540);
 g.scale(960/w.w,540/w.h);
 if(s.shake>0)g.translate(Math.sin(s.clock*91)*6*s.shake,Math.cos(s.clock*77)*6*s.shake);
 art.drawBackdrop(g,w,s.layers);
 for(const bm of s.bombs)if(bm.state==='warn')art.drawWarn(g,bm,s.clock);
 drawFx(g,s,true);
 for(const c of s.candies)art.drawCandy(g,c,s.clock);
 for(const bm of s.bombs)if(bm.state==='live')art.drawBomb(g,bm,s.clock);
 const list=s.drawList;list.length=0;
 for(const p of ps)if(p.active&&p.dyn)list.push(p);
 list.sort((a,b)=>a.y-b.y);
 for(const p of list){
  const stunned=s.clock<p.dyn.stunUntil,guard=!stunned&&s.clock<p.dyn.immuneUntil;
  g.save();
  if(guard&&Math.floor(s.clock*16)%2===0)g.globalAlpha=.55;
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false});
  else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,C.radius,0,TAU);g.fill();}
  g.restore();
  if(stunned)art.drawStars(g,p,s.clock);
 }
 art.drawForeground(g,w,s.layers);
 drawFx(g,s,false);
 drawFloats(g,s);
 g.restore();
}

/* ------------------------------ results / roster ------------------------------ */
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>({id:p.id,value:p.score||0,label:(p.score||0)+' คะแนน'}));
}
function getRoster(round,players){
 const s=round.candyChaos;
 return players.filter(p=>p.active).map(p=>({id:p.id,value:p.score||0,label:(p.score||0)+' คะแนน',
  status:s&&p.dyn&&s.clock<p.dyn.stunUntil?'stun':'run',eliminated:false}));
}
function getControllerPacket(p,round,players){
 const s=round.candyChaos,d=p.dyn||{};
 return{t:'candy-chaos-status',mode:round.mode,score:p.score||0,
  stunned:!!s&&s.clock<(d.stunUntil??-9),remaining:round.remaining??null};
}
// Release cached scenery and pooled objects when the round is over.
function dispose(round){
 const s=round.candyChaos;if(!s)return;
 s.fx.length=0;s.floats.length=0;s.candies.length=0;s.bombs.length=0;
 s.pool.candy.length=s.pool.bomb.length=s.pool.fx.length=s.pool.float.length=0;
 art.releaseLayers();
}

const engine=Object.freeze({getControllerPacket,getResult,getRoster,resultTitle:'ราชาแห่งลูกอม!',
 countdownSeconds:3,setup,update,draw,hud,step,finish,dispose,config:C});
export default engine;
