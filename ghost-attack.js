/* GHOST ATTACK — original asymmetric survival mini-game.
   The host is authoritative: controllers send movement/buttons, not positions.
   Coordinates are in a player-count-scaled 16:9 world. No match timer. */
(() => {
'use strict';
const TAU=Math.PI*2;
const ITEMS=['cloak','boost','stun','trap','slow'];
const ITEM_NAMES={cloak:'ผ้าคลุมล่องหน',boost:'บูสต์สปีด',stun:'สตั้นผี',trap:'กับดัก',slow:'ยาสโลว์เพื่อน'};

const ITEM_SVG={
 cloak:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#8be9fd" d="M16 18c8-8 24-8 32 0v30c-5-3-10-5-16-5s-11 2-16 5V18z"/><path fill="#d9fbff" d="M23 19c4-3 14-3 18 0v6H23z"/></svg>`,
 boost:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#ffd54f" d="M36 4 14 35h14l-4 25 26-35H35z"/></svg>`,
 stun:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#ffb74d"/><path fill="#fff3c4" d="m32 7 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1z"/></svg>`,
 trap:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#cfd8dc" d="M10 34c0-8 10-14 22-14s22 6 22 14-10 18-22 18S10 42 10 34z"/><path fill="#ef5350" d="M16 37h32l-4 7H20z"/><path fill="#455a64" d="M18 28h4v7h-4zm8 0h4v7h-4zm8 0h4v7h-4zm8 0h4v7h-4z"/></svg>`,
 slow:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#b39ddb" d="M24 8h16v6l8 11c5 7 0 23-16 23S11 32 16 25l8-11z"/><circle cx="32" cy="33" r="7" fill="#ede7f6"/></svg>`
};
const ITEM_ICON_IMAGES=Object.create(null);
function getItemIconImage(item){
 if(!ITEM_SVG[item]||typeof Image==='undefined')return null;
 if(!ITEM_ICON_IMAGES[item]){
  const img=new Image();
  img.decoding='async';
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(ITEM_SVG[item]);
  ITEM_ICON_IMAGES[item]=img;
 }
 return ITEM_ICON_IMAGES[item];
}
function preloadItemIcons(){for(const key of ITEMS)getItemIconImage(key);}

const C={humanSpeed:172,ghostSpeed:176,ghostTurn:5.3,hitRadius:19,punchRange:67,
  punchStun:.63,punchCooldown:1.05,ghostStun:1.45,trapRoot:1.1,slowTime:2.5,boostTime:2.6,cloakTime:2};
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const nrm=(x,y)=>{const l=Math.hypot(x,y)||1;return {x:x/l,y:y/l};};
function safeCircle(rect,x,y,r){
  const cx=clamp(x,rect.x,rect.x+rect.w),cy=clamp(y,rect.y,rect.y+rect.h);
  return Math.hypot(x-cx,y-cy)>=r;
}
function freeSpot(world,obstacles,others,margin=22,minDistance=52){
  for(let i=0;i<200;i++){
    const q={x:rand(margin,world.w-margin),y:rand(margin,world.h-margin)};
    if(obstacles.every(o=>safeCircle(o,q.x,q.y,margin))&&
       others.every(o=>dist(q,o)>minDistance))return q;
  }
  // Guaranteed fallback; every side has a clear navigation lane.
  const corner=[{x:50,y:50},{x:world.w-50,y:50},{x:50,y:world.h-50},
    {x:world.w-50,y:world.h-50}];
  return corner.find(q=>obstacles.every(o=>safeCircle(o,q.x,q.y,20)))||corner[0];
}
function makeObstacles(world,tier){
  const out=[];
  const count=7+tier*5;
  const candidateW=world.w-130,candidateH=world.h-110;
  for(let k=0,tries=0;k<count&&tries<260;tries++){
    const w=rand(29,62),h=rand(23,52);
    const q={x:65+Math.random()*Math.max(1,candidateW-w),
      y:55+Math.random()*Math.max(1,candidateH-h),w,h,style:k%3};
    const center={x:q.x+w/2,y:q.y+h/2};
    // Keep a generous center spawn plaza clear for the starting AI ghost(s).
    if(Math.hypot(center.x-world.w/2,center.y-world.h/2)<115)continue;
    if(out.some(o=>!(q.x>o.x+o.w+32||q.x+q.w+32<o.x||
      q.y>o.y+o.h+32||q.y+q.h+32<o.y)))continue;
    out.push(q);k++;
  }
  return out;
}
function resetPlayer(p,pos){
  p.x=pos.x;p.y=pos.y;p.vx=0;p.vy=0;p.face=1;
  p.active=true;p.alive=true;p.ghost=false;p.score=0;
  p.item=null;p.selecting=false;p.targetId=null;
  p.pickupNotice=null;p.pickupNoticeItem=null;p.pickupNoticeTime=0;
  p.stun=0;p.slow=0;p.cloak=0;p.boost=0;p.punchCooldown=0;
  p.punchFX=0;p.altLatch=false;p.actionLatch=false;
  p.input={left:false,right:false,jump:false,down:false,action:false,alt:false,axisX:0,axisY:0};
  p.dir={x:1,y:0};p.survival=0;p.infectedAt=null;
}
function setup(round,players){
  preloadItemIcons();
  const tier=Math.max(1,Math.ceil(Math.max(4,players.length)/4));
  const world={w:960+(tier-1)*240,h:540+(tier-1)*135};
  const obstacles=makeObstacles(world,tier);
  const center={x:world.w/2,y:world.h/2};
  const used=[center];
  for(const p of players){
    // Humans spawn at random, dispersed locations away from the AI ghost plaza.
    let pos=freeSpot(world,obstacles,used,30,Math.max(80,world.w/13));
    for(let tries=0;tries<35&&dist(pos,center)<Math.min(world.w,world.h)*.32;tries++)
      pos=freeSpot(world,obstacles,used,30,Math.max(80,world.w/13));
    resetPlayer(p,pos);used.push(pos);
  }
  const npcs=Array.from({length:tier},(_,i)=>{
    const a=i*TAU/tier;
    return {id:'ai-ghost-'+i,x:center.x+Math.cos(a)*25,
      y:center.y+Math.sin(a)*25,dir:{x:Math.cos(a),y:Math.sin(a)},
      targetId:null,lockUntil:0,stun:0};
  });
  round.ghost={world,obstacles,npcs,boxes:[],traps:[],time:0,
    boxClock:4.5,maxBoxes:tier===1?1:tier===2?2:3,
    winnerId:null,converted:[],lastHumanId:null,ghostSpawned:false};
  round.phase='countdown';round.countdown=3;
}
function walk(entity,vx,vy,dt,world,obstacles,ignoreObstacles=false){
  const radius=15;
  const x=clamp(entity.x+vx*dt,radius+6,world.w-radius-6);
  const y=clamp(entity.y+vy*dt,radius+6,world.h-radius-6);
  if(ignoreObstacles){entity.x=x;entity.y=y;return;}
  if(obstacles.every(o=>safeCircle(o,x,entity.y,radius)))entity.x=x;
  if(obstacles.every(o=>safeCircle(o,entity.x,y,radius)))entity.y=y;
}
function turnTowards(current,wanted,seconds,turnSpeed){
  const len=Math.hypot(wanted.x,wanted.y);
  if(len<.01)return current;
  const from=Math.atan2(current.y,current.x),to=Math.atan2(wanted.y,wanted.x);
  const d=Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const a=from+clamp(d,-turnSpeed*seconds,turnSpeed*seconds);
  return {x:Math.cos(a),y:Math.sin(a)};
}
function survivors(players){return players.filter(p=>p.active&&!p.ghost);}
function nearestTarget(npc,players,state,preferLock=true){
  const available=players.filter(p=>p.active&&!p.ghost&&p.cloak<=0);
  if(!available.length){npc.targetId=null;return null;}
  const sorted=[...available].sort((a,b)=>dist(npc,a)-dist(npc,b));
  const nearest=sorted[0];
  const old=available.find(p=>p.id===npc.targetId);
  // Target persistence, interrupted ONLY by a dramatically closer person.
  // Lock removes robotic rapid switching and keeps most chases predictable.
  if(preferLock&&old&&dist(npc,old)<=state.world.w*.52){
    if(state.time<npc.lockUntil&&dist(npc,nearest)>=dist(npc,old)*.55)return old;
    if(dist(npc,nearest)>=dist(npc,old)*.77)return old;
  }
  let next=nearest;
  // Rarely choose a nearby runner, never somebody far across the map.
  if(sorted.length>1&&Math.random()<.12&&
     dist(npc,sorted[1])<=dist(npc,nearest)*1.27)next=sorted[1];
  npc.targetId=next.id;
  npc.lockUntil=state.time+rand(1.2,1.85);
  return next;
}
function convert(p,state){
  if(!p.active||p.ghost)return;
  p.ghost=true;p.item=null;p.selecting=false;p.targetId=null;
  p.pickupNotice=null;p.pickupNoticeItem=null;p.pickupNoticeTime=0;
  p.cloak=0;p.boost=0;p.slow=0;p.stun=.17;
  p.infectedAt=state.time;p.score=Math.floor(p.survival*10);
  state.converted.push(p.id);
}
function advanceNpcs(dt,players,state){
  for(const npc of state.npcs){
    npc.stun=Math.max(0,npc.stun-dt);
    if(npc.stun>0)continue;
    const target=nearestTarget(npc,players,state);
    if(!target)continue;
    const desired=nrm(target.x-npc.x,target.y-npc.y);
    npc.dir=turnTowards(npc.dir,desired,dt,C.ghostTurn);
    walk(npc,npc.dir.x*C.ghostSpeed,npc.dir.y*C.ghostSpeed,
      dt,state.world,state.obstacles,true);
    for(const p of players){
      if(p.active&&!p.ghost&&dist(npc,p)<C.hitRadius+7)convert(p,state);
    }
  }
}
function useItem(p,state,players){
  if(!p.item||p.ghost)return;
  const item=p.item;
  if(item==='slow'){
    const choices=players.filter(x=>x.active&&x.id!==p.id);
    if(!p.selecting){
      if(!choices.length)return;
      p.selecting=true;
      p.targetId=choices[0].id;
      return;
    }
    const target=choices.find(x=>x.id===p.targetId);
    if(!target)return;
    target.slow=Math.max(target.slow,C.slowTime);
    p.selecting=false;p.targetId=null;p.item=null;
    return;
  }
  p.item=null;p.selecting=false;p.targetId=null;
  if(item==='cloak')p.cloak=C.cloakTime;
  if(item==='boost')p.boost=C.boostTime;
  if(item==='stun'){
    for(const npc of state.npcs)if(dist(npc,p)<=90)npc.stun=Math.max(npc.stun,C.ghostStun);
    for(const other of players)
      if(other.active&&other.ghost&&dist(other,p)<=90)
        other.stun=Math.max(other.stun,C.ghostStun);
  }
  if(item==='trap'){
    state.traps.push({x:p.x,y:p.y,r:16,ttl:11,armed:.42,ownerGrace:1.1,owner:p.id,color:p.color});
  }
}
function cycleTarget(state,players,p,direction){
  if(!state||!p||!p.active||!p.selecting||p.item!=='slow'||p.ghost)return false;
  const choices=players.filter(x=>x.active&&x.id!==p.id);
  if(!choices.length){p.targetId=null;return false;}
  const idx=choices.findIndex(q=>q.id===p.targetId);
  const delta=direction<0?-1:1;
  p.targetId=choices[(idx+delta+choices.length)%choices.length].id;
  return true;
}
function punch(p,players){
  if(p.punchCooldown>0||p.stun>0)return;
  p.punchCooldown=C.punchCooldown;p.punchFX=.22;
  const friends=players.filter(o=>o.active&&o.id!==p.id&&dist(o,p)<C.punchRange);
  const target=friends.sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(target)target.stun=Math.max(target.stun,C.punchStun);
}
function tickPlayers(dt,players,state){
  for(const p of players){
    if(!p.active)continue;
    p.survival+=p.ghost?0:dt;
    for(const key of ['stun','slow','cloak','boost','punchCooldown','punchFX','pickupNoticeTime'])
      p[key]=Math.max(0,(p[key]||0)-dt);
    const input=p.input||{};
    // Button presses require release before they can trigger again.
    if(input.action&&!p.actionLatch)punch(p,players);
    if(input.alt&&!p.altLatch)useItem(p,state,players);
    p.actionLatch=!!input.action;p.altLatch=!!input.alt;
    if(p.stun>0){p.vx=0;p.vy=0;continue;}
    const rawX=clamp((Number(input.axisX)||0)+
      (input.right?1:0)-(input.left?1:0),-1,1);
    const rawY=clamp((Number(input.axisY)||0)+
      (input.down?1:0)-(input.jump?1:0),-1,1);
    const length=Math.hypot(rawX,rawY);
    if(length<.08){p.vx=0;p.vy=0;continue;}
    const strength=Math.min(1,length);
    const desired=nrm(rawX,rawY);
    // Converted ghosts have slightly wider turns than humans, but not sluggish.
    p.dir=p.ghost?turnTowards(p.dir,desired,dt,C.ghostTurn):desired;
    const speed=(p.ghost?C.ghostSpeed:C.humanSpeed)*
      (p.slow>0?.58:1)*(p.boost>0?1.5:1);
    p.vx=p.dir.x*speed*strength;p.vy=p.dir.y*speed*strength;
    walk(p,p.vx,p.vy,dt,state.world,state.obstacles,p.ghost);
  }
}
function updateTraps(dt,players,state){
  state.traps=state.traps.filter(t=>{
    t.ttl-=dt;t.armed=Math.max(0,(t.armed||0)-dt);
    t.ownerGrace=Math.max(0,(t.ownerGrace||0)-dt);
    if(t.ttl<=0)return false;
    if(t.armed>0)return true;
    for(const p of players){
      if(!p.active||p.ghost||(p.id===t.owner&&t.ownerGrace>0))continue;
      if(dist(t,p)<25){p.stun=Math.max(p.stun,C.trapRoot);return false;}
    }
    return true;
  });
}
function newBox(players,state){
  const existing=[...players.filter(p=>p.active),...state.boxes];
  const q=freeSpot(state.world,state.obstacles,existing,25,80);
  return {x:q.x,y:q.y,ttl:17,item:ITEMS[Math.floor(Math.random()*ITEMS.length)]};
}
function updateBoxes(dt,players,state){
  for(let i=state.boxes.length-1;i>=0;i--){
    const b=state.boxes[i];b.ttl-=dt;
    if(b.ttl<=0){state.boxes.splice(i,1);continue;}
    for(const p of players){
      if(!p.active||p.ghost||p.item||dist(b,p)>27)continue;
      p.item=b.item;
      // Independent of the inventory slot: announce what this player JUST
      // collected above their character, for a brief, readable interval.
      p.pickupNoticeItem=b.item;
       p.pickupNotice=ITEM_NAMES[b.item]||'ไอเทม';
      p.pickupNoticeTime=2.1;
      state.boxes.splice(i,1);
      break;
    }
  }
  state.boxClock-=dt;
  if(state.boxClock<=0){
    if(state.boxes.length<state.maxBoxes)
      state.boxes.push(newBox(players,state));
    state.boxClock=rand(6.5,11);
  }
}
function update(dt,round,players){
  const state=round.ghost;
  if(!state||!['countdown','playing'].includes(round.phase))return;
  state.time+=dt;
  // Players can move and juke DURING the 3-second warning.
  tickPlayers(dt,players,state);
  if(round.phase==='countdown')return null;
  advanceNpcs(dt,players,state);
  // Player ghosts convert people by touch, and pass obstacles completely.
  for(const spirit of players){
    if(!spirit.active||!spirit.ghost)continue;
    for(const person of players){
      if(person.active&&!person.ghost&&dist(person,spirit)<C.hitRadius+5)
        convert(person,state);
    }
  }
  updateTraps(dt,players,state);
  updateBoxes(dt,players,state);
  const live=survivors(players);
  if(live.length===1){
    state.winnerId=live[0].id;
    live[0].score=100000+Math.floor(live[0].survival*10);
    return 'winner';
  }
  if(live.length===0){
    // When two victims are hit in the same frame, the last one converted
    // was the last human, avoiding an unwinnable zero-survivor match.
    state.winnerId=state.converted.at(-1)||players[0]?.id||null;
    const last=players.find(p=>p.id===state.winnerId);
    if(last)last.score=100000+Math.floor(last.survival*10);
    return 'winner';
  }
  return null;
}
function itemStatus(players){
  return players.filter(p=>p.active).map(p=>({
    id:p.id,item:p.item||null,ghost:!!p.ghost,selecting:!!p.selecting,
    targetId:p.targetId||null,
    targetName:players.find(q=>q.id===p.targetId)?.name||'',
    targets:players.filter(q=>q.active&&q.id!==p.id).map(q=>({id:q.id,name:q.name}))
  }));
}
function hud(players,round){
  return {survivors:survivors(players).length,ghosts:players.filter(p=>p.active&&p.ghost).length+
    (round.ghost?.npcs.length||0),total:players.filter(p=>p.active).length};
}
function drawPerson(ctx,p,color,ghost,t,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;
  const x=p.x,y=p.y;
  ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(x,y+14,15,5,0,0,TAU);ctx.fill();
  if(ghost){
    ctx.shadowColor=color;ctx.shadowBlur=12;
    ctx.fillStyle=color;ctx.strokeStyle='#101729';ctx.lineWidth=3.5;
    ctx.beginPath();ctx.moveTo(x-15,y-8);ctx.arc(x,y-8,15,Math.PI,0);
    ctx.lineTo(x+15,y+13);
    for(let i=3;i>=0;i--){ctx.lineTo(x-15+i*10,y+12+(i%2?5:0));}
    ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#172039';ctx.beginPath();ctx.arc(x-5,y-9,2.8,0,TAU);
    ctx.arc(x+5,y-9,2.8,0,TAU);ctx.fill();
  }else{
    ctx.fillStyle=color;ctx.strokeStyle='#151b30';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y-17,10,0,TAU);ctx.fill();ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=7;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x,y+9);
    ctx.moveTo(x,y);ctx.lineTo(x-8,y+7);ctx.moveTo(x,y);ctx.lineTo(x+8,y+7);ctx.stroke();
  }
  if(p.stun>0){
    ctx.strokeStyle='#ffdc75';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y-16,23,0,TAU);ctx.stroke();
  }
  if(p.punchFX>0){ctx.strokeStyle='#ffe6a0';ctx.lineWidth=4;ctx.beginPath();
    ctx.arc(x,y,33,-.8,.7);ctx.stroke();}
  ctx.font='bold 13px system-ui';ctx.textAlign='center';
  ctx.strokeStyle='#081329';ctx.lineWidth=4;
  ctx.strokeText(p.name||'GHOST',x,y-39);
  ctx.fillStyle='#fff';ctx.fillText(p.name||'GHOST',x,y-39);
  ctx.restore();
}
function drawPickupNotice(ctx,p,w,h){
  if(!p.pickupNotice||p.pickupNoticeTime<=0)return;
  const elapsed=2.1-p.pickupNoticeTime;
  const y=clamp(p.y-66-elapsed*9,26,Math.max(26,h-48));
  const msg='ได้รับ: '+p.pickupNotice;
  const icon=getItemIconImage(p.pickupNoticeItem);
  const showIcon=!!(icon&&icon.complete&&icon.naturalWidth>0);
  ctx.save();
  ctx.globalAlpha=clamp(p.pickupNoticeTime/.38,0,1);
  ctx.textAlign='left';
  ctx.font='bold 15px system-ui';
  ctx.lineJoin='round';
  ctx.lineWidth=5;
  ctx.strokeStyle='#07192a';
  ctx.fillStyle='#ffe69b';
  const iconSize=18,gap=6;
  const textWidth=Math.min(220,ctx.measureText(msg).width);
  const totalWidth=textWidth+(showIcon?iconSize+gap:0);
  const half=totalWidth/2+8;
  const centerX=clamp(p.x,half,Math.max(half,w-half));
  const x=centerX-totalWidth/2;
  if(showIcon)ctx.drawImage(icon,x,y-14,iconSize,iconSize);
  const textX=x+(showIcon?iconSize+gap:0);
  ctx.strokeText(msg,textX,y,220);
  ctx.fillText(msg,textX,y,220);
  ctx.restore();
}
function draw(ctx,t,round,players){
  const state=round.ghost;if(!state)return;
  const w=state.world.w,h=state.world.h;
  ctx.save();ctx.clearRect(0,0,960,540);
  ctx.scale(960/w,540/h);
  const gradient=ctx.createLinearGradient(0,0,w,h);
  gradient.addColorStop(0,'#132b39');gradient.addColorStop(.55,'#193349');gradient.addColorStop(1,'#0c1e35');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#39616f32';ctx.lineWidth=1;
  for(let x=0;x<w;x+=54){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=54){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.fillStyle='#124358';ctx.strokeStyle='#5fcad183';ctx.lineWidth=6;
  ctx.fillRect(7,7,w-14,h-14);ctx.strokeRect(7,7,w-14,h-14);
  ctx.fillStyle=gradient;ctx.fillRect(16,16,w-32,h-32);
  for(const o of state.obstacles){
    ctx.fillStyle='#081d2d88';ctx.fillRect(o.x+6,o.y+7,o.w,o.h);
    ctx.fillStyle=o.style===0?'#768778':o.style===1?'#6d8396':'#576c88';
    ctx.strokeStyle='#182c37';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,7);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#ddf0ee4d';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(o.x+7,o.y+7);ctx.lineTo(o.x+o.w-7,o.y+7);ctx.stroke();
  }
  const center={x:w/2,y:h/2};
  ctx.save();ctx.strokeStyle='#c6eaff2c';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(center.x,center.y,70+5*Math.sin(t*2),0,TAU);ctx.stroke();
  ctx.fillStyle='#ceeaff19';ctx.beginPath();ctx.arc(center.x,center.y,62,0,TAU);ctx.fill();
  ctx.restore();
  for(const trap of state.traps){
    ctx.fillStyle='#2b1e29';ctx.strokeStyle='#f2a052';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(trap.x,trap.y,16,0,TAU);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(trap.x-9,trap.y-8);ctx.lineTo(trap.x+7,trap.y+8);
    ctx.moveTo(trap.x+9,trap.y-8);ctx.lineTo(trap.x-7,trap.y+8);ctx.stroke();
  }
  for(const b of state.boxes){
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.sin(t*2+b.x)*.08);
    ctx.shadowColor='#f8cf75';ctx.shadowBlur=14;ctx.fillStyle='#d59f51';ctx.strokeStyle='#fff0be';
    ctx.lineWidth=3;ctx.fillRect(-13,-13,26,26);ctx.strokeRect(-13,-13,26,26);
    ctx.shadowBlur=0;ctx.fillStyle='#4b3223';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText('?',0,7);ctx.restore();
  }
  if(state.ghostSpawned){
    for(const npc of state.npcs)drawPerson(ctx,{...npc,name:'ผี'},'#f5faff',true,t,npc.stun>0?.65:1);
  }
  for(const p of players){
    if(!p.active)continue;
    const alpha=p.cloak>0?.19:1;
    drawPerson(ctx,p,p.color,p.ghost,t,alpha);
    // Show the freshly obtained item above THIS player, not globally.
    drawPickupNotice(ctx,p,w,h);
    if(p.boost>0){ctx.save();ctx.strokeStyle=p.color;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(p.x,p.y,29,0,TAU);ctx.stroke();ctx.restore();}
  }
  // Slow-medicine target highlighting is visible on the host screen.
  for(const caster of players){
    if(!caster.active||!caster.selecting||caster.item!=='slow')continue;
    const target=players.find(p=>p.id===caster.targetId);
    if(!target)continue;
    ctx.save();ctx.strokeStyle=caster.color;ctx.lineWidth=5;
    ctx.shadowBlur=14;ctx.shadowColor=caster.color;ctx.beginPath();
    ctx.arc(target.x,target.y,31+2*Math.sin(t*7),0,TAU);ctx.stroke();ctx.restore();
  }
  // Match HUD belongs exclusively to the toolbar above the field. The arena
  // canvas intentionally contains no redundant counters or map instructions.
  ctx.restore();
}
window.GhostAttack={setup,update,draw,hud,itemStatus,cycleTarget,
  ITEM_NAMES,ITEM_SVG,getItemIconImage,constants:C};
})();
