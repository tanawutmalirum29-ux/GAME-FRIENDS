/* CHICKENS — host-authoritative top-down catch, carry, intercept and deposit. */
(() => {
'use strict';
const TAU=Math.PI*2;
// Scale movement and locomotion animation without changing round timers,
// punch cooldowns or the 0.30-second deposit rule.
const SPEED_SCALE=.70;
const C=Object.freeze({playerSpeed:172*SPEED_SCALE,chickenSpeed:191*SPEED_SCALE,
  idleChickenSpeed:96*SPEED_SCALE,panicChickenSpeed:217*SPEED_SCALE,
  chickenTurnRate:8.2*SPEED_SCALE,chickenFlapRate:16*SPEED_SCALE,
  playerStrideRate:13*SPEED_SCALE,playerRadius:15,chickenRadius:8.3,
  pickupRadius:26,carryOffset:37,headOffset:12,entryDepth:9,depositTime:.30,
  punchRange:57,punchHalfAngle:.86,punchCooldown:1,dropImmunity:.35});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=(x,y)=>Math.hypot(x,y);
const distance=(a,b)=>length(a.x-b.x,a.y-b.y);
const rand=(a,b)=>a+(b-a)*Math.random();
const unit=(x,y)=>{const d=length(x,y)||1;return {x:x/d,y:y/d};};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const normal=(angle)=>({x:Math.cos(angle),y:Math.sin(angle)});
const right=(v)=>({x:-v.y,y:v.x});
const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const inside=(state,x,y,margin=0)=>length(x-state.center.x,y-state.center.y)<=state.radius-margin+1e-6;
function bound(state,point,margin){
  const dx=point.x-state.center.x,dy=point.y-state.center.y;
  const l=length(dx,dy),r=state.radius-margin;
  if(l<=r)return;
  point.x=state.center.x+dx*r/l;
  point.y=state.center.y+dy*r/l;
}
function goalHead(player){
  const v=player.dir||{x:1,y:0};
  return {x:player.x+v.x*(C.carryOffset+C.headOffset),
    y:player.y+v.y*(C.carryOffset+C.headOffset)};
}
function penPosition(state,pen,radius,side=0){
  return {x:state.center.x+pen.normal.x*radius+pen.tangent.x*side,
    y:state.center.y+pen.normal.y*radius+pen.tangent.y*side};
}
function gateInside(state,pen,head){
  const relative={x:head.x-pen.gatePosition.x,y:head.y-pen.gatePosition.y};
  const depth=dot(relative,pen.gateNormal),side=dot(relative,pen.tangent);
  return depth>=pen.entryDepth && depth<=pen.depth-5 &&
    Math.abs(side)<=pen.gateWidth/2-C.chickenRadius*.45;
}
function freePosition(state,occupied,minDist=25){
  for(let attempt=0;attempt<320;attempt++){
    const a=rand(0,TAU),r=Math.sqrt(Math.random())*(state.radius-37);
    const p={x:state.center.x+Math.cos(a)*r,y:state.center.y+Math.sin(a)*r};
    if(occupied.every(q=>distance(p,q)>=minDist))return p;
  }
  // Crowded arena fallback: deterministic grid scan, never outside the ring.
  for(let y=state.center.y-state.radius+35;y<state.center.y+state.radius-35;y+=22)
    for(let x=state.center.x-state.radius+35;x<state.center.x+state.radius-35;x+=22){
      const p={x,y};
      if(inside(state,x,y,28)&&occupied.every(q=>distance(p,q)>=minDist*.67))return p;
    }
  return {x:state.center.x,y:state.center.y};
}
function makeChicken(state,players){
  const occupied=[...players.filter(p=>p.active),...state.chickens.filter(c=>c.status==='free')];
  const p=freePosition(state,occupied,23);
  const angle=rand(0,TAU),dir=normal(angle);
  return {id:++state.nextChickenId,x:p.x,y:p.y,dir,
    vx:dir.x*65*SPEED_SCALE,vy:dir.y*65*SPEED_SCALE,
    status:'free',carrierId:null,penId:null,depositPenId:null,depositFor:0,
    decision:rand(0,.18),escapeAngle:angle,invulnerable:0,flap:rand(0,TAU),stuckFor:0,
    panicFor:0,panicRecharge:rand(0,.35)};
}
function refillChickens(state,players){
  // Count carried chickens too: a dropped chicken cannot overflow the
  // 20-chicken live-world cap. Use only the reserve, never recycle a score.
  let active=state.chickens.reduce((n,c)=>
    n+(c.status==='free'||c.status==='carried'?1:0),0);
  while(active<state.spawnLimit&&state.remainingReserve>0){
    state.chickens.push(makeChicken(state,players));
    state.remainingReserve--;
    state.spawnedCount++;
    active++;
  }
}
function setup(round,players){
  const n=Math.max(1,Math.min(12,players.length));
  const world=n<=4?{w:960,h:540}:n<=8?{w:1200,h:675}:{w:1440,h:810};
  const center={x:world.w/2,y:world.h/2};
  // Include the whole outer pen within the fixed 16:9 world/canvas.
  const radius=Math.min(world.h*.365,world.w*.24);
  const pens=players.map((p,i)=>{
    const angle=-Math.PI/2+TAU*i/n;
    const v=normal(angle),t=right(v),gateWidth=n>=10?66:74;
    const gatePosition={x:center.x+v.x*(radius-2),y:center.y+v.y*(radius-2)};
    return {id:'pen-'+p.id,ownerId:p.id,color:p.color,name:p.name,
      angle,normal:v,gateNormal:v,tangent:t,gatePosition,gateWidth,
      entryDepth:C.entryDepth,depth:54,points:0};
  });
  // A finite per-round inventory. Only 20 can be active (running or carried)
  // at once; penned chickens are retired forever and never re-spawn.
  // Same generous flock budget for every room size (1–12 players).
  // Spawn only 20 at a time; scored birds never return to the reserve.
  const totalChickens=60;
  const state={world,center,radius,pens,chickens:[],nextChickenId:0,
    totalChickens,spawnLimit:Math.min(20,totalChickens),
    remainingReserve:totalChickens,spawnedCount:0,scoredCount:0,
    remaining:n<=4?20:n<=8?30:40,effects:[],time:0};
  for(const [i,p] of players.entries()){
    const a=-Math.PI/2+TAU*(i+.45)/n;
    const radial=Math.min(radius*.54,110);
    p.x=center.x+Math.cos(a)*radial;p.y=center.y+Math.sin(a)*radial;
    p.vx=0;p.vy=0;p.dir=normal(a);p.face=1;
    p.active=true;p.alive=true;p.score=0;p.ghost=false;p.stun=0;
    p.item=null;p.selecting=false;p.targetId=null;
    p.carriedChickenId=null;p.chickenAttackCooldown=0;p.chickenActionLatch=false;
    p.chickenPunchFlash=0;p.chickenBotGoal=null;
  }
  round.chickens=state;round.remaining=state.remaining;
  round.countdown=3;round.phase='countdown';
  refillChickens(state,players);
}
function dropChicken(state,p,force={x:0,y:0}){
  if(p.carriedChickenId==null)return;
  const chicken=state.chickens.find(c=>c.id===p.carriedChickenId);
  p.carriedChickenId=null;
  if(!chicken||chicken.status!=='carried'||chicken.carrierId!==p.id)return;
  const face=p.dir||{x:1,y:0};
  chicken.x=p.x+face.x*23+force.x*12;
  chicken.y=p.y+face.y*23+force.y*12;
  bound(state,chicken,C.chickenRadius+4);
  chicken.dir=unit(face.x+force.x,face.y+force.y);
  chicken.vx=chicken.dir.x*150;chicken.vy=chicken.dir.y*150;
  chicken.status='free';chicken.carrierId=null;chicken.penId=null;
  chicken.depositFor=0;chicken.depositPenId=null;
  chicken.invulnerable=C.dropImmunity;chicken.decision=0;
}
function chooseBotTarget(state,p,players){
  if(p.carriedChickenId!=null)return null;
  let best=null,bestCost=Infinity;
  for(const c of state.chickens){
    if(c.status!=='free'||c.invulnerable>0)continue;
    const d=distance(p,c),cost=d+Math.max(0,175-d)*.09;
    if(cost<bestCost){best=c;bestCost=cost;}
  }
  return best;
}
function botMove(state,p,players){
  let target,aim,attack=false;
  if(p.carriedChickenId!=null){
    const pen=state.pens.find(x=>x.ownerId===p.id)||state.pens[0];
    const point=penPosition(state,pen,state.radius-C.playerRadius-1);
    const dd=distance(p,point);
    if(dd<12){aim={x:0,y:0};p.dir=pen.normal;}
    else aim=unit(point.x-p.x,point.y-p.y);
  }else{
    target=chooseBotTarget(state,p,players);
    if(target){
      const prediction=Math.min(.38,distance(p,target)/500);
      const goal={x:target.x+target.vx*prediction,y:target.y+target.vy*prediction};
      aim=unit(goal.x-p.x,goal.y-p.y);
    }else aim={x:0,y:0};
    const attacker=players.find(q=>q!==p&&q.active&&q.carriedChickenId!=null&&
      distance(p,q)<C.punchRange&&dot(p.dir,unit(q.x-p.x,q.y-p.y))>.65);
    if(attacker)attack=true;
  }
  return {x:aim.x,y:aim.y,action:attack};
}
function movement(p){
  const input=p.input||{};
  let x=Number.isFinite(input.axisX)?clamp(input.axisX,-1,1):0;
  let y=Number.isFinite(input.axisY)?clamp(input.axisY,-1,1):0;
  if(Math.hypot(x,y)<.11){
    x=Number(!!input.right)-Number(!!input.left);
    y=Number(!!input.down)-Number(!!input.jump);
  }
  if(Math.hypot(x,y)>1){const v=unit(x,y);x=v.x;y=v.y;}
  return {x,y,action:input.action===true};
}
function moveCircle(state,p,vx,vy,dt,margin){
  // Project back onto the circle after continuous movement. Tangential
  // component remains smooth instead of stopping against an axis-aligned wall.
  p.x+=vx*dt;p.y+=vy*dt;
  bound(state,p,margin);
}
function punch(state,p,players){
  const face=p.dir||{x:1,y:0};
  for(const q of players){
    if(q===p||!q.active||q.carriedChickenId==null)continue;
    const d=distance(p,q);
    if(d>C.punchRange+C.playerRadius||d<.001)continue;
    if(dot(face,unit(q.x-p.x,q.y-p.y))<Math.cos(C.punchHalfAngle))continue;
    dropChicken(state,q,face);
    state.effects.push({x:q.x,y:q.y,text:'!',color:'#fff1a6',life:.46});
  }
}
function advancePlayer(state,p,players,dt){
  if(!p.active)return;
  const input=p.isBot?botMove(state,p,players):movement(p);
  if(input.x||input.y){
    p.dir=unit(input.x,input.y);p.face=p.dir.x<0?-1:1;
  }
  p.vx=input.x*C.playerSpeed;p.vy=input.y*C.playerSpeed;
  moveCircle(state,p,p.vx,p.vy,dt,C.playerRadius+1);
  p.chickenAttackCooldown=Math.max(0,(p.chickenAttackCooldown||0)-dt);
  p.chickenPunchFlash=Math.max(0,(p.chickenPunchFlash||0)-dt);
  if(!input.action)p.chickenActionLatch=false;
  if(input.action&&!p.chickenActionLatch){
    p.chickenActionLatch=true;
    if(p.chickenAttackCooldown<=0){
      p.chickenAttackCooldown=C.punchCooldown;
      p.chickenPunchFlash=.18;
      punch(state,p,players);
    }
  }
}
function separatePlayers(state,players){
  const living=players.filter(p=>p.active);
  for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){
    const a=living[i],b=living[j],dx=b.x-a.x,dy=b.y-a.y;
    const d=length(dx,dy);
    if(d>=C.playerRadius*2||d===0)continue;
    const n={x:dx/d,y:dy/d},shift=(C.playerRadius*2-d)*.5;
    a.x-=n.x*shift;a.y-=n.y*shift;b.x+=n.x*shift;b.y+=n.y*shift;
    bound(state,a,C.playerRadius+1);bound(state,b,C.playerRadius+1);
  }
}
function chooseEscape(state,c,players){
  const threatened=players.filter(p=>p.active&&distance(p,c)<215);
  const wallRoom=state.radius-distance(c,state.center);
  if(!threatened.length&&wallRoom>64){
    return Math.atan2(c.dir.y,c.dir.x)+rand(-.35,.35);
  }
  const current=Math.atan2(c.dir.y,c.dir.x);
  let best=current,bestScore=-Infinity;
  // Candidate-angle scoring accounts for predicted interception,
  // neighbors and available room in front of each possible turn.
  for(const offset of [0,-.42,.42,-.86,.86,-1.45,1.45,-2.15,2.15]){
    const a=current+offset,v=normal(a),travel=70;
    const pred={x:c.x+v.x*travel,y:c.y+v.y*travel};
    const wallClear=state.radius-distance(pred,state.center);
    let score=Math.min(120,wallClear)*.7-Math.max(0,24-wallClear)*8-Math.abs(offset)*5;
    for(const p of threatened){
      const future={x:p.x+(p.vx||0)*.38,y:p.y+(p.vy||0)*.38};
      const gap=distance(pred,future);
      const approach=dot(v,unit(p.x-c.x,p.y-c.y));
      score+=Math.min(175,gap)*.65-Math.max(0,95-gap)*2.2-approach*12;
    }
    // Prefer travelling tangentially around the circular fence.
    // Without this, an unthreatened chicken can press against the wall.
    const radial=unit(c.x-state.center.x,c.y-state.center.y);
    score-=Math.max(0,75-wallRoom)*Math.max(0,dot(v,radial))*1.9;
    for(const other of state.chickens){
      if(other===c||other.status!=='free'||distance(c,other)>45)continue;
      score-=Math.max(0,30-distance(pred,other))*.85;
    }
    if(score>bestScore){bestScore=score;best=a;}
  }
  return best;
}
function advanceChicken(state,c,players,dt){
  if(c.status!=='free')return;
  c.invulnerable=Math.max(0,c.invulnerable-dt);
  c.flap+=dt*C.chickenFlapRate;
  c.decision-=dt;
  const wallRoom=state.radius-distance(c,state.center);
  if(c.decision<=0||wallRoom<26){
    c.escapeAngle=chooseEscape(state,c,players);
    c.decision=wallRoom<26?.028:rand(.09,.19);
  }
  const old=Math.atan2(c.dir.y,c.dir.x);
  const delta=deltaAngle(old,c.escapeAngle);
  const angle=old+clamp(delta,-C.chickenTurnRate*dt,C.chickenTurnRate*dt);
  c.dir=normal(angle);
  const danger=players.some(p=>p.active&&distance(c,p)<205);
  const close=players.some(p=>p.active&&distance(c,p)<105);
  c.panicRecharge=Math.max(0,(c.panicRecharge||0)-dt);
  c.panicFor=Math.max(0,(c.panicFor||0)-dt);
  if(close&&c.panicRecharge<=0){
    c.panicFor=.23;
    c.panicRecharge=1.05;
    c.decision=0;
  }
  // Short acceleration pulses, frequent smooth evasive turns, and livelier
  // cruising; the burst is brief so humans and bots can still intercept.
  const speed=c.panicFor>0?C.panicChickenSpeed:danger?C.chickenSpeed:C.idleChickenSpeed;
  c.vx=c.dir.x*speed;c.vy=c.dir.y*speed;
  const oldX=c.x,oldY=c.y;
  moveCircle(state,c,c.vx,c.vy,dt,C.chickenRadius+2);
  if(length(c.x-oldX,c.y-oldY)<speed*dt*.18)c.stuckFor+=dt;
  else c.stuckFor=0;
  if(c.stuckFor>.35){
    const radial=unit(c.x-state.center.x,c.y-state.center.y);
    const tangent=right(radial);
    c.escapeAngle=Math.atan2(tangent.y,tangent.x)+rand(-.15,.15);
    c.decision=.32;c.stuckFor=0;
  }
  if(!inside(state,c.x+c.dir.x*22,c.y+c.dir.y*22,12))c.decision=0;
}
function separateChickens(state){
  const free=state.chickens.filter(c=>c.status==='free');
  for(let i=0;i<free.length;i++)for(let j=i+1;j<free.length;j++){
    const a=free[i],b=free[j],dx=b.x-a.x,dy=b.y-a.y,d=length(dx,dy);
    if(d>=C.chickenRadius*2+1)continue;
    const axis=d>1e-5?{x:dx/d,y:dy/d}:normal((i*31+j*13)*2.399963);
    const shift=(C.chickenRadius*2+1-d)*.5;
    a.x-=axis.x*shift;a.y-=axis.y*shift;
    b.x+=axis.x*shift;b.y+=axis.y*shift;
    bound(state,a,C.chickenRadius+2);bound(state,b,C.chickenRadius+2);
    a.decision=0;b.decision=0;
  }
}
function collect(state,c,p){
  if(p.carriedChickenId!=null||c.status!=='free'||c.invulnerable>0)return false;
  c.status='carried';c.carrierId=p.id;c.penId=null;c.depositFor=0;c.depositPenId=null;
  p.carriedChickenId=c.id;
  return true;
}
function scoreDeposit(state,c,p,pen){
  if(c.status!=='carried'||p.carriedChickenId!==c.id)return;
  c.status='penned';c.carrierId=null;c.penId=pen.id;c.depositFor=0;c.depositPenId=null;
  p.carriedChickenId=null;pen.points++;state.scoredCount++; 
  const owner=state.playersById&&state.playersById[pen.ownerId];
  if(owner)owner.score++;
  // Keep every penned chicken physically inside the fenced storage rectangle,
  // even if a player deposits far more than the initial flock size.
  const k=pen.points-1,col=k%5,row=Math.floor(k/5)%4;
  const side=(col-2)*(pen.gateWidth-22)/5;
  const target=penPosition(state,pen,state.radius+12+row*9,side);
  c.x=target.x;c.y=target.y;c.dir=pen.normal;c.vx=0;c.vy=0;
  state.effects.push({x:target.x,y:target.y,text:'+1',color:pen.color,life:.85});
}
function advanceDeposit(state,c,p,dt){
  const head=goalHead(p);
  const pen=state.pens.find(q=>gateInside(state,q,head));
  if(!pen){c.depositFor=0;c.depositPenId=null;return;}
  if(c.depositPenId!==pen.id){c.depositPenId=pen.id;c.depositFor=0;}
  c.depositFor+=dt;
  if(c.depositFor>=C.depositTime)scoreDeposit(state,c,p,pen);
}
function step(state,players,dt){
  state.playersById=Object.fromEntries(players.map(p=>[p.id,p]));
  const carriers=new Set(players.filter(p=>p.active).map(p=>p.id));
  for(const c of state.chickens)if(c.status==='carried'&&!carriers.has(c.carrierId)){
    const lost=state.playersById[c.carrierId];
    if(lost)dropChicken(state,lost);
    else{
      c.status='free';c.carrierId=null;c.depositFor=0;c.depositPenId=null;c.invulnerable=.35;
      bound(state,c,13);
    }
  }
  for(const p of players)advancePlayer(state,p,players,dt);
  separatePlayers(state,players);
  for(const c of state.chickens)advanceChicken(state,c,players,dt);
  separateChickens(state);
  // The host resolves every pickup sequentially, so a chicken has one carrier.
  for(const c of state.chickens)if(c.status==='free'&&c.invulnerable<=0){
    for(const p of players)if(p.active&&p.carriedChickenId==null&&
      distance(p,c)<=C.pickupRadius&&collect(state,c,p))break;
  }
  for(const c of state.chickens)if(c.status==='carried'){
    const p=state.playersById[c.carrierId];
    if(!p||!p.active)continue;
    const v=p.dir||{x:1,y:0};
    c.x=p.x+v.x*C.carryOffset;c.y=p.y+v.y*C.carryOffset;
    c.dir=v;advanceDeposit(state,c,p,dt);
  }
  state.effects=state.effects.filter(e=>(e.life-=dt)>0);
  refillChickens(state,players);
}
function update(dt,round,players){
  const state=round.chickens;
  if(!state||!['countdown','playing'].includes(round.phase))return null;
  if(round.phase==='countdown')return null;
  // Bounded fixed physics substeps preserve collision and the .30s gate rule.
  let remaining=clamp(dt,0,.1);
  while(remaining>1e-7){
    // Once every chicken is in a pen, finish before the clock reaches zero.
    // Empty *free* birds alone are insufficient: carried birds still count.
    if(state.scoredCount>=state.totalChickens)break;
    const sub=Math.min(1/60,remaining,state.remaining);
    if(sub<=0)break;
    state.time+=sub;step(state,players,sub);
    state.remaining=Math.max(0,state.remaining-sub);
    remaining-=sub;
  }
  round.remaining=state.remaining;
  return state.scoredCount>=state.totalChickens||state.remaining<=0?'winner':null;
}
function hud(players,round){
  const state=round.chickens;
  return {remaining:state?.remaining||0,free:state?.chickens.filter(c=>c.status==='free').length||0,
    total:players.filter(p=>p.active).length,flock:state?.totalChickens||0,
    left:(state?.totalChickens||0)-(state?.scoredCount||0)};
}
function drawChicken(ctx,c,t,scale=1){
  const angle=Math.atan2(c.dir.y,c.dir.x);
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(angle);ctx.scale(scale,scale);
  const bob=c.status==='free'?Math.sin(c.flap)*1.2:0;
  ctx.translate(0,bob);
  ctx.fillStyle='#fff6dc';ctx.strokeStyle='#a98255';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(0,0,13,9,0,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffdca5';
  ctx.beginPath();ctx.ellipse(-5,-1,6,5,-.6,0,TAU);ctx.fill();
  ctx.fillStyle='#fa644d';ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(-21,-7);
  ctx.lineTo(-17,5);ctx.fill();
  ctx.fillStyle='#fff6dc';ctx.beginPath();ctx.arc(10,-1,7,0,TAU);ctx.fill();
  ctx.fillStyle='#ed4a56';ctx.beginPath();ctx.arc(8,-8,3,0,TAU);ctx.arc(12,-8,3,0,TAU);ctx.fill();
  ctx.fillStyle='#ffc64b';ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(23,3);ctx.lineTo(16,5);ctx.fill();
  ctx.fillStyle='#293443';ctx.beginPath();ctx.arc(13,-2,1.7,0,TAU);ctx.fill();
  ctx.strokeStyle='#e8a93c';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-3,7);ctx.lineTo(-5,13);ctx.moveTo(5,7);ctx.lineTo(4,13);ctx.stroke();
  ctx.restore();
}
function drawPlayer(ctx,p,t){
  const v=p.dir||{x:1,y:0},theta=Math.atan2(v.y,v.x);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(theta);
  ctx.strokeStyle='#1b2738';ctx.lineWidth=5;ctx.lineCap='round';
  const stride=Math.sin(t*C.playerStrideRate+(Number(p.id?.replace(/\D/g,''))||0))*3;
  ctx.beginPath();ctx.moveTo(-9,-5);ctx.lineTo(-15,-10+stride);
  ctx.moveTo(-9,5);ctx.lineTo(-15,10-stride);ctx.stroke();
  ctx.fillStyle=p.color;ctx.strokeStyle='#24304a';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,0,13,11,0,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffe2ba';ctx.beginPath();ctx.arc(5,0,8,0,TAU);ctx.fill();
  ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.beginPath();
  if(p.carriedChickenId!=null){
    ctx.moveTo(1,-9);ctx.lineTo(20,-12);ctx.lineTo(34,-8);
    ctx.moveTo(1,9);ctx.lineTo(20,12);ctx.lineTo(34,8);
  }else if(p.chickenPunchFlash>0){
    ctx.moveTo(2,-9);ctx.lineTo(42,-10);
    ctx.moveTo(1,9);ctx.lineTo(11,16);
  }else{
    ctx.moveTo(0,-9);ctx.lineTo(15,-15);
    ctx.moveTo(0,9);ctx.lineTo(15,15);
  }
  ctx.stroke();ctx.restore();
  ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#0b1831';ctx.lineWidth=3;
  ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.strokeText(p.name||'',p.x,p.y-22);ctx.fillText(p.name||'',p.x,p.y-22);ctx.restore();
}
function drawPen(ctx,state,pen,t){
  const inner=penPosition(state,pen,state.radius-2);
  const outer=penPosition(state,pen,state.radius+pen.depth-8);
  const half=pen.gateWidth/2;
  const at=(p,d)=>({x:p.x+pen.tangent.x*d,y:p.y+pen.tangent.y*d});
  const a=at(inner,-half),b=at(inner,half),c=at(outer,half),d=at(outer,-half);
  ctx.save();ctx.fillStyle=pen.color+'35';ctx.strokeStyle=pen.color;ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(d.x,d.y);ctx.lineTo(c.x,c.y);ctx.lineTo(b.x,b.y);
  ctx.closePath();ctx.fill();
  // Both solid side fences and back fence. Front opening is never blocked.
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(d.x,d.y);ctx.lineTo(c.x,c.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  for(const pos of [a,b,d,c]){
    ctx.fillStyle='#e8c28b';ctx.beginPath();ctx.arc(pos.x,pos.y,5.5,0,TAU);ctx.fill();
  }
  ctx.strokeStyle=pen.color+'99';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  const label=penPosition(state,pen,state.radius+pen.depth-11);
  ctx.save();ctx.translate(label.x,label.y);
  ctx.fillStyle='#ffffff';ctx.strokeStyle='#202b40';ctx.lineWidth=3;
  ctx.font='bold 13px sans-serif';ctx.textAlign='center';
  ctx.strokeText(pen.name+' '+pen.points,0,0);
  ctx.fillText(pen.name+' '+pen.points,0,0);ctx.restore();
  ctx.restore();
}
function draw(ctx,time,round,players){
  const s=round.chickens;if(!s)return;
  const w=s.world.w,h=s.world.h;
  ctx.save();ctx.clearRect(0,0,960,540);ctx.scale(960/w,540/h);
  ctx.fillStyle='#152f36';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#42784d';ctx.strokeStyle='#d9ba83';ctx.lineWidth=7;
  ctx.beginPath();ctx.arc(s.center.x,s.center.y,s.radius,0,TAU);ctx.fill();ctx.stroke();
  ctx.save();ctx.strokeStyle='#e4f2cf2d';ctx.lineWidth=2;
  for(let r=75;r<s.radius-10;r+=75){
    ctx.beginPath();ctx.arc(s.center.x,s.center.y,r,0,TAU);ctx.stroke();
  }ctx.restore();
  for(const pen of s.pens)drawPen(ctx,s,pen,time);
  // Pen residents remain visible and inert, never re-entering the arena.
  for(const c of s.chickens)if(c.status==='penned')drawChicken(ctx,c,time,.66);
  for(const c of s.chickens)if(c.status==='free')drawChicken(ctx,c,time,.82);
  for(const p of players)if(p.active){
    drawPlayer(ctx,p,time);
    const c=s.chickens.find(q=>q.id===p.carriedChickenId&&q.status==='carried');
    if(c){
      drawChicken(ctx,c,time,.82);
      if(c.depositPenId&&c.depositFor>0){
        ctx.save();ctx.strokeStyle='#ffee7a';ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(c.x,c.y,18,-Math.PI/2,-Math.PI/2+
          TAU*Math.min(1,c.depositFor/C.depositTime));ctx.stroke();ctx.restore();
      }
    }
  }
  for(const e of s.effects){
    ctx.save();ctx.globalAlpha=Math.min(1,e.life*1.7);ctx.fillStyle=e.color;
    ctx.font='bold 25px sans-serif';ctx.textAlign='center';
    ctx.fillText(e.text,e.x,e.y-e.life*24);ctx.restore();
  }
  ctx.fillStyle='#101d31de';ctx.fillRect(12,12,228,65);
  ctx.fillStyle='#ffffff';ctx.font='bold 23px sans-serif';ctx.textAlign='left';
  ctx.fillText(round.phase==='countdown'?Math.ceil(round.countdown)+'':'เวลา '+Math.ceil(s.remaining),22,38);
  ctx.font='14px sans-serif';ctx.fillStyle='#b9f0d9';
  ctx.fillText('ไก่สนาม '+s.chickens.filter(c=>c.status==='free').length+' · เหลือ '+(s.totalChickens-s.scoredCount)+'/'+s.totalChickens,22,61);
  ctx.restore();
}
window.Chickens=Object.freeze({setup,update,draw,hud,dropChicken,gateInside,goalHead,
  constants:C});
})();
