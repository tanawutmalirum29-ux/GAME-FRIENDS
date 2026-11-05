/* COLOR SWITCH — host-authoritative territory battle (game 5). No DOM dependencies. */
(() => {
'use strict';
const TAU=Math.PI*2, FIXED=1/60;
const C=Object.freeze({speed:170,radius:14,punchRange:46,punchWindup:.12,
 punchActive:.10,punchRecovery:.13,punchCooldown:1.1,punchStun:.55,
 blastCooldown:2.8,blastCast:.18,blastStun:.95,botPunchRate:.85});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function rand(s){let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1234567;return (s.seed>>>0)/4294967296;}
function active(ps){return ps.filter(p=>p.active);}
function createArena(s,count){
 s.cols=count<=6?11:12;s.rows=count<=6?9:10;
 s.size=count<=6?44:41;
 s.board={x:(960-s.cols*s.size)/2,y:(540-s.rows*s.size)/2,w:s.cols*s.size,h:s.rows*s.size};
 s.tiles=Array.from({length:s.cols*s.rows},(_,id)=>({
  id,row:Math.floor(id/s.cols),column:id%s.cols,
  x:s.board.x+(id%s.cols)*s.size,y:s.board.y+Math.floor(id/s.cols)*s.size,
  ownerId:null,paintAnimation:0,lastCaptureEvent:0}));
 return s.tiles;
}
function tileAt(s,x,y){
 const col=Math.floor((x-s.board.x)/s.size),row=Math.floor((y-s.board.y)/s.size);
 return col>=0&&row>=0&&col<s.cols&&row<s.rows?s.tiles[row*s.cols+col]:null;
}
function cellCenter(s,t){return {x:t.x+s.size/2,y:t.y+s.size/2};}
function spawnPlayers(s,ps){
 const slots=[];
 for(let row=1;row<s.rows-1;row+=2)for(let col=1;col<s.cols-1;col+=2)slots.push(s.tiles[row*s.cols+col]);
 for(let i=slots.length-1;i>0;i--){const j=Math.floor(rand(s)*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
 active(ps).forEach((p,i)=>{
  const at=cellCenter(s,slots[i%slots.length]);p.x=at.x;p.y=at.y;p.vx=0;p.vy=0;
  p.dir={x:1,y:0};p.face=1;p.score=0;
  p.cs={stunRemaining:0,stunImmunity:0,punchCooldown:0,blastCooldown:0,
   punchState:null,castRemaining:0,powerBoostReady:false,
   actionLatch:false,altLatch:false,botTarget:null,botRetarget:0,
   botNextPunch:0,botNextBlast:0,fxClock:0};
 });
}
function setup(round,ps){
 const s={clock:0,elapsed:0,remaining:0,duration:active(ps).length<=6?60:75,
  accumulator:0,seed:(Number(round.colorSeed)||Date.now()^0x6d213a9b)>>>0||1,
  tiles:[],board:null,cols:0,rows:0,size:0,boxes:[],effects:[],
  boxCounter:0,nextBoxSpawn:0,eventCounter:0,finished:false,
  winnerIds:[],ranking:[],totalCaptures:0,theme:'classic',mayan:null};
 round.colorSwitch=s;round.remaining=s.duration;
 ps.forEach(p=>{p.active=true;p.score=0;});
 const requested=['classic','mayan'].includes(round.colorTheme)?round.colorTheme:null;
 s.theme=requested||(rand(s)<.5?'classic':'mayan');
 // The default map remains playable when external theme code is unavailable.
 if(s.theme==='mayan'&&!window.ColorSwitchMayan)s.theme='classic';
 createArena(s,active(ps).length);spawnPlayers(s,ps);
 if(s.theme==='mayan')window.ColorSwitchMayan.setup(s,rand);
 s.nextBoxSpawn=8+rand(s)*4;
 return s;
}
function captureTile(s,t,p,ps){
 if(!t||!p||!p.active||t.ownerId===p.id)return false;
 if(t.ownerId!=null){const prev=ps.find(q=>q.id===t.ownerId);if(prev)prev.score=Math.max(0,(prev.score||0)-1);}
 t.ownerId=p.id;p.score=(p.score||0)+1;t.paintAnimation=.18;
 t.lastCaptureEvent=++s.eventCounter;s.totalCaptures++;
 if(s.effects.length<32)s.effects.push({x:t.x+s.size/2,y:t.y+s.size/2,
  color:p.color,life:.25,type:'spark'});
 return true;
}
function capturePathTiles(s,p,ps,fromX,fromY){
 const distance=Math.hypot(p.x-fromX,p.y-fromY);
 const n=Math.max(1,Math.ceil(distance/(s.size*.22)));
 for(let i=0;i<=n;i++){const a=i/n;captureTile(s,tileAt(s,fromX+(p.x-fromX)*a,fromY+(p.y-fromY)*a),p,ps);}
}
function updateTerritoryScores(s,ps){
 const counts=new Map();for(const t of s.tiles)if(t.ownerId!=null)counts.set(t.ownerId,(counts.get(t.ownerId)||0)+1);
 for(const p of ps)p.score=counts.get(p.id)||0;
 return counts;
}
function clearLeftPlayers(s,ps){
 const departed=new Set(ps.filter(p=>!p.active).map(p=>p.id));
 if(!departed.size)return;
 for(const t of s.tiles)if(departed.has(t.ownerId)){t.ownerId=null;t.paintAnimation=.18;t.lastCaptureEvent=++s.eventCounter;}
 for(const p of ps)if(!p.active)p.score=0;
}
function inputVector(p){
 const i=p.input||{};
 let x=Number.isFinite(i.axisX)?i.axisX:Number(!!i.right)-Number(!!i.left);
 let y=Number.isFinite(i.axisY)?i.axisY:Number(!!i.down)-Number(!!i.jump);
 const n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}
 return {x,y,action:i.action===true,alt:i.alt===true};
}
function calculateBlastCells(s,p,boost){
 const at=tileAt(s,p.x,p.y);if(!at)return [];
 const width=boost?4:3;
 const dir=p.dir||{x:1,y:0};
 const startCol=boost?at.column+(dir.x>=0?-1:-2):at.column-1;
 const startRow=boost?at.row+(dir.y>=0?-1:-2):at.row-1;
 const ids=[];
 for(let r=0;r<width;r++)for(let c=0;c<width;c++){
  const col=startCol+c,row=startRow+r;
  if(col>=0&&row>=0&&col<s.cols&&row<s.rows)ids.push(row*s.cols+col);
 }
 return ids;
}
function touchedByBlast(s,p,tileIds){
 const radius=C.radius;for(const id of tileIds){
  const t=s.tiles[id],dx=p.x-clamp(p.x,t.x,t.x+s.size),dy=p.y-clamp(p.y,t.y,t.y+s.size);
  if(dx*dx+dy*dy<=radius*radius)return true;
 }
 return false;
}
function applyStun(p,seconds){
 const c=p.cs;if(!c||c.stunImmunity>0)return false;
 c.punchState=null; // Interrupt any pending punch when stunned.
 c.stunRemaining=Math.max(c.stunRemaining,seconds);return true;
}
function activateColorBlast(s,p,ps){
 const c=p.cs;if(!c||c.blastCooldown>0||c.stunRemaining>0||c.castRemaining>0)return false;
 const boosted=c.powerBoostReady,ids=calculateBlastCells(s,p,boosted);
 for(const id of ids)captureTile(s,s.tiles[id],p,ps);
 if(boosted){for(const other of active(ps)){
  if(other.id!==p.id&&touchedByBlast(s,other,ids))applyStun(other,C.blastStun);
 }}
 c.powerBoostReady=false;c.blastCooldown=C.blastCooldown;c.castRemaining=C.blastCast;
 if(s.effects.length<30)s.effects.push({x:p.x,y:p.y,color:p.color,life:.4,type:'blast',boosted});
 return true;
}
function startPunch(p){
 const c=p.cs;if(!c||c.punchCooldown>0||c.stunRemaining>0||c.castRemaining>0)return false;
 c.punchCooldown=C.punchCooldown;c.punchState={timer:C.punchWindup,hit:false};
 return true;
}
function resolvePunchHit(p,ps){
 const d=p.dir||{x:1,y:0};
 for(const target of active(ps))if(target.id!==p.id){
  const dx=target.x-p.x,dy=target.y-p.y,length=Math.hypot(dx,dy);
  if(length>C.punchRange||length<.01)continue;
  if((dx*d.x+dy*d.y)/length<.45)continue;
  applyStun(target,C.punchStun);
 }
}
function updateCooldowns(dt,p,ps){
 const c=p.cs;
 for(const key of ['stunRemaining','stunImmunity','punchCooldown','blastCooldown','castRemaining'])
  c[key]=Math.max(0,c[key]-dt);
 if(c.stunRemaining===0&&c._wasStunned){c.stunImmunity=Math.max(c.stunImmunity,.22);}
 c._wasStunned=c.stunRemaining>0;
 if(c.punchState){
  c.punchState.timer-=dt;
  if(c.punchState.timer<=0&&!c.punchState.hit){
   c.punchState.hit=true;resolvePunchHit(p,ps);
  }
  if(c.punchState.timer<-(C.punchActive+C.punchRecovery))c.punchState=null;
 }
}
function spawnPowerBox(s,ps){
 const max=active(ps).length<=6?1:2;
 if(s.boxes.length>=max)return false;
 const candidates=s.tiles.filter(t=>{
  if(t.column<1||t.row<1||t.column>=s.cols-1||t.row>=s.rows-1)return false;
  const center=cellCenter(s,t);
  return active(ps).every(p=>Math.hypot(center.x-p.x,center.y-p.y)>s.size*1.1)&&
   s.boxes.every(b=>Math.hypot(center.x-b.x,center.y-b.y)>s.size*1.5);
 });
 if(!candidates.length)return false;
 const at=cellCenter(s,candidates[Math.floor(rand(s)*candidates.length)]);
 s.boxes.push({id:++s.boxCounter,x:at.x,y:at.y,spawnTime:s.elapsed,expireTime:s.elapsed+24,
  active:true,collectedBy:null});
 return true;
}
function collectPowerBox(s,ps){
 for(const box of [...s.boxes]){
  const claim=active(ps).sort((a,b)=>String(a.id).localeCompare(String(b.id))).find(p=>
   p.cs&&!p.cs.powerBoostReady&&Math.hypot(p.x-box.x,p.y-box.y)<=C.radius+9);
  if(claim){claim.cs.powerBoostReady=true;box.active=false;box.collectedBy=claim.id;
   s.boxes.splice(s.boxes.indexOf(box),1);
   if(s.effects.length<30)s.effects.push({x:box.x,y:box.y,color:claim.color,life:.5,type:'star'});
  }
 }
}
function updateBoxes(s,ps){
 const old=s.boxes.length;
 s.boxes=s.boxes.filter(b=>b.expireTime>s.elapsed);
 if(s.elapsed>=s.nextBoxSpawn){
  if(s.boxes.length<(active(ps).length<=6?1:2))spawnPowerBox(s,ps);
  if(s.boxes.length<(active(ps).length<=6?1:2)&&active(ps).length>6)spawnPowerBox(s,ps);
  s.nextBoxSpawn=s.elapsed+12+rand(s)*6;
 }
 collectPowerBox(s,ps);
 if(s.boxes.length<old)s.nextBoxSpawn=Math.min(s.nextBoxSpawn,s.elapsed+12+rand(s)*6);
}
function botControls(s,p,ps){
 const c=p.cs;
 if(s.clock>=c.botRetarget||!s.tiles[c.botTarget]||s.tiles[c.botTarget].ownerId===p.id){
  let best=null,bestValue=-Infinity;
  for(const t of s.tiles){
   if(t.ownerId===p.id)continue;
   const center=cellCenter(s,t),distance=Math.hypot(center.x-p.x,center.y-p.y);
   const enemy=t.ownerId!=null;
   const value=(enemy?1.3:1)*80-distance+rand(s)*12;
   if(value>bestValue){bestValue=value;best=t.id;}
  }
  c.botTarget=best;c.botRetarget=s.clock+.5+rand(s)*.5;
 }
 const target=s.tiles[c.botTarget]||s.tiles[Math.floor(rand(s)*s.tiles.length)];
 const point=cellCenter(s,target),dx=point.x-p.x,dy=point.y-p.y,d=Math.hypot(dx,dy);
 let x=d>3?dx/d:0,y=d>3?dy/d:0;
 // Soft separation from other avatars, with identical world collision.
 for(const other of active(ps))if(other.id!==p.id){
  const ax=p.x-other.x,ay=p.y-other.y,dist=Math.hypot(ax,ay);
  if(dist<34&&dist>1){x+=ax/dist*.5;y+=ay/dist*.5;}
 }
 const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
 const enemy=active(ps).some(q=>q.id!==p.id&&Math.hypot(q.x-p.x,q.y-p.y)<C.punchRange&&
  ((q.x-p.x)*(p.dir?.x||1)+(q.y-p.y)*(p.dir?.y||0))>10);
 const action=enemy&&s.clock>=c.botNextPunch&&c.punchCooldown===0;
 const ids=calculateBlastCells(s,p,c.powerBoostReady);
 const gain=ids.filter(id=>s.tiles[id].ownerId!==p.id).length;
 const blast=c.blastCooldown===0&&s.clock>=c.botNextBlast&&(gain>=(c.powerBoostReady?6:4)||
  (c.powerBoostReady&&active(ps).some(q=>q.id!==p.id&&touchedByBlast(s,q,ids))));
 if(action)c.botNextPunch=s.clock+(1.15+rand(s)*.45)/C.botPunchRate;
 if(blast)c.botNextBlast=s.clock+3+rand(s)*1.2;
 return {x,y,action,alt:blast};
}
function resolvePlayerCollisions(s,ps){
 const people=active(ps).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const b=s.board,r=C.radius,min=r*2;
 for(let pass=0;pass<5;pass++)for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
  const a=people[i],z=people[j];let dx=z.x-a.x,dy=z.y-a.y,dist=Math.hypot(dx,dy);
  if(dist>=min)continue;
  if(dist<.001){const theta=(i*19+j*13+1)*2.4;dx=Math.cos(theta);dy=Math.sin(theta);dist=1;}
  const gap=Math.min(5,(min-dist)/2),nx=dx/dist,ny=dy/dist;
  a.x=clamp(a.x-nx*gap,b.x+r,b.x+b.w-r);a.y=clamp(a.y-ny*gap,b.y+r,b.y+b.h-r);
  z.x=clamp(z.x+nx*gap,b.x+r,b.x+b.w-r);z.y=clamp(z.y+ny*gap,b.y+r,b.y+b.h-r);
 }
}
function calculateFinalRanking(s,ps){
 updateTerritoryScores(s,ps);
 const rank=active(ps).slice().sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 s.ranking=rank.map(p=>({id:p.id,score:p.score,rank:1+rank.filter(q=>q.score>p.score).length}));
 s.winnerIds=rank.length?rank.filter(p=>p.score===rank[0].score).map(p=>p.id):[];
 return s.ranking;
}
function finishMatch(s,round,ps){
 calculateFinalRanking(s,ps);s.finished=true;round.remaining=0;return 'winner';
}
function step(dt,round,ps){
 const s=round.colorSwitch;if(s.finished)return;
 s.clock+=dt;s.elapsed=Math.min(s.duration,s.elapsed+dt);
 clearLeftPlayers(s,ps);
 const moved=new Map(),ctrl=new Map();
 const people=active(ps).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 for(const p of people){
  moved.set(p.id,{x:p.x,y:p.y});updateCooldowns(dt,p,people);
  const v=p.isBot?botControls(s,p,people):inputVector(p);ctrl.set(p.id,v);
  const canMove=p.cs.stunRemaining===0&&p.cs.castRemaining===0;
  const vx=canMove?v.x*C.speed:0,vy=canMove?v.y*C.speed:0;
  p.vx=vx;p.vy=vy;
  if(Math.hypot(v.x,v.y)>.1&&canMove){const m=Math.hypot(v.x,v.y);p.dir={x:v.x/m,y:v.y/m};p.face=v.x<0?-1:1;}
  const b=s.board,r=C.radius;
  p.x=clamp(p.x+vx*dt,b.x+r,b.x+b.w-r);
  p.y=clamp(p.y+vy*dt,b.y+r,b.y+b.h-r);
 }
 resolvePlayerCollisions(s,people);
 for(const p of people){const prev=moved.get(p.id);capturePathTiles(s,p,ps,prev.x,prev.y);}
 // Deterministic input action order; one keypress can only generate one action.
 for(const p of people){
  const c=p.cs,v=ctrl.get(p.id),a=v.action,b=v.alt;
  if(a&&!c.actionLatch)startPunch(p);
  if(b&&!c.altLatch)activateColorBlast(s,p,ps);
  c.actionLatch=a;c.altLatch=b;
 }
 updateBoxes(s,people);
 if(s.theme==='mayan')window.ColorSwitchMayan.update(dt,s,people,applyStun,rand);
 for(const t of s.tiles)t.paintAnimation=Math.max(0,t.paintAnimation-dt);
 for(const e of s.effects)e.life-=dt;
 s.effects=s.effects.filter(e=>e.life>0).slice(-32);
 s.remaining=Math.max(0,s.duration-s.elapsed);round.remaining=s.remaining;
 if(s.remaining===0)finishMatch(s,round,ps);
}
function update(dt,round,ps){
 const s=round.colorSwitch;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.24,s.accumulator+clamp(dt,0,.24));
 let steps=0;
 while(s.accumulator>=FIXED&&steps++<15&&!s.finished){step(FIXED,round,ps);s.accumulator-=FIXED;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.colorSwitch;
 return {survivors:active(ps).length,remaining:s?s.remaining:0,
  scores:active(ps).map(p=>({id:p.id,score:p.score||0})),winnerIds:s?.winnerIds||[]};
}
function drawScenery(ctx,s){
 if(s.theme==='mayan'){window.ColorSwitchMayan.drawGround(ctx,s);return;}
 ctx.fillStyle='#4b9166';ctx.fillRect(0,0,960,540);
 ctx.fillStyle='#357a58';for(let i=0;i<48;i++){
  const x=(i*73+29)%960,y=(i*139+71)%540;
  ctx.beginPath();ctx.arc(x,y,2+i%4,0,TAU);ctx.fill();
 }
 const b=s.board;
 ctx.fillStyle='#233b2e';ctx.fillRect(b.x-11,b.y-11,b.w+22,b.h+25);
 ctx.fillStyle='#e5c891';ctx.fillRect(b.x-8,b.y-8,b.w+16,b.h+16);
 ctx.fillStyle='#886b48';ctx.fillRect(b.x-5,b.y-5,b.w+10,b.h+10);
 for(let i=0;i<22;i++){
  const x=i<11?30+i*83:30+(i-11)*83,y=i<11?35:505;
  if(x>b.x-20&&x<b.x+b.w+20)continue;
  ctx.fillStyle='#31583c';ctx.beginPath();ctx.arc(x,y+7,19,0,TAU);ctx.fill();
  ctx.fillStyle='#347e4c';ctx.beginPath();ctx.arc(x,y,16,0,TAU);ctx.fill();
  ctx.fillStyle='#5cb873';ctx.beginPath();ctx.arc(x-6,y-7,9,0,TAU);ctx.fill();
 }
}
function draw(ctx,time,round,ps){
 const s=round.colorSwitch;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);drawScenery(ctx,s);
 const colors=new Map(ps.map(p=>[p.id,p.color]));
 for(const t of s.tiles){
  ctx.fillStyle=s.theme==='mayan'?'#342c24':'#493b2e';ctx.fillRect(t.x,t.y,s.size,s.size);
  ctx.fillStyle=t.ownerId==null?(s.theme==='mayan'?'#756c57':'#ae8559'):colors.get(t.ownerId)||'#ae8559';
  ctx.fillRect(t.x+1.2,t.y+1.2,s.size-2.4,s.size-2.4);
  ctx.fillStyle=t.ownerId==null?(s.theme==='mayan'?'#998f72':'#d7ae76'):'#ffffff22';
  ctx.fillRect(t.x+3,t.y+3,s.size-6,3);
  if(s.theme==='mayan'){
   ctx.strokeStyle=t.ownerId==null?'#4b4232':'#172e3b66';
   ctx.lineWidth=2;ctx.strokeRect(t.x+10,t.y+10,s.size-20,s.size-20);
   ctx.lineWidth=1;ctx.strokeRect(t.x+16,t.y+16,s.size-32,s.size-32);
  }
  if(t.paintAnimation>0){ctx.globalAlpha=Math.min(.6,t.paintAnimation*3);
   ctx.fillStyle='#fff';ctx.fillRect(t.x+2,t.y+2,s.size-4,s.size-4);ctx.globalAlpha=1;}
 }
 if(s.theme==='mayan')window.ColorSwitchMayan.drawDevices(ctx,s);
 for(const box of s.boxes){
  const bob=Math.sin(s.clock*5+box.id)*3;
  ctx.save();ctx.translate(box.x,box.y+bob);ctx.fillStyle='#412965';ctx.fillRect(-13,-11,26,26);
  ctx.fillStyle='#9d69f3';ctx.fillRect(-12,-13,24,23);
  ctx.fillStyle='#fff2ae';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('★',0,7);
  ctx.restore();
 }
 for(const p of active(ps)){
  if(window.PartyPlayerAvatar&&window.PartyPlayerAvatar.draw)
   window.PartyPlayerAvatar.draw(ctx,p,{time:s.clock});
  else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,C.radius,0,TAU);ctx.fill();}
  const c=p.cs;
  if(c?.powerBoostReady){
   ctx.strokeStyle='#ffe46d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,21,0,TAU);ctx.stroke();
   ctx.fillStyle='#ffe46d';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText('★',p.x+20,p.y-19);
  }
  if(c?.stunRemaining>0){
   ctx.fillStyle='#ffe992';ctx.font='bold 17px sans-serif';ctx.textAlign='center';
   ctx.fillText('✦ ✦',p.x,p.y-28);
  }
 }
 for(const e of s.effects){
  ctx.save();ctx.globalAlpha=clamp(e.life*2.8,0,.85);ctx.strokeStyle=e.color;
  if(e.type==='blast'){
   const radius=(.4-e.life)*(e.boosted?210:145)+7;
   ctx.lineWidth=e.boosted?7:4;ctx.beginPath();ctx.arc(e.x,e.y,radius,0,TAU);ctx.stroke();
  }else{ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x,e.y,(.5-e.life)*15+4,0,TAU);ctx.fill();}
  ctx.restore();
 }
 if(s.theme==='mayan')window.ColorSwitchMayan.drawBullets(ctx,s);
 ctx.fillStyle='#152b2add';ctx.fillRect(13,12,174,57);
 ctx.fillStyle='#f5ffeb';ctx.font='900 17px sans-serif';ctx.textAlign='left';ctx.fillText('COLOR SWITCH',23,34);
 ctx.font='bold 13px sans-serif';ctx.fillStyle='#ffe3a0';
 ctx.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):'เวลา '+Math.ceil(s.remaining)+' วินาที',23,55);
 if(round.phase==='playing'&&s.remaining<=10){
  ctx.fillStyle='#ffe0a0';ctx.font='900 33px sans-serif';ctx.textAlign='center';
  if(s.remaining<=3)ctx.fillText(String(Math.ceil(s.remaining)),480,46);
 }
 ctx.restore();
}
window.ColorSwitch=Object.freeze({setup,update,draw,hud,createArena,tileAt,
 captureTile,capturePathTiles,updateTerritoryScores,startPunch,resolvePunchHit,
 activateColorBlast,calculateBlastCells,spawnPowerBox,collectPowerBox,
 resolvePlayerCollisions,calculateFinalRanking,finishMatch,constants:C});
})();
