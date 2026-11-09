/* SHOCKWAVE: host-authoritative 5x5 blast-dodge survival.
   All tiles remain solid. Only players overlapping a warned explosion are removed. */
(() => {
'use strict';
const TAU=Math.PI*2, FIXED=1/60;
const C=Object.freeze({speed:177,bodyRadius:13,footRadius:11,avatarRadius:29,maxPlayers:12});
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
  winnerId:null,winnerIds:[],pendingWinnerIds:null,finished:false,fastPhase:false,suddenDeath:false,finalArena:false,
  events:[],effects:[],eliminationEvent:0,blastSchedule:[],blastCursor:0,blastElapsed:0,blastDuration:0,
  startCount:ps.length,plannedWarningDuration:0,plannedDangerCount:0,lastSafeTileId:null};
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
// Top-down player art is drawn in a 52x52 box (including arms, hats and
// fox ears). This conservative 29px circle encloses all visible body parts;
// labels are not part of the body. Use EXACT circle/rectangle intersection:
// no percentage threshold and no numerical area approximation at tiny edges.
function touchesTile(s,p,t){
 const x=s.board.x+t.col*s.tileSize,y=s.board.y+t.row*s.tileSize;
 const dx=p.x-clamp(p.x,x,x+s.tileSize);
 const dy=p.y-clamp(p.y,y,y+s.tileSize);
 return dx*dx+dy*dy<=C.avatarRadius*C.avatarRadius;
}
function calculateDangerContact(s,p,dangerIds){
 const selected=dangerIds instanceof Set?dangerIds:new Set(dangerIds);
 for(const id of selected){
   const tile=s.tiles[id];
   if(tile&&touchesTile(s,p,tile))return 1;
 }
 return 0;
}
function inputVector(p,s){
 if(p.isBot){
   const t=tileAt(s,p.x,p.y);
   // During a rolling blast, already-exploded tiles no longer threaten bots.
   const pending=s.phase==='EXPLOSION'?s.danger.filter(id=>s.tiles[id].state==='warning'):s.danger;
   if(!t||calculateDangerContact(s,p,pending)===0)return {x:0,y:0};
   if(p.shockBotWave!==s.wave){
     p.shockBotWave=s.wave;p.shockBotReadyAt=s.clock+.18+
       random(s)*Math.min(1.7,s.warningDuration*.83);
   }
   if(s.clock<p.shockBotReadyAt)return {x:0,y:0};
   const safe=s.tiles.filter(t=>t.state==='safe'||t.state==='exploding');
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
 return window.PartyCharacters.resolve(ps,{
   filter:p=>p.active&&p.shockAlive,
   radius:C.bodyRadius,iterations:8,maxShift:3.5,
   boundaryRadius:C.avatarRadius,bounds:s.board,pressure:false
 });
}
function movePlayers(dt,s,ps){
 const b=s.board,foot=C.avatarRadius;
 for(const p of living(ps)){
   const v=inputVector(p,s),speed=p.isBot?C.speed*.88:C.speed;
   p.vx=v.x*speed;p.vy=v.y*speed;
   if(Math.hypot(v.x,v.y)>.1)p.dir={x:v.x,y:v.y};
   p.x=clamp(p.x+p.vx*dt,b.x+foot,b.x+b.w-foot);
   p.y=clamp(p.y+p.vy*dt,b.y+foot,b.y+b.h-foot);
 }
 resolvePlayerCollision(s,ps);
}
function distanceBias(w){
 // Late waves increase distance influence without making nearby tiles immune.
 return w<=3?.10:w<=6?.25:w<=9?.45:w<=10?.60:
   Math.min(.94,.65+(w-10)*.06);
}
function calculateDangerWeights(s,ps){
 const alive=living(ps),tiles=s.tiles.filter(t=>t.state==='safe'),bias=distanceBias(s.wave);
 const distances=tiles.map(t=>{const c=tileCenter(s,t);
   return alive.length?Math.min(...alive.map(p=>Math.hypot(c.x-p.x,c.y-p.y))):0;});
 const maximum=Math.max(1,...distances);
 return tiles.map((t,i)=>({id:t.id,distance:distances[i],
   weight:1+8*bias*Math.pow(distances[i]/maximum,1.5)}));
}
// Compact and fast: only the escape validator may extend individual warnings.
function warningSeconds(w){return w<=3?1.45:w<=6?1.15:w<=9?.95:w<=11?.75:.65;}
function intervalSeconds(w){return w<=3?.45:w<=6?.30:w<=9?.19:w<=11?.12:.10;}
// Fixed safe tiles per wave on the 5x5 arena: 14, 7, 5, 2, then 1
// forever from wave 5 onward. The existing warning and inter-wave timing
// still speeds up with later waves, including the adaptive escape guard.
// Every floor tile remains solid and resets after each explosion.
function dangerCount(s){
 const dangerByWave=[0,11,18,20,23,24];
 return dangerByWave[Math.min(Math.max(1,s.wave),5)];
}
function requiredEscapeSeconds(s,ps,danger){
 const selected=danger instanceof Set?danger:new Set(danger);
 const safe=s.tiles.filter(t=>t.state==='safe'&&!selected.has(t.id));
 if(!safe.length)return Infinity;
 let longest=0;
 for(const p of living(ps)){
   if(calculateDangerContact(s,p,selected)===0)continue;
   // Warning has continuous walkable floor. Check the nearest fully safe
   // interior square, accounting for the real footprint diameter.
   const distance=Math.min(...safe.map(t=>{
     const x=s.board.x+t.col*s.tileSize,y=s.board.y+t.row*s.tileSize;
     const inset=C.avatarRadius;
     return Math.hypot(
       clamp(p.x,x+inset,x+s.tileSize-inset)-p.x,
       clamp(p.y,y+inset,y+s.tileSize-inset)-p.y);
   }));
   longest=Math.max(longest,distance/(C.speed*.84)+.12);
 }
 return longest;
}
function validateSafeRoutes(s,ps,danger,duration){
 return requiredEscapeSeconds(s,ps,danger)<=duration+1e-8;
}
function weightedDraw(s,bag){
 let roll=random(s)*bag.reduce((n,x)=>n+x.weight,0);
 for(const tile of bag){roll-=tile.weight;if(roll<=0)return tile;}
 return bag[bag.length-1];
}
function selectDangerTiles(s,ps){
 const target=dangerCount(s),base=warningSeconds(s.wave);
 let best=null;
 // Exact hazard count: extend the warning for distant escapes instead of
 // quietly reverting to a handful of red tiles during Sudden Death.
 for(let attempt=0;attempt<100;attempt++){
   const bag=calculateDangerWeights(s,ps),selected=[];
   while(selected.length<target&&bag.length){
     const picked=weightedDraw(s,bag);
     selected.push(picked.id);
     bag.splice(bag.findIndex(t=>t.id===picked.id),1);
   }
   const safeId=target===24?s.tiles.find(tile=>!selected.includes(tile.id))?.id:null;
   // On one-safe-tile waves, force the shelter to move between waves
   // instead of allowing everyone to camp forever in one tile.
   if(target===24&&safeId===s.lastSafeTileId)continue;
   const required=requiredEscapeSeconds(s,ps,selected);
   if(!Number.isFinite(required))continue;
   const duration=Math.max(base,required);
   if(!best||duration<best.duration)best={tiles:selected,duration};
   if(required<=base)break;
 }
 if(!best)return [];
 s.plannedWarningDuration=best.duration;
 s.plannedDangerCount=best.tiles.length;
 return best.tiles;
}
function checkWinner(s,ps){
 const alive=living(ps);
 if(alive.length===1){
   s.winnerId=alive[0].id;s.winnerIds=[alive[0].id];
   s.finished=true;return true;
 }
 if(alive.length===0){
   // An all-player explosion finishes AFTER its visual effect.
   if(s.pendingWinnerIds?.length)return false;
   s.finished=true;return true;
 }
 if(s.wave>=12)s.finalArena=true;
 return false;
}
function evaluateEliminations(s,ps,hit,tileId=null,blastAt=null){
 // Snapshot everybody alive before recording any elimination.
 const before=living(ps);
 const idsInHit=new Set(hit.filter(p=>p.active&&p.shockAlive).map(p=>p.id));
 const victims=before.filter(p=>idsInHit.has(p.id));
 if(!victims.length)return [];
 ++s.eliminationEvent;
 const ids=victims.map(p=>p.id);
 for(const p of victims){
   p.shockAlive=false;p.shockFall=.001;p.vx=0;p.vy=0;
   p.shockEliminatedWave=s.wave;p.shockEliminatedAt=s.eliminationEvent;
 }
 s.events.push({event:s.eliminationEvent,wave:s.wave,ids:[...ids],tileId,blastAt});
 if(victims.length===before.length){
   // Everyone still alive shares first place, never replay for a tiebreaker.
   s.pendingWinnerIds=[...ids];s.winnerId=null;s.winnerIds=[];
 }else if(s.phase!=='EXPLOSION')checkWinner(s,ps);
 return ids;
}
function startWarning(s,ps){
 const chosen=selectDangerTiles(s,ps);
 if(!chosen.length){s.phase='NEXT_WAVE';s.timer=intervalSeconds(s.wave);return;}
 s.danger=chosen;
 s.warningDuration=Math.max(warningSeconds(s.wave),s.plannedWarningDuration||0);
 s.lastSafeTileId=chosen.length===24?s.tiles.find(tile=>!chosen.includes(tile.id))?.id??null:null;
 for(const id of chosen){const t=s.tiles[id];t.state='warning';t.wave=s.wave;}
 s.warningStarted=true;s.phase='WARNING';s.timer=s.warningDuration;
}
function checkSuddenDeath(s){s.remainingTiles=25;s.suddenDeath=s.wave>=10;return s.suddenDeath;}
function startWave(s,ps){
 if(checkWinner(s,ps))return;
 s.wave++;s.fastPhase=s.wave>=7;checkSuddenDeath(s);
 s.phase='PREPARE';s.timer=.025;s.danger=[];s.warningStarted=false;
 s.blastSchedule=[];s.blastCursor=0;s.blastElapsed=0;s.blastDuration=0;
 s.plannedWarningDuration=0;s.plannedDangerCount=0;
}
// Each selected danger tile has a distinct ignition timestamp, within 0.8s.
// Distance is measured in square rings from the board's outside inward.
// The first danger tile ignites at t=0; gaps vary rather than synchronizing.
function buildBlastSchedule(s,chosen=s.danger){
 const ordered=[],rings=new Map();
 for(const id of chosen){
   const tile=s.tiles[id];
   if(!tile)throw Error('Shockwave blast has an unknown tile');
   const ring=Math.max(Math.abs(tile.col-2),Math.abs(tile.row-2));
   if(!rings.has(ring))rings.set(ring,[]);
   rings.get(ring).push(id);
 }
 for(const ring of [...rings.keys()].sort((a,b)=>b-a)){
   const group=[...rings.get(ring)];
   for(let i=group.length-1;i>0;i--){
     const j=Math.floor(random(s)*(i+1));
     [group[i],group[j]]=[group[j],group[i]];
   }
   ordered.push(...group);
 }
 if(ordered.length===0)return [];
 if(ordered.length===1)return [{id:ordered[0],at:0}];
 const total=.64+random(s)*.15; // Last tile ignites before 0.8 seconds.
 const gaps=Array.from({length:ordered.length-1},()=>.25+random(s)*.75);
 const sum=gaps.reduce((a,b)=>a+b,0);
 let time=0;
 return ordered.map((id,index)=>{
   const at=index===ordered.length-1?total:time;
   if(index<gaps.length)time+=gaps[index]/sum*total;
   return {id,at};
 });
}
function igniteScheduledTiles(s,ps){
 while(s.blastCursor<s.blastSchedule.length&&
   s.blastSchedule[s.blastCursor].at<=s.blastElapsed+1e-9){
   const event=s.blastSchedule[s.blastCursor++];
   const tile=s.tiles[event.id];
   if(tile?.state!=='warning'||tile.wave!==s.wave)
     throw Error('SHOCKWAVE cannot explode a tile without a warning');
   tile.state='exploding';
   const c=tileCenter(s,tile);
   s.effects.push({x:c.x,y:c.y,life:.55});
   // Snapshot the feet/visible body at THIS tile's ignition time, not the
   // beginning or end of the cascade. Different tiles are different events.
   const hit=living(ps).filter(p=>calculateDangerContact(s,p,[event.id])>0);
   if(hit.length)evaluateEliminations(s,ps,hit,event.id,event.at);
 }
}
function triggerExplosion(s,ps){
 if(s.phase!=='WARNING'||!s.warningStarted)return;
 for(const id of s.danger){
   const t=s.tiles[id];
   if(!t||t.state!=='warning'||t.wave!==s.wave)
     throw Error('SHOCKWAVE must never explode an unwarned tile');
 }
 s.blastSchedule=buildBlastSchedule(s);
 s.blastCursor=0;s.blastElapsed=0;
 // The last ignition occurs before .8 seconds; allow a brief afterglow.
 s.blastDuration=(s.blastSchedule.at(-1)?.at||0)+.18;
 s.phase='EXPLOSION';s.timer=s.blastDuration;
 igniteScheduledTiles(s,ps);
}
function collapseTiles(s){
 // Old public name retained for compatibility: restore, NEVER destroy.
 for(const id of s.danger)if(s.tiles[id].state==='exploding'||s.tiles[id].state==='warning')s.tiles[id].state='safe';
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
 if(['PREPARE','WARNING','NEXT_WAVE','EXPLOSION'].includes(s.phase))movePlayers(dt,s,ps);
 if(s.phase==='PREPARE'){
   s.timer-=dt;if(s.timer<=0)startWarning(s,ps);
 }else if(s.phase==='WARNING'){
   s.timer-=dt;round.remaining=Math.max(0,s.timer);
   if(s.timer<=0)triggerExplosion(s,ps);
 }else if(s.phase==='EXPLOSION'){
   s.blastElapsed+=dt;
   igniteScheduledTiles(s,ps);
   s.timer-=dt;
   if(s.timer<=0){
     // No round may conclude before all selected danger tiles actually fire.
     if(s.blastCursor!==s.blastSchedule.length)
       throw Error('SHOCKWAVE explosion sequence ended early');
     collapseTiles(s);
     if(s.pendingWinnerIds?.length){
       s.winnerIds=[...s.pendingWinnerIds];s.pendingWinnerIds=null;
       s.winnerId=s.winnerIds.length===1?s.winnerIds[0]:null;
       s.finished=true;s.phase='CHECK';
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
   // This ring encloses the entire character and is the explosion contact area.
   const inDanger=s.phase==='WARNING'&&
     calculateDangerContact(s,p,new Set(s.danger))>0;
   ctx.save();ctx.strokeStyle=inDanger?'#ffe8a6':'#d5f7e9';ctx.lineWidth=1.8;
   ctx.beginPath();ctx.arc(p.x,p.y,C.avatarRadius,0,TAU);ctx.stroke();
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
   if(blast)window.PartyUiArt.draw(ctx,'sparkle',x+z-17,y+18,14);
   else ctx.fillText('!',x+z-17,y+23);
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
 // No extra left, top-right or centre labels: tile warnings show danger;
 // the common SVG headcount badge is drawn by app.js.
 ctx.restore();
}
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const s=round.shockwave;
 const winners=s.winnerIds?.length?s.winnerIds:(s.winnerId?[s.winnerId]:[]);
 const value=winners.includes(p.id)?Infinity:(p.shockEliminatedAt||0);
 const label=winners.includes(p.id)?'ผู้รอดคนสุดท้าย':'ตกรอบ Wave '+(p.shockEliminatedWave||s.wave);
  return {id:p.id,value,label};
 });
}
window.Shockwave=Object.freeze({getResult,resultTitle:"ผู้รอดชีวิตคนสุดท้าย!",countdownSeconds:2,updateDuringCountdown:true,setup,update,draw,hud,createGrid,spawnPlayers,
 calculateDangerContact,calculateFootSupport,resolvePlayerCollision,calculateDangerWeights,
  dangerCount,requiredEscapeSeconds,
 selectDangerTiles,validateSafeRoutes,warningSeconds,intervalSeconds,distanceBias,
 startWarning,startWave,triggerExplosion,buildBlastSchedule,collapseTiles,evaluateEliminations,
 checkWinner,checkSuddenDeath,constants:C});
})();
