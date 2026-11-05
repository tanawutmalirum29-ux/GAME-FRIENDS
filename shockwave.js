/* SHOCKWAVE — host-authoritative survival. Controllers send inputs, never outcomes.
   Logical world: 960x540. All gameplay, including particles and waves, uses simulation time. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60;
const C=Object.freeze({speed:177,bodyRadius:13,footRadius:9,footThreshold:.5,maxPlayers:12});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const living=players=>players.filter(p=>p.active&&p.shockAlive);
function random(state){let x=state.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;state.seed=x||0x13579bdf;return (state.seed>>>0)/4294967296;}
function createGrid(state,count){
 state.big=count>6;state.cols=state.big?6:4;state.rows=state.big?5:4;
 state.tileSize=state.big?84:100;
 state.board={x:(960-state.cols*state.tileSize)/2,y:state.big?99:103,w:state.cols*state.tileSize,h:state.rows*state.tileSize};
 state.tiles=Array.from({length:state.cols*state.rows},(_,id)=>({id,col:id%state.cols,row:Math.floor(id/state.cols),state:'safe',wave:0,flash:0}));
 state.remainingTiles=state.tiles.length;state.initialTiles=state.tiles.length;
 return state.tiles;
}
function center(s,t){return {x:s.board.x+(t.col+.5)*s.tileSize,y:s.board.y+(t.row+.5)*s.tileSize};}
function tileAt(s,x,y){
 const col=Math.floor((x-s.board.x)/s.tileSize),row=Math.floor((y-s.board.y)/s.tileSize);
 return col<0||row<0||col>=s.cols||row>=s.rows?null:s.tiles[row*s.cols+col];
}
function neighbors(s,id){
 const t=s.tiles[id];if(!t)return [];
 return [[t.col-1,t.row],[t.col+1,t.row],[t.col,t.row-1],[t.col,t.row+1]]
   .filter(([x,y])=>x>=0&&y>=0&&x<s.cols&&y<s.rows)
   .map(([x,y])=>s.tiles[y*s.cols+x]);
}
function spawnPlayers(s,players){
 const choices=s.tiles.map(t=>t.id);
 for(let i=choices.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
 players.forEach((p,i)=>{
   const t=s.tiles[choices[i%choices.length]],pos=center(s,t);
   p.x=pos.x;p.y=pos.y;p.vx=0;p.vy=0;p.dir={x:0,y:1};
   p.shockAlive=!!p.active;p.shockFall=0;p.shockEliminatedAt=0;p.shockBotTarget=null;p.shockBotWave=-1;
 });
}
function setup(round,players){
 const state={phase:'PREPARE',timer:0,accumulator:0,clock:0,wave:0,danger:[],
   seed:((Number(round.shockSeed)||((Date.now()^0x6a53)|0))>>>0)||1,
   warningDuration:0,warningStarted:false,winnerId:null,finished:false,
   eliminationEvent:0,events:[],effects:[],tiebreakers:0,finalArena:false,
   startCount:players.length,roundId:0,fastPhase:false,suddenDeath:false};
 round.shockwave=state;round.remaining=null;
 for(const p of players){p.active=true;p.score=0;}
 createGrid(state,players.length);spawnPlayers(state,players);
 return state;
}
function inputVector(p,s){
 if(p.isBot){
   // Bots route one tile at a time, never run through destroyed bridges.
   const underfoot=tileAt(s,p.x,p.y);
   if(!underfoot||underfoot.state==='destroyed')return {x:0,y:0};
   const isThreatened=underfoot.state==='warning';
   if(!isThreatened){
     p.shockBotTarget=null;p.shockBotWave=-1;
     return {x:0,y:0};
   }
   if(p.shockBotWave!==s.wave){
     p.shockBotWave=s.wave;
     // Human-like reaction variance: bots can be outplayed, never get perfect dodges.
     p.shockBotReadyAt=s.clock+.2+random(s)*Math.min(1.9,s.warningDuration*.95);
   }
   if(s.clock<p.shockBotReadyAt)return {x:0,y:0};
   const reachable=new Set([underfoot.id]),queue=[{id:underfoot.id,first:null}];
   let goal=null;
   while(queue.length){
     const node=queue.shift(),tile=s.tiles[node.id];
     if(node.id!==underfoot.id&&tile.state==='safe'){goal=node.first||tile;break;}
     for(const n of neighbors(s,node.id)){
       if(n.state==='destroyed'||n.state==='exploding'||reachable.has(n.id))continue;
       reachable.add(n.id);queue.push({id:n.id,first:node.first||n});
     }
   }
   if(!goal)return {x:0,y:0};
   const c=center(s,goal),dx=c.x-p.x,dy=c.y-p.y,d=Math.hypot(dx,dy);
   return d<4?{x:0,y:0}:{x:dx/d,y:dy/d};
 }
 const input=p.input||{};
 let x=Number.isFinite(input.axisX)?input.axisX:Number(!!input.right)-Number(!!input.left);
 let y=Number.isFinite(input.axisY)?input.axisY:Number(!!input.down)-Number(!!input.jump);
 const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}
 return {x,y};
}
// Foot area is evaluated independently from the character sprite. The tile
// collision grid is seamless; the 2px rendered seams are cosmetic only.
function circleRectArea(cx,cy,r,rect){
 const left=Math.max(cx-r,rect.x),right=Math.min(cx+r,rect.x+rect.w);
 if(right<=left)return 0;
 const n=24,h=(right-left)/n;
 const f=x=>{
   const half=Math.sqrt(Math.max(0,r*r-(x-cx)*(x-cx)));
   return Math.max(0,Math.min(cy+half,rect.y+rect.h)-Math.max(cy-half,rect.y));
 };
 let sum=f(left)+f(right);
 for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(left+i*h);
 return Math.max(0,sum*h/3);
}
function calculateFootSupport(s,p,removed=null){
 const r=C.footRadius,area=Math.PI*r*r;
 let supported=0;
 for(const t of s.tiles){
   if(t.state==='destroyed'||t.state==='exploding'||removed?.has(t.id))continue;
   const x=s.board.x+t.col*s.tileSize,y=s.board.y+t.row*s.tileSize;
   if(p.x+r<x||p.x-r>x+s.tileSize||p.y+r<y||p.y-r>y+s.tileSize)continue;
   // Fast path for a foot circle entirely inside one tile.
   if(p.x-r>=x&&p.x+r<=x+s.tileSize&&p.y-r>=y&&p.y+r<=y+s.tileSize)return 1;
   supported+=circleRectArea(p.x,p.y,r,{x,y,w:s.tileSize,h:s.tileSize});
 }
 return clamp(supported/area,0,1);
}
function movePlayers(dt,s,players){
 const alive=living(players);
 for(const p of alive){
   const v=inputVector(p,s),speed=p.isBot?C.speed*.88:C.speed;
   p.vx=v.x*speed;p.vy=v.y*speed;
   if(Math.hypot(v.x,v.y)>.1)p.dir={x:v.x,y:v.y};
   const segments=Math.max(1,Math.ceil(speed*dt/(C.footRadius*.65)));
   for(let i=0;i<segments;i++){
     p.x+=p.vx*dt/segments;p.y+=p.vy*dt/segments;
     // Do not apply wall clamps: walking off the arena is a real fall.
     if(s.phase==='PREPARE'&&s.wave===0){
       p.x=clamp(p.x,s.board.x+C.footRadius,s.board.x+s.board.w-C.footRadius);
       p.y=clamp(p.y,s.board.y+C.footRadius,s.board.y+s.board.h-C.footRadius);
     }else if(calculateFootSupport(s,p)<C.footThreshold)break;
   }
 }
 resolvePlayerCollision(s,players);
 if(s.wave>0){
   const fall=alive.filter(p=>calculateFootSupport(s,p)<C.footThreshold);
   if(fall.length)evaluateEliminations(s,players,fall);
 }
}
function resolvePlayerCollision(s,players){
 const ps=living(players).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 for(let pass=0;pass<8;pass++)for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
   const a=ps[i],b=ps[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>=C.bodyRadius*2)continue;
   if(d<1e-5){const angle=((i+1)*37+(j+1)*71)*2.4;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const push=Math.min(3.5,(C.bodyRadius*2-d)/2),nx=dx/d,ny=dy/d;
   a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
 }
}
function distanceBias(wave){return wave<=3?.10:wave<=6?.25:wave<=9?.45:wave<=12?.60:.75;}
function calculateDangerWeights(s,players){
 const alive=living(players);
 const alpha=distanceBias(s.wave);
 const options=s.tiles.filter(t=>t.state==='safe');
 const distances=options.map(t=>{
   const c=center(s,t);
   return alive.length?Math.min(...alive.map(p=>Math.hypot(c.x-p.x,c.y-p.y))):0;
 });
 const max=Math.max(1,...distances);
 return options.map((t,i)=>({id:t.id,weight:1+alpha*3*distances[i]/max,distance:distances[i]}));
}
function warningSeconds(wave,big){
 const i=wave<=3?0:wave<=6?1:wave<=9?2:wave<=12?3:4;
 return (big?[3,2.5,2,1.7,1.4]:[2.5,2.1,1.6,1.3,1.1])[i];
}
function intervalSeconds(wave,big){
 const v=wave<=3?1:wave<=6?.85:wave<=9?.65:wave<=12?.5:.4;
 return big&&wave<=3?v+.1:v;
}
function dangerCount(s){
 const total=s.tiles.filter(t=>t.state==='safe').length;
 const ratio=s.suddenDeath?.55:s.wave<=2?.125:s.wave<=4?.18:s.wave<=6?.23:s.wave<=9?.30:s.wave<=12?.35:.40;
 return clamp(Math.round(total*ratio),1,Math.max(1,total-1));
}
function validateSafeRoutes(s,players,danger,duration){
 const removed=new Set(danger),solid=s.tiles.filter(t=>t.state!=='destroyed'&&t.state!=='exploding');
 const safe=solid.filter(t=>!removed.has(t.id));
 if(!safe.length)return false;
 for(const p of living(players)){
   const start=tileAt(s,p.x,p.y);
   if(!start||start.state==='destroyed')return false;
   // An already supported, non-threatening position does not require escape.
   if(calculateFootSupport(s,p,removed)>=C.footThreshold)continue;
   const visited=new Set([start.id]),queue=[{id:start.id,cost:0}];
   let possible=false;
   while(queue.length){
     const {id,cost}=queue.shift();
     if(!removed.has(id)&&solid.some(t=>t.id===id)&&cost<=C.speed*duration*.94){possible=true;break;}
     for(const t of neighbors(s,id)){
       if(t.state==='destroyed'||t.state==='exploding'||visited.has(t.id))continue;
       const next=cost+s.tileSize;
       if(next<=C.speed*duration*.94+s.tileSize*.3){visited.add(t.id);queue.push({id:t.id,cost:next});}
     }
   }
   if(!possible)return false;
 }
 return true;
}
function weightedDraw(s,items){
 const total=items.reduce((n,t)=>n+t.weight,0);
 let pick=random(s)*total;
 for(const t of items){pick-=t.weight;if(pick<=0)return t;}
 return items[items.length-1];
}
function selectDangerTiles(s,players){
 let available=s.tiles.filter(t=>t.state==='safe').length;
 if(available<=1)return [];
 const duration=warningSeconds(s.wave,s.big);
 const target=dangerCount(s);
 for(let n=Math.min(target,available-1);n>=1;n--){
   for(let attempt=0;attempt<65;attempt++){
     const bag=calculateDangerWeights(s,players),choice=[];
     while(choice.length<n&&bag.length){
       const t=weightedDraw(s,bag),i=bag.findIndex(x=>x.id===t.id);
       choice.push(t.id);bag.splice(i,1);
     }
     if(validateSafeRoutes(s,players,choice,duration))return choice;
   }
 }
 return [];
}
function startTiebreaker(s,players,ids,reason='tie'){
 const eligible=new Set(ids);
 const contestants=players.filter(p=>p.active&&eligible.has(p.id));
 if(contestants.length===1){s.winnerId=contestants[0].id;s.finished=true;return;}
 if(!contestants.length){s.finished=true;return;}
 s.tiebreakers++;s.finalArena=reason==='final-arena';s.suddenDeath=false;
 s.roundId++;s.wave=0;s.phase='NEXT_WAVE';s.timer=.7;s.danger=[];
 createGrid(s,contestants.length);
 const original=players.filter(p=>p.active);
 // Preserve earlier eliminations; ONLY contenders of the latest tie re-enter.
 for(const p of original)p.shockAlive=eligible.has(p.id);
 const old=players.filter(p=>!p.shockAlive);
 spawnPlayers(s,contestants);
 for(const p of old)p.shockAlive=false;
}
function checkWinner(s,players){
 const alive=living(players);
 if(alive.length===1){s.winnerId=alive[0].id;s.finished=true;return true;}
 if(alive.length===0){s.finished=true;return true;}
 if(s.tiles.filter(t=>t.state!=='destroyed').length<=1)
   startTiebreaker(s,players,alive.map(p=>p.id),'final-arena');
 return false;
}
function evaluateEliminations(s,players,fallen){
 const alive=living(players),ids=new Set(fallen.filter(p=>p.shockAlive).map(p=>p.id));
 if(!ids.size)return [];
 // A simultaneous complete wipe is a TIE, never an ID-order lottery.
 if(ids.size===alive.length){
   startTiebreaker(s,players,[...ids],'tie');
   return [...ids];
 }
 s.eliminationEvent++;
 for(const p of alive)if(ids.has(p.id)){
   p.shockAlive=false;p.shockFall=.001;p.shockEliminatedAt=s.eliminationEvent;p.shockEliminatedWave=s.wave;
   p.vx=0;p.vy=0;
 }
 s.events.push({event:s.eliminationEvent,wave:s.wave,ids:[...ids]});
 checkWinner(s,players);
 return [...ids];
}
function startWarning(s,players){
 const selected=selectDangerTiles(s,players);
 if(!selected.length){
   startTiebreaker(s,players,living(players).map(p=>p.id),'blocked');return;
 }
 s.danger=selected;
 s.warningDuration=warningSeconds(s.wave,s.big);
 s.warningStarted=true;
 for(const id of selected){const t=s.tiles[id];t.state='warning';t.wave=s.wave;}
 s.phase='WARNING';s.timer=s.warningDuration;
}
function checkSuddenDeath(s){
 const remaining=s.tiles.filter(t=>t.state!=='destroyed').length;
 s.remainingTiles=remaining;
 if(remaining<=Math.floor(s.initialTiles*.25)||
   (s.wave>=10&&remaining<=Math.floor(s.initialTiles*.5)))s.suddenDeath=true;
 return s.suddenDeath;
}
function startWave(s,players){
 if(checkWinner(s,players))return;
 if(s.phase==='NEXT_WAVE'&&s.timer>0)return;
 s.wave++;
 s.fastPhase=s.wave>=7;
 checkSuddenDeath(s);
 s.phase='PREPARE';s.timer=.08;
 s.danger=[];s.warningStarted=false;
}
function triggerExplosion(s,players){
 if(s.phase!=='WARNING'||!s.warningStarted)return;
 const danger=new Set(s.danger);
 // All positions are snapshotted AFTER movement on the last warning tick.
 const snapshots=living(players).map(p=>({p,x:p.x,y:p.y}));
 for(const id of danger){
   const t=s.tiles[id];
   if(t.state!=='warning'||t.wave!==s.wave)throw Error('SHOCKWAVE exploded an unannounced tile');
   t.state='exploding';
   const c=center(s,t);s.effects.push({x:c.x,y:c.y,life:.55,r:0});
 }
 const fallen=snapshots.filter(q=>calculateFootSupport(s,q.p)<C.footThreshold).map(q=>q.p);
 if(fallen.length)evaluateEliminations(s,players,fallen);
 if(!s.finished&&s.phase==='WARNING'){
   s.phase='COLLAPSE';s.timer=s.fastPhase?.26:.40;
 }
}
function collapseTiles(s){
 for(const id of s.danger){const t=s.tiles[id];if(t.state==='exploding')t.state='destroyed';}
 s.remainingTiles=s.tiles.filter(t=>t.state!=='destroyed').length;
 checkSuddenDeath(s);
 s.danger=[];
}
function step(dt,round,players){
 const s=round.shockwave;
 if(s.finished)return;
 s.clock+=dt;
 if(round.phase==='countdown'){movePlayers(dt,s,players);return;}
 if(round.phase!=='playing')return;
 for(const p of players)if(p.shockFall>0)p.shockFall+=dt;
 for(const fx of s.effects)fx.life-=dt;
 s.effects=s.effects.filter(fx=>fx.life>0).slice(-45);
 // Movement runs through WARNING, not through the destruction/decision animation.
 if(s.phase==='WARNING'||s.phase==='PREPARE')movePlayers(dt,s,players);
 if(s.finished)return;
 if(s.phase==='PREPARE'){
   s.timer-=dt;if(s.timer<=0)startWarning(s,players);
 }else if(s.phase==='WARNING'){
   s.timer-=dt;round.remaining=Math.max(0,s.timer);
   if(s.timer<=0)triggerExplosion(s,players);
 }else if(s.phase==='COLLAPSE'){
   s.timer-=dt;
   if(s.timer<=0){collapseTiles(s);s.phase='CHECK';}
 }else if(s.phase==='CHECK'){
   checkWinner(s,players);
   if(s.phase==='CHECK'&&!s.finished){s.phase='NEXT_WAVE';s.timer=intervalSeconds(s.wave,s.big);}
 }else if(s.phase==='NEXT_WAVE'){
   s.timer-=dt;
   if(s.timer<=0)startWave(s,players);
 }
 if(s.phase!=='WARNING')round.remaining=null;
}
function update(dt,round,players){
 const s=round.shockwave;
 if(!s||s.finished)return s?.finished?'winner':null;
 if(round.paused)return null;
 if(round.phase==='playing'&&s.wave===0&&s.phase==='PREPARE')startWave(s,players);
 s.accumulator=Math.min(.25,s.accumulator+clamp(dt,0,.25));
 let steps=0;
 while(s.accumulator>=STEP&&steps++<15&&!s.finished){
   step(STEP,round,players);s.accumulator-=STEP;
 }
 if(round.phase==='playing'&&s.wave===0&&s.phase==='PREPARE')startWave(s,players);
 return s.finished?'winner':null;
}
function hud(players,round){
 const s=round.shockwave;
 return {survivors:living(players).length,wave:s?.wave||0,
   remaining:s?.phase==='WARNING'?Math.max(0,s.timer):null,phase:s?.phase};
}
function drawPlayer(ctx,p,s){
 if(!p.active)return;
 const alive=p.shockAlive;
 if(!alive&&!(p.shockFall>0&&p.shockFall<.65))return;
 const fall=alive?1:Math.max(.03,1-p.shockFall/.65);
 ctx.save();ctx.translate(p.x,p.y);ctx.scale(fall,fall);
 ctx.globalAlpha=alive?1:Math.max(0,1-p.shockFall/.65);
 ctx.fillStyle='#07111d88';ctx.beginPath();ctx.ellipse(2,9,17,6,0,0,TAU);ctx.fill();
 ctx.strokeStyle='#132033';ctx.lineWidth=3.8;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-8,2);ctx.lineTo(-10,17);ctx.moveTo(8,2);ctx.lineTo(10,17);ctx.stroke();
 ctx.fillStyle=p.color||'#80ddff';ctx.beginPath();ctx.arc(0,-5,14,0,TAU);ctx.fill();
 ctx.strokeStyle='#112237';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(-4,-8,2.2,0,TAU);ctx.arc(4,-8,2.2,0,TAU);ctx.fill();
 ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=3.5;
 ctx.strokeStyle='#08131e';ctx.strokeText(p.name||'',0,-25);
 ctx.fillStyle='#fff';ctx.fillText(p.name||'',0,-25);
 ctx.restore();
}
function drawTile(ctx,s,t){
 const size=s.tileSize,x=s.board.x+t.col*size,y=s.board.y+t.row*size;
 if(t.state==='destroyed'){
   ctx.fillStyle='#040c19';ctx.fillRect(x+1,y+1,size-2,size-2);
   ctx.strokeStyle='#223954';ctx.lineWidth=1;ctx.strokeRect(x+2,y+2,size-4,size-4);return;
 }
 if(t.state==='exploding'){
   const duration=s.fastPhase?.26:.40,progress=1-clamp(s.timer/duration,0,1);
   const scale=1-progress*.66;
   ctx.save();ctx.translate(x+size/2,y+size/2+progress*size*.34);ctx.scale(scale,scale);
   ctx.fillStyle='#ff9d6a';ctx.fillRect(-size/2+4,-size/2+4,size-8,size-8);
   ctx.strokeStyle='#ffdf9d';ctx.lineWidth=3;ctx.strokeRect(-size/2+4,-size/2+4,size-8,size-8);
   ctx.restore();return;
 }
 const danger=t.state==='warning',fraction=s.warningDuration?1-clamp(s.timer/s.warningDuration,0,1):0;
 const pulse=danger?Math.sin(s.clock*(9+fraction*30))>0: false;
 ctx.fillStyle='#080e1c';ctx.fillRect(x,y+5,size,size);
 ctx.fillStyle=danger?(pulse?'#ff5259':'#94422e'):'#236374';
 ctx.fillRect(x+2,y+2,size-4,size-7);
 ctx.fillStyle=danger?'#ffbd7666':'#9de5d733';ctx.fillRect(x+4,y+4,size-8,8);
 ctx.lineWidth=danger?3:1.5;ctx.strokeStyle=danger?'#ffcb74':'#89c5ce';
 ctx.strokeRect(x+3,y+3,size-6,size-10);
 if(danger){
   ctx.strokeStyle='#5b1c2b';ctx.lineWidth=2;ctx.beginPath();
   ctx.moveTo(x+size*.24,y+size*.16);ctx.lineTo(x+size*.45,y+size*.37);
   ctx.lineTo(x+size*.36,y+size*.61);ctx.lineTo(x+size*.65,y+size*.84);
   ctx.moveTo(x+size*.45,y+size*.37);ctx.lineTo(x+size*.74,y+size*.3);ctx.stroke();
   ctx.fillStyle='#ffefc8';ctx.font='bold 17px sans-serif';ctx.textAlign='center';
   ctx.fillText('!',x+size/2,y+size*.68);
 }
}
function draw(ctx,time,round,players){
 const s=round.shockwave;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 const bg=ctx.createLinearGradient(0,0,0,540);
 bg.addColorStop(0,'#091629');bg.addColorStop(1,'#17324c');
 ctx.fillStyle=bg;ctx.fillRect(0,0,960,540);
 ctx.fillStyle='#020914';ctx.fillRect(s.board.x-8,s.board.y-8,s.board.w+16,s.board.h+22);
 ctx.strokeStyle='#6189a5';ctx.lineWidth=2;ctx.strokeRect(s.board.x-9,s.board.y-9,s.board.w+18,s.board.h+21);
 for(const t of s.tiles)drawTile(ctx,s,t);
 for(const p of players)if(p.active&&p.shockAlive)drawPlayer(ctx,p,s);
 for(const e of s.effects){
   ctx.save();ctx.globalAlpha=clamp(e.life*2,0,1);ctx.strokeStyle='#ffc07f';ctx.lineWidth=5;
   ctx.beginPath();ctx.arc(e.x,e.y,(.55-e.life)*s.tileSize*.72+7,0,TAU);ctx.stroke();
   ctx.fillStyle='#ffca84';for(let i=0;i<5;i++){
     const ang=i*TAU/5,travel=(.55-e.life)*65;
     ctx.fillRect(e.x+Math.cos(ang)*travel-3,e.y+Math.sin(ang)*travel-3,6,6);
   }ctx.restore();
 }
 for(const p of players)if(!p.shockAlive)drawPlayer(ctx,p,s);
 ctx.fillStyle='#0a2037ea';ctx.fillRect(16,13,262,76);
 ctx.strokeStyle='#477994';ctx.strokeRect(16,13,262,76);
 ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='bold 17px sans-serif';
 ctx.fillText('SHOCKWAVE',27,36);
 ctx.fillStyle='#b4f3ff';ctx.font='bold 13px sans-serif';
 const stateText=round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown)+' วิ':
   s.phase==='WARNING'?'WAVE '+s.wave+' • ระเบิดใน '+Math.max(0,s.timer).toFixed(1)+' วิ':
   'WAVE '+s.wave+(s.fastPhase?' • FAST':'');
 ctx.fillText(stateText,27,58);
 ctx.fillStyle='#aee6bf';ctx.fillText('ผู้รอด '+living(players).length+' คน • พื้น '+s.remainingTiles+' ช่อง',27,78);
 if(s.fastPhase&&!s.finished){
   ctx.fillStyle='#e66f45';ctx.fillRect(790,18,150,31);
   ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 15px sans-serif';ctx.fillText('FAST PHASE',865,39);
 }
 if(s.suddenDeath&&!s.finished){
   ctx.fillStyle='#ffd1a2';ctx.textAlign='center';ctx.font='bold 14px sans-serif';
   ctx.fillText('SUDDEN DEATH',480,87);
 }
 if(s.finalArena&&s.tiebreakers){
   ctx.fillStyle='#ffdb8e';ctx.textAlign='center';ctx.font='bold 14px sans-serif';
   ctx.fillText('FINAL ARENA • TIEBREAKER '+s.tiebreakers,480,86);
 }
 ctx.restore();
}
window.Shockwave=Object.freeze({setup,update,draw,hud,createGrid,spawnPlayers,calculateDangerWeights,
 selectDangerTiles,validateSafeRoutes,startWave,startWarning,triggerExplosion,collapseTiles,
 calculateFootSupport,resolvePlayerCollision,evaluateEliminations,checkWinner,startTiebreaker,
 warningSeconds,intervalSeconds,distanceBias,checkSuddenDeath,constants:C});
})();
