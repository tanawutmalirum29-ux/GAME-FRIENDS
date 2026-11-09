/* CHICKENS — host-authoritative top-down catch, carry, intercept and deposit. */
(() => {
'use strict';
const TAU=Math.PI*2;
const Combat=window.PartyCombatMotion;
// Scale movement and locomotion animation without changing round timers,
// punch cooldowns or the 0.15-second deposit rule.
const SPEED_SCALE=.70;
const C=Object.freeze({playerSpeed:172*SPEED_SCALE,chickenSpeed:191*SPEED_SCALE,
  idleChickenSpeed:96*SPEED_SCALE,panicChickenSpeed:217*SPEED_SCALE,
  chickenTurnRate:8.2*SPEED_SCALE,chickenFlapRate:16*SPEED_SCALE,
  playerStrideRate:13*SPEED_SCALE,playerRadius:15,chickenRadius:8.3,
  pickupRadius:26,carryOffset:37,headOffset:12,entryDepth:9,depositTime:.15,
  punchRange:57,punchHalfAngle:.86,punchCooldown:Combat.ATTACK.cooldown,dropImmunity:.35});
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
  const v=player.dir||{x:1,y:0},u=player.chickenUnit||1;
  return {x:player.x+v.x*(C.carryOffset+C.headOffset)*u,
    y:player.y+v.y*(C.carryOffset+C.headOffset)*u};
}
function penPosition(state,pen,radius,side=0){
  return {x:state.center.x+pen.normal.x*radius+pen.tangent.x*side,
    y:state.center.y+pen.normal.y*radius+pen.tangent.y*side};
}
function gateInside(state,pen,head){
  const relative={x:head.x-pen.gatePosition.x,y:head.y-pen.gatePosition.y};
  const depth=dot(relative,pen.gateNormal),side=dot(relative,pen.tangent);
  return depth>=pen.entryDepth && depth<=pen.depth-5 &&
    Math.abs(side)<=pen.gateWidth/2-C.chickenRadius*pen.unit*.45;
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
  const p=freePosition(state,occupied,23*state.unit);
  const angle=rand(0,TAU),dir=normal(angle);
  return {id:++state.nextChickenId,x:p.x,y:p.y,dir,
    vx:dir.x*65*SPEED_SCALE*state.unit,vy:dir.y*65*SPEED_SCALE*state.unit,
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
function penLayout(center,radius,world,players){
  const n=players.length,u=world.w/960;
  // Four broad corner yards in small rooms; separate radial pens for crowds.
  const smallAngles=n===1?[-3*Math.PI/4]:n===2?[-3*Math.PI/4,Math.PI/4]:
    n===3?[-3*Math.PI/4,-Math.PI/4,Math.PI/2]:[-3*Math.PI/4,-Math.PI/4,3*Math.PI/4,Math.PI/4];
  return players.map((p,i)=>{
    const angle=n<=4?smallAngles[i]:-Math.PI/2+TAU*i/n;
    const v=normal(angle),t=right(v),gateWidth=(n>=10?66:74)*u;
    const gatePosition={x:center.x+v.x*(radius-2),y:center.y+v.y*(radius-2)};
    const pen={id:'pen-'+p.id,ownerId:p.id,color:p.color,name:p.name,
      angle,normal:v,gateNormal:v,tangent:t,gatePosition,gateWidth,
      entryDepth:C.entryDepth*u,depth:n<=4?96:n<=8?78:96,width:(n<=8?126:140)*Math.min(u,1.1),points:0,slots:[],unit:u};
    if(n<=4&&!(n===3&&i===2)){
      const left=v.x<0,top=v.y<0;
      pen.rect={x:(left?150:556)*u,y:(top?26:291)*u,w:254*u,h:223*u};
      for(let y=pen.rect.y+19*u;y<pen.rect.y+pen.rect.h-17*u;y+=23*u)
        for(let x=pen.rect.x+19*u;x<pen.rect.x+pen.rect.w-17*u;x+=23*u)
          if(length(x-center.x,y-center.y)>radius+19*u)pen.slots.push({x,y});
    }else{
      if(n===3){pen.depth=58;pen.width=180;}
      const point=(depth,side)=>({x:gatePosition.x+v.x*depth+t.x*side,y:gatePosition.y+v.y*depth+t.y*side});
      pen.corners=[point(0,-pen.width/2),point(pen.depth,-pen.width/2),point(pen.depth,pen.width/2),point(0,pen.width/2)];
      const columns=n===3?8:n<=8?7:9,rows=Math.ceil((n*5+1)/columns);
      for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)
        pen.slots.push(point(16+row*(pen.depth-32)/(rows-1),(col-(columns-1)/2)*(pen.width-30)/(columns-1)));
    }
    return pen;
  });
}
function setup(round,players){
  const n=Math.max(1,Math.min(12,players.length));
  const world=n<=4?{w:960,h:540}:n<=8?{w:1200,h:675}:{w:1440,h:810};
  const unit=world.w/960;
  const center={x:world.w/2,y:world.h/2};
  // Include the whole outer pen within the fixed 16:9 world/canvas.
  const radius=Math.min(world.h*.365,world.w*.24);
  const pens=penLayout(center,radius,world,players);
  // A finite per-round inventory. Only 20 can be active (running or carried)
  // at once; penned chickens are retired forever and never re-spawn.
  // Use 5 per player plus one deciding chicken. The total is never
  // divisible by the party size, so equal scores for ALL players are
  // impossible if every chicken is deposited. Leading ties remain legal.
  // Spawn only 20 at a time; scored birds never return to the reserve.
  const totalChickens=n*5+1;
  const state={world,unit,center,radius,pens,chickens:[],nextChickenId:0,
    totalChickens,spawnLimit:Math.min(20,totalChickens),
    remainingReserve:totalChickens,spawnedCount:0,scoredCount:0,
    remaining:n<=4?20:n<=8?30:40,effects:[],time:0};
  for(const [i,p] of players.entries()){
    const a=-Math.PI/2+TAU*(i+.45)/n;
    const radial=Math.min(radius*.54,110*unit);
    p.x=center.x+Math.cos(a)*radial;p.y=center.y+Math.sin(a)*radial;
    p.vx=0;p.vy=0;p.dir=normal(a);p.face=1;p.chickenUnit=unit;
    p.active=true;p.alive=true;p.score=0;p.ghost=false;p.stun=0;
    p.item=null;p.selecting=false;p.targetId=null;
    p.carriedChickenId=null;p.chickenAttackCooldown=0;p.chickenActionLatch=false;
  p.punchCooldown=0;Combat.reset(p);
    p.chickenPunchFlash=0;p.chickenBotGoal=null;
  }
  round.chickens=state;round.remaining=state.remaining;
  round.countdown=3;round.phase='countdown';
  refillChickens(state,players);
  window.FarmIceArt?.preload('farm');
}
function dropChicken(state,p,force={x:0,y:0}){
  if(p.carriedChickenId==null)return;
  const chicken=state.chickens.find(c=>c.id===p.carriedChickenId);
  p.carriedChickenId=null;
  if(!chicken||chicken.status!=='carried'||chicken.carrierId!==p.id)return;
  const face=p.dir||{x:1,y:0};
  chicken.x=p.x+(face.x*23+force.x*12)*state.unit;
  chicken.y=p.y+(face.y*23+force.y*12)*state.unit;
  bound(state,chicken,(C.chickenRadius+4)*state.unit);
  chicken.dir=unit(face.x+force.x,face.y+force.y);
  chicken.vx=chicken.dir.x*150*state.unit;chicken.vy=chicken.dir.y*150*state.unit;
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
    const point=penPosition(state,pen,state.radius-(C.playerRadius+1)*state.unit);
    const dd=distance(p,point);
    if(dd<12*state.unit){aim={x:0,y:0};p.dir=pen.normal;}
    else aim=unit(point.x-p.x,point.y-p.y);
  }else{
    target=chooseBotTarget(state,p,players);
    if(target){
      const prediction=Math.min(.38,distance(p,target)/500);
      const goal={x:target.x+target.vx*prediction,y:target.y+target.vy*prediction};
      aim=unit(goal.x-p.x,goal.y-p.y);
    }else aim={x:0,y:0};
    const attacker=players.find(q=>q!==p&&q.active&&q.carriedChickenId!=null&&
      distance(p,q)<C.punchRange*state.unit&&dot(p.dir,unit(q.x-p.x,q.y-p.y))>.65);
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
 // The shared normal punch stuns ALL touched friends for 0.8 seconds.
 // Chicken-specific rule: anyone struck while carrying drops their chicken.
 return window.PartyCharacters.punchFriends(p,players,{
   range:(C.punchRange+C.playerRadius)*state.unit,coneCos:Math.cos(C.punchHalfAngle),
   onHit:q=>{
     if(q.carriedChickenId!=null)dropChicken(state,q,p.dir||{x:1,y:0});
     state.effects.push({x:q.x,y:q.y,text:'!',color:p.color,life:.46});
   }
 });
}
function advancePlayer(state,p,players,dt){
 if(!p.active)return;
 p.stun=Math.max(0,(p.stun||0)-dt);
 p.punchCooldown=Math.max(0,(p.punchCooldown||0)-dt);
 p.chickenAttackCooldown=p.punchCooldown;
 const wasAttacking=Combat.isAttacking(p);
 if(wasAttacking)window.PartyCharacters.stepPunch(p,dt,()=>punch(state,p,players));
 const input=p.isBot?botMove(state,p,players):movement(p);
 const canMove=p.stun<=0&&!wasAttacking&&!Combat.isAttacking(p);
 if(canMove&&(input.x||input.y)){
   p.dir=unit(input.x,input.y);p.face=p.dir.x<0?-1:1;
 }
 p.vx=canMove?input.x*C.playerSpeed*state.unit:0;
 p.vy=canMove?input.y*C.playerSpeed*state.unit:0;
 moveCircle(state,p,p.vx,p.vy,dt,(C.playerRadius+1)*state.unit);
 p.chickenPunchFlash=Math.max(0,(p.chickenPunchFlash||0)-dt);
 if(!input.action)p.chickenActionLatch=false;
 if(input.action&&!p.chickenActionLatch){
   p.chickenActionLatch=true;
   if(p.stun<=0&&window.PartyCharacters.startPunch(p)){
     p.chickenAttackCooldown=p.punchCooldown;
     p.chickenPunchFlash=Combat.TOTAL;
   }
 }
}
function separatePlayers(state,players){
 return window.PartyCharacters.resolve(players,{
   radius:C.playerRadius*state.unit,iterations:5,
   constrain:(p,x,y,r)=>{
     const dx=x-state.center.x,dy=y-state.center.y;
     const distance=Math.hypot(dx,dy),limit=Math.max(0,state.radius-r-1);
     if(distance<=limit)return {x,y};
     if(distance<1e-8)return {x:state.center.x,y:state.center.y};
     return {x:state.center.x+dx*limit/distance,
       y:state.center.y+dy*limit/distance};
   }
 });
}
function chooseEscape(state,c,players){
  const threatened=players.filter(p=>p.active&&distance(p,c)<215*state.unit);
  const wallRoom=state.radius-distance(c,state.center);
  if(!threatened.length&&wallRoom>64*state.unit){
    return Math.atan2(c.dir.y,c.dir.x)+rand(-.35,.35);
  }
  const current=Math.atan2(c.dir.y,c.dir.x);
  let best=current,bestScore=-Infinity;
  // Candidate-angle scoring accounts for predicted interception,
  // neighbors and available room in front of each possible turn.
  for(const offset of [0,-.42,.42,-.86,.86,-1.45,1.45,-2.15,2.15]){
    const a=current+offset,v=normal(a),travel=70*state.unit;
    const pred={x:c.x+v.x*travel,y:c.y+v.y*travel};
    const wallClear=state.radius-distance(pred,state.center);
    let score=Math.min(120*state.unit,wallClear)*.7-Math.max(0,24*state.unit-wallClear)*8-Math.abs(offset)*5*state.unit;
    for(const p of threatened){
      const future={x:p.x+(p.vx||0)*.38,y:p.y+(p.vy||0)*.38};
      const gap=distance(pred,future);
      const approach=dot(v,unit(p.x-c.x,p.y-c.y));
      score+=Math.min(175*state.unit,gap)*.65-Math.max(0,95*state.unit-gap)*2.2-approach*12*state.unit;
    }
    // Prefer travelling tangentially around the circular fence.
    // Without this, an unthreatened chicken can press against the wall.
    const radial=unit(c.x-state.center.x,c.y-state.center.y);
    score-=Math.max(0,75*state.unit-wallRoom)*Math.max(0,dot(v,radial))*1.9;
    for(const other of state.chickens){
      if(other===c||other.status!=='free'||distance(c,other)>45*state.unit)continue;
      score-=Math.max(0,30*state.unit-distance(pred,other))*.85;
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
  if(c.decision<=0||wallRoom<26*state.unit){
    c.escapeAngle=chooseEscape(state,c,players);
    c.decision=wallRoom<26*state.unit ? .028 : rand(.09,.19);
  }
  const old=Math.atan2(c.dir.y,c.dir.x);
  const delta=deltaAngle(old,c.escapeAngle);
  const angle=old+clamp(delta,-C.chickenTurnRate*dt,C.chickenTurnRate*dt);
  c.dir=normal(angle);
  const danger=players.some(p=>p.active&&distance(c,p)<205*state.unit);
  const close=players.some(p=>p.active&&distance(c,p)<105*state.unit);
  c.panicRecharge=Math.max(0,(c.panicRecharge||0)-dt);
  c.panicFor=Math.max(0,(c.panicFor||0)-dt);
  if(close&&c.panicRecharge<=0){
    c.panicFor=.23;
    c.panicRecharge=1.05;
    c.decision=0;
  }
  // Short acceleration pulses, frequent smooth evasive turns, and livelier
  // cruising; the burst is brief so humans and bots can still intercept.
  const speed=(c.panicFor>0?C.panicChickenSpeed:danger?C.chickenSpeed:C.idleChickenSpeed)*state.unit;
  c.vx=c.dir.x*speed;c.vy=c.dir.y*speed;
  const oldX=c.x,oldY=c.y;
  moveCircle(state,c,c.vx,c.vy,dt,(C.chickenRadius+2)*state.unit);
  if(length(c.x-oldX,c.y-oldY)<speed*dt*.18)c.stuckFor+=dt;
  else c.stuckFor=0;
  if(c.stuckFor>.35){
    const radial=unit(c.x-state.center.x,c.y-state.center.y);
    const tangent=right(radial);
    c.escapeAngle=Math.atan2(tangent.y,tangent.x)+rand(-.15,.15);
    c.decision=.32;c.stuckFor=0;
  }
  if(!inside(state,c.x+c.dir.x*22*state.unit,c.y+c.dir.y*22*state.unit,12*state.unit))c.decision=0;
}
function separateChickens(state){
  const free=state.chickens.filter(c=>c.status==='free');
  for(let i=0;i<free.length;i++)for(let j=i+1;j<free.length;j++){
    const a=free[i],b=free[j],dx=b.x-a.x,dy=b.y-a.y,d=length(dx,dy);
    if(d>=(C.chickenRadius*2+1)*state.unit)continue;
    const axis=d>1e-5?{x:dx/d,y:dy/d}:normal((i*31+j*13)*2.399963);
    const shift=((C.chickenRadius*2+1)*state.unit-d)*.5;
    a.x-=axis.x*shift;a.y-=axis.y*shift;
    b.x+=axis.x*shift;b.y+=axis.y*shift;
    bound(state,a,(C.chickenRadius+2)*state.unit);bound(state,b,(C.chickenRadius+2)*state.unit);
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
  const target=pen.slots[pen.points-1];
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
      bound(state,c,13*state.unit);
    }
  }
  for(const p of players)advancePlayer(state,p,players,dt);
  separatePlayers(state,players);
  for(const c of state.chickens)advanceChicken(state,c,players,dt);
  separateChickens(state);
  // The host resolves every pickup sequentially, so a chicken has one carrier.
  for(const c of state.chickens)if(c.status==='free'&&c.invulnerable<=0){
    for(const p of players)if(p.active&&p.stun<=0&&p.carriedChickenId==null&&
      distance(p,c)<=C.pickupRadius*state.unit&&collect(state,c,p))break;
  }
  for(const c of state.chickens)if(c.status==='carried'){
    const p=state.playersById[c.carrierId];
    if(!p||!p.active)continue;
    const v=p.dir||{x:1,y:0};
    c.x=p.x+v.x*C.carryOffset*state.unit;c.y=p.y+v.y*C.carryOffset*state.unit;
    c.dir=v;advanceDeposit(state,c,p,dt);
  }
  state.effects=state.effects.filter(e=>(e.life-=dt)>0);
  refillChickens(state,players);
}
function update(dt,round,players){
  const state=round.chickens;
  if(!state||!['countdown','playing'].includes(round.phase))return null;
  if(round.phase==='countdown')return null;
  // Bounded fixed physics substeps preserve collision and the .15s gate rule.
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
 window.FarmIceArt.chicken(ctx,c,t,scale);
}
function drawHeldChicken(ctx,chicken,player,t){
 // The SVG beak is 12 units in front of the carried bird's physical center,
 // matching goalHead() in every facing direction, without a screen-up offset.
 window.FarmIceArt.heldChicken(ctx,chicken,player,t);
}
function drawPlayer(ctx,p,t,unit=1){
 // Avatar, punch arc and attacker-coloured stun halo all use the same
 // world-space unit, so no VFX appears smaller than its physical attack.
 window.PartyCharacters.draw(ctx,p,{time:t,scale:unit,combat:false,
   holding:p.carriedChickenId!=null,attacking:Combat.isAttacking(p),label:false});
 ctx.save();
 ctx.translate(p.x,p.y);ctx.scale(unit,unit);ctx.translate(-p.x,-p.y);
 Combat.drawAttack(ctx,p);Combat.drawStun(ctx,p,t);
 ctx.restore();
}
function draw(ctx,time,round,players){
  const s=round.chickens;if(!s)return;
  const w=s.world.w,h=s.world.h;
  ctx.save();window.FarmIceArt.beginScene(ctx,'#91c631',{fullWidth:true});ctx.scale(960/w,540/h);
  window.FarmIceArt.farm(ctx,s);
  // Pen residents remain visible and inert, never re-entering the arena.
  for(const c of s.chickens)if(c.status==='penned'){
    const crowded=s.pens.find(p=>p.id===c.penId)?.points>20;
    drawChicken(ctx,c,time,(crowded ? .54 : .70)*s.unit);
  }
  for(const c of s.chickens)if(c.status==='free')drawChicken(ctx,c,time,.82*s.unit);
  for(const p of players)if(p.active){
    drawPlayer(ctx,p,time,s.unit);
    const c=s.chickens.find(q=>q.id===p.carriedChickenId&&q.status==='carried');
    if(c){
      window.FarmIceArt.heldChicken(ctx,c,p,time,s.unit);
      if(c.depositPenId&&c.depositFor>0){
        ctx.save();ctx.strokeStyle='#ffee7a';ctx.lineWidth=4*s.unit;
        ctx.beginPath();ctx.arc(c.x,c.y,18*s.unit,-Math.PI/2,-Math.PI/2+
          TAU*Math.min(1,c.depositFor/C.depositTime));ctx.stroke();ctx.restore();
      }
    }
  }
  for(const e of s.effects){
    ctx.save();ctx.globalAlpha=Math.min(1,e.life*1.7);ctx.fillStyle=e.color;
    ctx.font='bold 25px sans-serif';ctx.textAlign='center';
    ctx.fillText(e.text,e.x,e.y-e.life*24);ctx.restore();
  }
  // Per-mode top-left HUD was removed; player score stays in the roster.
  ctx.restore();
}
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const value=Number(p.score)||0;
  return {id:p.id,value,label:value+" ไก่"};
 });
}
// Game-specific roster presentation stays with its pinned engine revision.
function renderRoster(root,active,round){

    active.sort((a,b)=>b.score-a.score).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip chicken-leader';
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;name.title=p.name;
      const score=document.createElement('small');score.className='leader-role';score.textContent=p.score+' คะแนน';
      const info=document.createElement('span');info.className='leader-item-slot';info.textContent=p.carriedChickenId!=null?'กำลังอุ้มไก่':'—';
      box.append(color,name,score,info);root.append(box);
    });
    return;
  
}
window.Chickens=Object.freeze({renderRoster,getResult,resultTitle:"จับไก่ให้ได้มากที่สุด!",countdownSeconds:3,setup,update,draw,hud,dropChicken,gateInside,goalHead,drawHeldChicken,
  constants:C});
})();
