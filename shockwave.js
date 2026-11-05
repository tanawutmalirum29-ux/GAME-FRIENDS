/* SHOCKWAVE: host-authoritative 5x5 blast-dodge survival.
   All tiles remain solid. Only players overlapping a warned explosion are removed. */
(() => {
'use strict';
const TAU=Math.PI*2, FIXED=1/60;
const C=Object.freeze({speed:177,bodyRadius:13,footRadius:11,blastThreshold:.18,maxPlayers:12});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const living=ps=>ps.filter(p=>p.active&&p.shockAlive);
function random(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x13579bdf;return (s.seed>>>0)/4294967296;}
function createGrid(s){
 s.big=false;s.cols=5;s.rows=5;s.tileSize=78;
 s.board={x:285,y:116,w:390,h:390};
 s.tiles=Array.from({length:25},(_,id)=>({id,col:id%5,row:Math.floor(id/5),state:'safe',wave:0}));
 s.initialTiles=s.remainingTiles=25;return s.tiles;
}
function tileCenter(s,t){return {x:s.board.x+(t.col+.5)*s.tileSize,y:s.board.y+(t.row+.5)*s.tileSize};}
function tileAt(s,x,y){const c=Math.floor((x-s.board.x)/s.tileSize),r=Math.floor((y-s.board.y)/s.tileSize);
 return c>=0&&r>=0&&c<5&&r<5?s.tiles[r*5+c]:null;}
function spawnPlayers(s,ps){
 const ids=s.tiles.map(t=>t.id);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 ps.forEach((p,i)=>{
   const pos=tileCenter(s,s.tiles[ids[i%ids.length]]);
   p.x=pos.x;p.y=pos.y;p.vx=0;p.vy=0;p.dir={x:1,y:0};
   p.shockAlive=!!p.active;p.shockFall=0;p.shockBotWave=-1;p.shockBotReadyAt=0;
   p.shockEliminatedAt=0;p.shockEliminatedWave=0;
 });
}
function setup(round,ps){
 const s={phase:'PREPARE',timer:0,clock:0,accumulator:0,wave:0,danger:[],warningDuration:0,
  warningStarted:false,seed:((Number(round.shockSeed)||Date.now()^0x6a53)>>>0)||1,
  winnerId:null,finished:false,fastPhase:false,suddenDeath:false,finalArena:false,
  events:[],effects:[],eliminationEvent:0,tiebreakers:0,pendingTiebreaker:null,roundId:0,
  startCount:ps.length};
 round.shockwave=s;round.remaining=null;
 for(const p of ps){p.active=true;p.score=0;}
 createGrid(s);spawnPlayers(s,ps);return s;
}
function circleRectArea(cx,cy,r,rect){
 const left=Math.max(cx-r,rect.x),right=Math.min(cx+r,rect.x+rect.w);
 if(right<=left)return 0;
 const n=32,h=(right-left)/n;
 const f=x=>{const dy=Math.sqrt(Math.max(0,r*r-(x-cx)**2));
   return Math.max(0,Math.min(cy+dy,rect.y+rect.h)-Math.max(cy-dy,rect.y));};
 let sum=f(left)+f(right);
 for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(left+i*h);
 return Math.max(0,sum*h/3);
}
function calculateFootSupport(s,p){
 return clamp(circleRectArea(p.x,p.y,C.footRadius,s.board)/(Math.PI*C.footRadius**2),0,1);
}
function calculateDangerContact(s,p,dangerIds){
 const selected=dangerIds instanceof Set?dangerIds:new Set(dangerIds);
 let area=0;
 for(const id of selected){
   const t=s.tiles[id];if(!t)continue;
   const r={x:s.board.x+t.col*s.tileSize,y:s.board.y+t.row*s.tileSize,w:s.tileSize,h:s.tileSize};
   if(Math.abs(p.x-r.x-r.w/2)>r.w/2+C.footRadius||
      Math.abs(p.y-r.y-r.h/2)>r.h/2+C.footRadius)continue;
   area+=circleRectArea(p.x,p.y,C.footRadius,r);
 }
 return clamp(area/(Math.PI*C.footRadius**2),0,1);
}
function inputVector(p,s){
 if(p.isBot){
   const t=tileAt(s,p.x,p.y);
   // React to meaningful foot overlap, not merely the centre tile.
   if(!t||calculateDangerContact(s,p,new Set(s.danger))<C.blastThreshold)return {x:0,y:0};
   if(p.shockBotWave!==s.wave){
     p.shockBotWave=s.wave;p.shockBotReadyAt=s.clock+.18+
       random(s)*Math.min(1.7,s.warningDuration*.83);
   }
   if(s.clock<p.shockBotReadyAt)return {x:0,y:0};
   const safe=s.tiles.filter(t=>t.state==='safe');
   if(!safe.length)return {x:0,y:0};
   safe.sort((a,b)=>{const aa=tileCenter(s,a),bb=tileCenter(s,b);
     return Math.hypot(p.x-aa.x,p.y-aa.y)-Math.hypot(p.x-bb.x,p.y-bb.y);});
   const c=tileCenter(s,safe[0]),dx=c.x-p.x,dy=c.y-p.y,d=Math.hypot(dx,dy);
   return d<4?{x:0,y:0}:{x:dx/d,y:dy/d};
 }
 const keys=p.input||{};
 let x=Number.isFinite(keys.axisX)?keys.axisX:Number(!!keys.right)-Number(!!keys.left);
 let y=Number.isFinite(keys.axisY)?keys.axisY:Number(!!keys.down)-Number(!!keys.jump);
 const d=Math.hypot(x,y);
 if(d>1){x/=d;y/=d;}
 return {x,y};
}
function resolvePlayerCollision(s,ps){
 const all=living(ps).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const b=s.board,r=C.footRadius;
 for(let pass=0;pass<8;pass++)for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const a=all[i],c=all[j];let dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy);
   if(d>=2*C.bodyRadius)continue;
   if(d<.0001){const angle=(i*17+j*29+1)*1.618;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const move=Math.min(3.5,(2*C.bodyRadius-d)/2),nx=dx/d,ny=dy/d;
   a.x=clamp(a.x-nx*move,b.x+r,b.x+b.w-r);
   a.y=clamp(a.y-ny*move,b.y+r,b.y+b.h-r);
   c.x=clamp(c.x+nx*move,b.x+r,b.x+b.w-r);
   c.y=clamp(c.y+ny*move,b.y+r,b.y+b.h-r);
 }
}
function movePlayers(dt,s,ps){
 const b=s.board,foot=C.footRadius;
 for(const p of living(ps)){
   const v=inputVector(p,s),speed=p.isBot?C.speed*.88:C.speed;
   p.vx=v.x*speed;p.vy=v.y*speed;
   if(Math.hypot(v.x,v.y)>.1)p.dir={x:v.x,y:v.y};
   p.x=clamp(p.x+p.vx*dt,b.x+foot,b.x+b.w-foot);
   p.y=clamp(p.y+p.vy*dt,b.y+foot,b.y+b.h-foot);
 }
 resolvePlayerCollision(s,ps);
}
function distanceBias(w){return w<=3?.10:w<=6?.25:w<=9?.45:w<=12?.60:.75;}
function calculateDangerWeights(s,ps){
 const alive=living(ps),tiles=s.tiles.filter(t=>t.state==='safe'),bias=distanceBias(s.wave);
 const distances=tiles.map(t=>{const c=tileCenter(s,t);
   return alive.length?Math.min(...alive.map(p=>Math.hypot(c.x-p.x,c.y-p.y))):0;});
 const maximum=Math.max(1,...distances);
 return tiles.map((t,i)=>({id:t.id,distance:distances[i],weight:1+3*bias*distances[i]/maximum}));
}
function warningSeconds(w){return w<=3?2.5:w<=6?2.1:w<=9?1.6:w<=12?1.3:1.1;}
function intervalSeconds(w){return w<=3?1:w<=6?.85:w<=9?.65:w<=12?.5:.4;}
function dangerCount(s){
 const w=s.wave,ratio=w<=2?.12:w<=4?.18:w<=6?.24:w<=9?.3:w<=12?.42:
   w<=17?.55:Math.min(.92,.58+(w-17)*.025);
 return clamp(Math.round(25*(s.suddenDeath?Math.max(.62,ratio):ratio)),2,24);
}
function validateSafeRoutes(s,ps,danger,duration){
 const selected=new Set(danger),safes=s.tiles.filter(t=>!selected.has(t.id));
 if(!safes.length)return false;
 // There are no holes. Travel may cross a warning tile before it explodes.
 for(const p of living(ps)){
   if(calculateDangerContact(s,p,selected)<C.blastThreshold)continue;
   const hasEscape=safes.some(t=>{
     const x=s.board.x+t.col*s.tileSize,y=s.board.y+t.row*s.tileSize;
     const targetX=clamp(p.x,x+C.footRadius,x+s.tileSize-C.footRadius);
     const targetY=clamp(p.y,y+C.footRadius,y+s.tileSize-C.footRadius);
     return Math.hypot(targetX-p.x,targetY-p.y)<=
       C.speed*duration*.88+C.footRadius;
   });
   if(!hasEscape)return false;
 }
 return true;
}
function weightedDraw(s,bag){
 let roll=random(s)*bag.reduce((n,x)=>n+x.weight,0);
 for(const tile of bag){roll-=tile.weight;if(roll<=0)return tile;}
 return bag[bag.length-1];
}
function selectDangerTiles(s,ps){
 const count=dangerCount(s),warning=warningSeconds(s.wave);
 for(let size=count;size>=1;size--)for(let attempt=0;attempt<85;attempt++){
   const bag=calculateDangerWeights(s,ps),selected=[];
   while(selected.length<size&&bag.length){
     const pick=weightedDraw(s,bag);selected.push(pick.id);
     bag.splice(bag.findIndex(x=>x.id===pick.id),1);
   }
   if(validateSafeRoutes(s,ps,selected,warning))return selected;
 }
 return [];
}
function startTiebreaker(s,ps,ids){
 const eligible=new Set(ids);
 const contenders=ps.filter(p=>p.active&&eligible.has(p.id));
 if(contenders.length===1){s.winnerId=contenders[0].id;s.finished=true;return;}
 if(!contenders.length){s.finished=true;return;}
 s.tiebreakers++;s.roundId++;s.wave=0;s.fastPhase=false;s.suddenDeath=false;
 s.finalArena=true;s.pendingTiebreaker=null;s.danger=[];s.warningStarted=false;
 s.phase='NEXT_WAVE';s.timer=.65;
 // Never resurrect anyone eliminated before the last simultaneous wipe.
 ps.forEach(p=>{p.shockAlive=eligible.has(p.id)&&p.active;});
 createGrid(s);spawnPlayers(s,contenders);
}
function checkWinner(s,ps){
 const alive=living(ps);
 if(alive.length===1){s.winnerId=alive[0].id;s.finished=true;return true;}
 if(alive.length===0){if(!s.pendingTiebreaker)s.finished=true;return s.finished;}
 if(s.wave>=12&&alive.length>1)s.finalArena=true;
 return false;
}
function evaluateEliminations(s,ps,hit){
 const victims=new Set(hit.filter(p=>p.shockAlive).map(p=>p.id));
 if(!victims.size)return [];
 const before=living(ps);
 s.eliminationEvent++;
 for(const p of before)if(victims.has(p.id)){
   p.shockAlive=false;p.shockFall=.001;p.vx=0;p.vy=0;
   p.shockEliminatedWave=s.wave;p.shockEliminatedAt=s.eliminationEvent;
 }
 const ids=[...victims];
 s.events.push({event:s.eliminationEvent,wave:s.wave,ids});
 if(ids.length===before.length)s.pendingTiebreaker=ids;
 else checkWinner(s,ps);
 return ids;
}
function startWarning(s,ps){
 const chosen=selectDangerTiles(s,ps);
 if(!chosen.length){startTiebreaker(s,ps,living(ps).map(p=>p.id));return;}
 s.danger=chosen;s.warningDuration=warningSeconds(s.wave);
 for(const id of chosen){const t=s.tiles[id];t.state='warning';t.wave=s.wave;}
 s.warningStarted=true;s.phase='WARNING';s.timer=s.warningDuration;
}
function checkSuddenDeath(s){s.remainingTiles=25;s.suddenDeath=s.wave>=10;return s.suddenDeath;}
function startWave(s,ps){
 if(checkWinner(s,ps))return;
 s.wave++;s.fastPhase=s.wave>=7;checkSuddenDeath(s);
 s.phase='PREPARE';s.timer=.08;s.danger=[];s.warningStarted=false;
}
function triggerExplosion(s,ps){
 if(s.phase!=='WARNING'||!s.warningStarted)return;
 for(const id of s.danger){
   const t=s.tiles[id];
   if(!t||t.state!=='warning'||t.wave!==s.wave)
     throw Error('SHOCKWAVE must never explode an unwarned tile');
 }
 const chosen=new Set(s.danger);
 // Snapshot hits all alive players at one moment, before visual changes.
 const hit=living(ps).filter(p=>calculateDangerContact(s,p,chosen)>=C.blastThreshold);
 for(const id of chosen){
   const tile=s.tiles[id];tile.state='exploding';
   const c=tileCenter(s,tile);s.effects.push({x:c.x,y:c.y,life:.55});
 }
 if(hit.length)evaluateEliminations(s,ps,hit);
 s.phase='EXPLOSION';s.timer=s.fastPhase?.24:.35;
}
function collapseTiles(s){
 // Old public name retained for compatibility: restore, NEVER destroy.
 for(const id of s.danger)if(s.tiles[id].state==='exploding')s.tiles[id].state='safe';
 s.remainingTiles=25;s.danger=[];s.warningStarted=false;
}
function step(dt,round,ps){
 const s=round.shockwave;
 if(s.finished)return;
 s.clock+=dt;
 if(round.phase==='countdown'){movePlayers(dt,s,ps);return;}
 if(round.phase!=='playing')return;
 for(const p of ps)if(p.shockFall>0)p.shockFall+=dt;
 for(const e of s.effects)e.life-=dt;
 s.effects=s.effects.filter(e=>e.life>0).slice(-32);
 if(['PREPARE','WARNING','NEXT_WAVE'].includes(s.phase))movePlayers(dt,s,ps);
 if(s.phase==='PREPARE'){
   s.timer-=dt;if(s.timer<=0)startWarning(s,ps);
 }else if(s.phase==='WARNING'){
   s.timer-=dt;round.remaining=Math.max(0,s.timer);
   if(s.timer<=0)triggerExplosion(s,ps);
 }else if(s.phase==='EXPLOSION'){
   s.timer-=dt;
   if(s.timer<=0){
     collapseTiles(s);
     if(s.pendingTiebreaker){
       const ids=s.pendingTiebreaker;s.pendingTiebreaker=null;startTiebreaker(s,ps,ids);
     }else s.phase='CHECK';
   }
 }else if(s.phase==='CHECK'){
   checkWinner(s,ps);
   if(!s.finished){s.phase='NEXT_WAVE';s.timer=intervalSeconds(s.wave);}
 }else if(s.phase==='NEXT_WAVE'){
   s.timer-=dt;if(s.timer<=0)startWave(s,ps);
 }
 if(s.phase!=='WARNING')round.remaining=null;
}
function update(dt,round,ps){
 const s=round.shockwave;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused)return null;
 if(round.phase==='playing'&&s.wave===0&&s.phase==='PREPARE')startWave(s,ps);
 s.accumulator=Math.min(.25,s.accumulator+clamp(dt,0,.25));
 let n=0;
 while(s.accumulator>=FIXED&&n++<15&&!s.finished){
   step(FIXED,round,ps);s.accumulator-=FIXED;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){const s=round.shockwave;
 return {survivors:living(ps).length,wave:s?.wave||0,
   phase:s?.phase,remaining:s?.phase==='WARNING'?Math.max(0,s.timer):null};}
function drawPlayer(ctx,p,s){
 if(!p.active)return;
 if(!p.shockAlive&&!(p.shockFall>0&&p.shockFall<.65))return;
 const opacity=p.shockAlive?1:Math.max(0,1-p.shockFall/.65);
 window.PartyPlayerAvatar.draw(ctx,p,{time:s.clock,alpha:opacity,
   scale:p.shockAlive?1:.3+.7*opacity});
 if(p.shockAlive){
   // This ring is the exact contact footprint tested at the explosion snapshot.
   const inDanger=s.phase==='WARNING'&&
     calculateDangerContact(s,p,new Set(s.danger))>=C.blastThreshold;
   ctx.save();ctx.strokeStyle=inDanger?'#ffe8a6':'#d5f7e9';ctx.lineWidth=1.8;
   ctx.beginPath();ctx.arc(p.x,p.y,C.footRadius,0,TAU);ctx.stroke();
   ctx.fillStyle=inDanger?'#ffca72':'#fff';
   ctx.beginPath();ctx.arc(p.x,p.y,2.9,0,TAU);ctx.fill();ctx.restore();
 }
}
function drawTile(ctx,s,t){
 const z=s.tileSize,x=s.board.x+t.col*z,y=s.board.y+t.row*z;
 const warning=t.state==='warning',blast=t.state==='exploding';
 const frac=s.warningDuration?1-clamp(s.timer/s.warningDuration,0,1):0;
 const flash=warning&&Math.sin(s.clock*(8+frac*32))>0;
 ctx.fillStyle='#48352d';ctx.fillRect(x,y+3,z,z-3);
 ctx.fillStyle=blast?'#fff0a3':warning?(flash?'#f48443':'#b34735'):'#9d8557';
 ctx.fillRect(x+2,y+2,z-4,z-5);
 // Bevelled stone edge and an inset carved tile, matching the lava temple.
 ctx.fillStyle=warning||blast?'#ffd890':'#dac38a';ctx.fillRect(x+3,y+3,z-6,5);
 ctx.fillStyle=warning||blast?'#a64c32':'#6e583e';ctx.fillRect(x+3,y+z-8,z-6,5);
 ctx.strokeStyle=warning?'#ffe69b':blast?'#fffbe1':'#dac38a';
 ctx.lineWidth=warning||blast?3:1.4;ctx.strokeRect(x+9,y+9,z-18,z-18);
 ctx.fillStyle=blast?'#f9973c':warning?'#ffda7b':'#746040';
 const cx=x+z/2,cy=y+z/2;
 // A skull motif is subdued on safe stone; warning adds pulsing orange,
 // a bright frame, and an exclamation mark so danger is not color alone.
 ctx.beginPath();ctx.ellipse(cx,cy-3,12,11,0,0,TAU);ctx.fill();
 ctx.fillRect(cx-8,cy+2,16,12);
 ctx.fillStyle=warning||blast?'#9c4430':'#9d8557';
 ctx.beginPath();ctx.arc(cx-5,cy-3,3,0,TAU);ctx.arc(cx+5,cy-3,3,0,TAU);ctx.fill();
 ctx.fillRect(cx-1,cy+8,2,6);
 if(warning||blast){
   ctx.fillStyle='#fff4ce';ctx.font='900 15px sans-serif';ctx.textAlign='center';
   ctx.fillText(blast?'✦':'!',x+z-17,y+23);
   ctx.fillRect(x+13,y+z-17,z-26,3);
 }

}
function draw(ctx,time,round,ps){
 const s=round.shockwave;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 window.PartyArenaArt.draw(ctx,'lava',s);
 for(const tile of s.tiles)drawTile(ctx,s,tile);
 for(const p of ps)if(p.active&&p.shockAlive)drawPlayer(ctx,p,s);
 for(const e of s.effects){
   ctx.save();ctx.globalAlpha=clamp(e.life*2,0,1);ctx.strokeStyle='#ffe3a8';
   ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,(.55-e.life)*65+5,0,TAU);ctx.stroke();
   ctx.fillStyle='#ffc074';
   for(let i=0;i<5;i++){const angle=i*TAU/5,delta=(.55-e.life)*62;
     ctx.fillRect(e.x+Math.cos(angle)*delta-2,e.y+Math.sin(angle)*delta-2,4,4);}
   ctx.restore();
 }
 for(const p of ps)if(!p.shockAlive)drawPlayer(ctx,p,s);
 ctx.fillStyle='#3a2c2bee';ctx.fillRect(16,13,263,76);
 ctx.strokeStyle='#d2a66a';ctx.lineWidth=1.5;ctx.strokeRect(16,13,263,76);
 ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';
 ctx.fillText('SHOCKWAVE',27,37);
 const description=round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown)+' วิ':
   s.phase==='WARNING'?'WAVE '+s.wave+' • ระเบิดใน '+Math.max(0,s.timer).toFixed(1)+' วิ':
   s.phase==='EXPLOSION'?'WAVE '+s.wave+' • ระเบิด!':
   'WAVE '+s.wave+(s.fastPhase?' • FAST':'');
 ctx.font='bold 13px sans-serif';ctx.fillStyle='#ffdda0';ctx.fillText(description,27,59);
 ctx.fillStyle='#b1f1ca';ctx.fillText('ผู้รอด '+living(ps).length+' คน • สนาม 5×5',27,79);
 if(s.fastPhase&&!s.finished){
   ctx.fillStyle='#d86842';ctx.fillRect(796,16,141,29);
   ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 14px sans-serif';
   ctx.fillText('FAST PHASE',866,36);
 }
 if((s.finalArena||s.suddenDeath)&&!s.finished){
   ctx.fillStyle='#f9d49d';ctx.textAlign='center';ctx.font='bold 14px sans-serif';
   ctx.fillText(s.finalArena?'FINAL ARENA':'SUDDEN DEATH',480,95);
 }
 ctx.restore();
}
window.Shockwave=Object.freeze({setup,update,draw,hud,createGrid,spawnPlayers,
 calculateDangerContact,calculateFootSupport,resolvePlayerCollision,calculateDangerWeights,
 selectDangerTiles,validateSafeRoutes,warningSeconds,intervalSeconds,distanceBias,
 startWarning,startWave,triggerExplosion,collapseTiles,evaluateEliminations,
 startTiebreaker,checkWinner,checkSuddenDeath,constants:C});
})();
