/* Host-authoritative session state, separate from every minigame's player data. */
(() => {
'use strict';
const M=()=>window.BoardMap,D=()=>window.BoardDice,I=()=>window.BoardItems;
const MAX_HP=100;
const INTRO_OVERVIEW_SECONDS=2,INTRO_ZOOM_SECONDS=1.5;
const LUCKY_SPIN_SECONDS=2,LUCKY_HOLD_SECONDS=1.4; // Previous .6-second result hold + .8 seconds.
const DAMAGE=Object.freeze({sword:12,car:18,bomber:26,skull:35,event:14});
const HEAL=Object.freeze({tile:20,event:15,potion:50});
let serial=0;
function create(roster,{seed=Date.now(),rng=Math.random}={}){
 if(!roster.length||roster.length>12)throw Error('BOARD PARTY needs 1–12 players');
 const s={id:'board-'+seed+'-'+(++serial),map:M().create(seed),rng,players:roster.map(p=>({id:p.id,name:p.name,color:p.color,costume:window.PartyPlayerAvatar?.costumeFor(p)||p.costume,isBot:!!p.isBot,currentNodeId:'n0',hp:MAX_HP,item:null,bag:[],bagOpen:false,bagIndex:0,actionIndex:0,bagMessage:'',usedRound:0,shieldTurns:0,dice:null,rollAt:0})),order:[],turnIndex:0,roundNumber:1,time:0,revision:0,turnId:'',inputs:{},lastActions:{},phase:'',deadline:0,rolled:false,move:null,skill:null,effect:null,lucky:null,luckyGrantKey:null,results:[],pendingItems:{},winnerIds:[],hits:[],heals:[],camera:{x:900,y:1400,zoom:.2,explore:true,overview:true},lastMinigame:null};
 s.camera.x=s.map.width/2;s.camera.y=s.map.height/2;
 phase(s,'overview',INTRO_OVERVIEW_SECONDS);return s;
}
function beginOrder(s){
 if(s.phase!=='intro_zoom'||s.time+1e-6<s.deadline)return false;
 s.camera.overview=false;s.camera.explore=false;
 s.camera.introFrom=null;
 phase(s,'order',12);return true;
}
function beginIntroZoom(s){
 if(s.phase!=='overview')return false;
 const c=s.camera;
 c.introFrom={x:c.x,y:c.y,zoom:c.zoom};
 c.overview=false;c.explore=false;c.manualZoom=null;c.panned=false;
 phase(s,'intro_zoom',INTRO_ZOOM_SECONDS);
 return true;
}
function phase(s,name,duration=0){s.phase=name;s.phaseAt=s.time;s.deadline=s.time+duration;s.turnId=s.id+':'+(++s.revision);}
// A continuous walk owns one input token until it lands; holding the stick
// across a node must not wait for a network round trip or require another tap.
function movePhase(s,name,duration=8){
 if(s.move?.kind!=='walk'){phase(s,name,duration);return;}
 // Manual walking, pausing and choosing a branch cannot trigger an autoplay timer.
 s.phase=name;s.phaseAt=s.time;s.deadline=Infinity;
}
const current=s=>s.players.find(p=>p.id===s.order[s.turnIndex]);
function axes(s,id){const a=s.inputs[id];return a&&s.time-a.at<.9?{x:a.x,y:a.y}:{x:0,y:0};}
function rollOrder(s,p){if(p.dice||s.phase!=='order')return false;p.dice=[D().roll(s.rng),D().roll(s.rng)];p.rollAt=s.time;return true;}
function ready(s,extend=true){s.move=null;s.skill=null;for(const p of s.players){p.bagOpen=false;if(p.id===current(s)?.id){p.actionIndex=0;p.bagMessage='';}}if(extend)s.readyDeadline=s.time+12;phase(s,'ready',Math.max(.1,s.readyDeadline-s.time));}
function startTurn(s){s.camera.overview=false;s.camera.explore=false;s.rolled=false;s.die=null;s.moveDice=null;s.move=null;s.skill=null;ready(s);}
function endTurn(s){
 if(s.phase==='finished')return;
 // Count the shield's owner's completed turns, regardless of round reordering.
 const p=current(s);if(p?.shieldTurns>0)p.shieldTurns--;
 s.move=null;s.skill=null;s.effect=null;s.lucky=null;s.turnIndex++;
 if(s.turnIndex>=s.order.length){phase(s,'minigame_pending');return;}
 startTurn(s);
}
function effect(s,fx,duration){s.effect={...fx,duration,at:s.time};phase(s,'effect',duration);}
function damage(s,p,amount){
 if(p.shieldTurns>0){p.blockedUntil=s.time+1.2;return false;}
 const actual=Math.min(p.hp,Math.max(0,Math.round(amount)));
 if(!actual)return false;
 const position=I().position(s,p);
 p.hp=Math.max(0,p.hp-actual);p.hurtUntil=s.time+1.2;
 s.hits.push({id:p.id,amount:actual,at:s.time,position,color:p.color});
 if(s.hits.length>32)s.hits.shift();
 if(p.hp)return false;
 p.death={at:s.time,position};
 p.currentNodeId=s.map.startId;delete p.worldPosition;p.hp=MAX_HP;p.shieldTurns=0;
 // Inventory and claimed sword tiles survive this respawn.
 if(current(s)?.id===p.id){s.move=null;s.skill=null;}
 return true;
}
function win(s,p){
 if(p.currentNodeId!==s.map.finishId)return;
 if(s.phase==='finished'){if(s.time===s.phaseAt&&!s.winnerIds.includes(p.id))s.winnerIds.push(p.id);return;}
 s.winnerIds=[p.id];s.move=null;s.skill=null;phase(s,'finished');
}
function land(s,applyTile=true){
 const m=s.move,p=current(s);
 if(m?.kind==='walk')p.worldPosition=I().position(s,p);
 s.move=null;
 if(p.currentNodeId===s.map.finishId){win(s,p);return;}
 const n=s.map.nodes[p.currentNodeId];let dead=false,kind='land';
 if(!applyTile){
  effect(s,{kind:'land',points:[I().position(s,p)],targets:[p.id],
   next:m?.kind==='rocket'?'ready':'end'},.5);return;
 }
 if(n.type==='lucky'){
  // Only a final landing is eligible; grant once per player turn. Stacked
  // duplicates are legitimate backpack entries, never replacements.
  // A rocket may land on one Lucky Star, then its bonus roll may reach
  // another Lucky Star within the same turn. Each DISTINCT landing pays once.
  const grantKey=s.roundNumber+':'+s.turnIndex+':'+p.id+':'+n.id;
  if(s.luckyGrantKey===grantKey){
   // A defensive repeated landing must not leave phase=moving with move=null.
   if(s.phase==='moving')effect(s,{kind:'land',points:[n.position],targets:[p.id],
     next:m?.kind==='rocket'?'ready':'end'},.8);
   return;
  }
  const pool=I().ids,index=Math.max(0,Math.min(pool.length-1,Math.floor(s.rng()*pool.length)));
  const item=pool[index];
  if(!I().add(p,item))throw Error('Lucky Star reward not in item registry');
  s.luckyGrantKey=grantKey;
  s.lucky={playerId:p.id,item,at:s.time,spinDuration:LUCKY_SPIN_SECONDS,
    holdDuration:LUCKY_HOLD_SECONDS,next:m?.kind==='rocket'?'ready':'end'};
  phase(s,'lucky_roulette',LUCKY_SPIN_SECONDS+LUCKY_HOLD_SECONDS);
  return;
 }
 if(n.type==='healing'){
   const gained=Math.min(MAX_HP-p.hp,HEAL.tile);p.hp+=gained;
   s.heals.push({id:p.id,amount:gained,at:s.time,position:I().position(s,p)});
   kind='heal';
 }
 if(n.type==='danger'){dead=damage(s,p,DAMAGE.skull);kind=p.shieldTurns>0?'shield':'hurt';}
 if(n.type==='event'){
  if(s.rng()<.5){p.hp=Math.min(MAX_HP,p.hp+HEAL.event);kind='heal';}
  else{dead=damage(s,p,DAMAGE.event);kind=p.shieldTurns>0?'shield':'hurt';}
 }
 if(n.type==='sword'){
  const territory=s.map.territories[n.territoryId];
  if(!territory)throw Error('Missing sword territory');
  if(territory.ownerId==null){
   territory.ownerId=p.id;
   for(const id of territory.nodeIds)s.map.nodes[id].ownerId=p.id;
   kind='swordClaim';
  }else if(territory.ownerId===p.id)kind='swordSafe';
  else{dead=damage(s,p,DAMAGE.sword);kind=p.shieldTurns>0?'shield':'swordHit';}
 }
 effect(s,{kind:dead?'death':kind,points:[n.position],targets:[p.id],
  ownerColor:n.type==='sword'?s.players.find(q=>q.id===n.ownerId)?.color:null,
  next:!dead&&m?.kind==='rocket'?'ready':'end'},dead?1.5:.8);
}
function beginMove(s,p,steps,kind='walk'){
 // Preserve the existing real position at the pad, even across turns.
 const position=I().position(s,p),origin=s.map.nodes[p.currentNodeId].position;
 if(kind==='walk'&&!p.worldPosition)p.worldPosition={...position};
 s.move={playerId:p.id,kind,remaining:steps,total:steps,from:p.currentNodeId,to:null,
   t:0,lateral:0,nodeOffset:{x:position.x-origin.x,y:position.y-origin.y},
   intent:null,intentTime:0,started:false,visited:[p.currentNodeId],completedSteps:0,auto:false,
   expires:kind==='rocket'?s.time+5:Infinity};
 s.camera.explore=kind==='walk'&&!p.isBot;
 if(kind==='walk'&&s.inputs[p.id]){
   s.inputs[p.id].x=0;s.inputs[p.id].y=0;s.inputs[p.id].at=-Infinity;
 }
 if(kind==='rocket'){
  s.move.remaining=Infinity;s.move.total=Infinity;
  phase(s,'rocket',5);return;
 }
 if(p.pendingTraverse){
  const pending=p.pendingTraverse;delete p.pendingTraverse;
  s.move.from=pending.from;s.move.to=pending.to;
  s.move.startPosition=pending.startPosition;s.move.endPosition=pending.endPosition;
  s.move.t=pending.t;s.move.lateral=pending.lateral||0;
  s.move.nodeOffset={x:0,y:0};movePhase(s,'moving');return;
 }
 phase(s,'move_ready',15);nextStep(s);
}
function nextStep(s){
 const m=s.move,p=current(s);
 if(!m)return;
 if(p.currentNodeId===s.map.finishId){win(s,p);return;}
 if(m.remaining<=0||m.stop||s.time>=m.expires||(m.kind==='rocket'&&m.expires-s.time<.48)){land(s);return;}
 const options=s.map.nodes[p.currentNodeId].nextNodes;
 if(options.length>1){s.branch={options:[...options],selected:options[0]};movePhase(s,'branch',Math.min(8,m.expires-s.time));return;}
 if(m.kind==='walk'){movePhase(s,'move_ready');return;}
 step(s,options[0]);
}
const WALK_SPEED=240,LANE_RADIUS=18,NODE_RADIUS=18,TURN_DELAY=.16;
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
function step(s,to){
 const m=s.move,p=current(s);
 if(!m||m.to||!s.map.nodes[p.currentNodeId].nextNodes.includes(to)||m.visited.includes(to))return false;
 const pos=I().position(s,p),a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position;
 m.from=p.currentNodeId;m.to=to;m.intent=null;m.intentTime=0;
 if(m.kind==='walk'){
  // Keep the exact world-space location; never retarget the sprite to a pad centre.
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
  m.startPosition=a;m.endPosition=b;
  m.t=((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(d*d);
  m.lateral=((pos.y-a.y)*dx-(pos.x-a.x)*dy)/d;
 }else{
  m.startPosition=pos;m.endPosition=I().positionOnNode(s,p,to);
  m.t=0;m.lateral=0;
 }
 m.nodeOffset={x:0,y:0};
 movePhase(s,'moving');return true;
}
function roamNode(s,p,dt){
 const m=s.move;if(!m)return;
 const a=axes(s,p.id),strength=Math.hypot(a.x,a.y);
 if(strength>.11){
  if(!m.started){m.started=true;s.camera.explore=false;}
  // Walk freely inside the plaza around each tile. An accidental touch does
  // not commit a branch: direction must be held for 160 milliseconds.
  const v=m.nodeOffset||{x:0,y:0};
  let x=v.x+a.x*WALK_SPEED*dt,y=v.y+a.y*WALK_SPEED*dt;
  const d=Math.hypot(x,y);
  if(d>NODE_RADIUS){x=x*NODE_RADIUS/d;y=y*NODE_RADIUS/d;}
  m.nodeOffset={x,y};
  const next=forwardInput(s,p);
  if(next){
   if(m.intent===next)m.intentTime+=dt;
   else{m.intent=next;m.intentTime=dt;}
   if(m.intentTime>=TURN_DELAY){step(s,next);return;}
  }else{m.intent=null;m.intentTime=0;}
 }else{m.intent=null;m.intentTime=0;}
}
function walkEdge(s,p,dt){
 const m=s.move;
 const a=m.startPosition,b=m.endPosition;
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
 const stick=axes(s,p.id),magnitude=Math.hypot(stick.x,stick.y);
 if(magnitude>.13){
  const options=s.map.nodes[m.from].nextNodes;
  // Still able to change the chosen branch until far enough down the edge.
  if(options.length>1&&m.t<.70){
   const candidate=M().choose(s.map,m.from,stick.x,stick.y);
   if(candidate!==m.to){
    const to=s.map.nodes[candidate].position,from=s.map.nodes[m.from].position;
    const cd=Math.hypot(to.x-from.x,to.y-from.y)||1;
    const currentDot=(stick.x*nx+stick.y*ny)/magnitude;
    const candidateDot=(stick.x*(to.x-from.x)+stick.y*(to.y-from.y))/(magnitude*cd);
    const pos=I().position(s,p),end=I().positionOnNode(s,p,candidate);
    const vx=end.x-a.x,vy=end.y-a.y,len=Math.hypot(vx,vy)||1;
    const projected=((pos.x-a.x)*vx+(pos.y-a.y)*vy)/(len*len);
    const lateral=(-(pos.x-a.x)*vy+(pos.y-a.y)*vx)/len;
    if(candidateDot>.55&&candidateDot>currentDot+.15&&
      projected>=-NODE_RADIUS/len&&projected<.75&&Math.abs(lateral)<=LANE_RADIUS){
     m.to=candidate;m.endPosition=s.map.nodes[candidate].position;m.t=projected;m.lateral=lateral;
     // The sprite retains its real position when the fork is reselected.
     return;
    }
   }
  }
 }
 const tangent=stick.x*nx+stick.y*ny;
 const sideways=-stick.x*ny+stick.y*nx;
 const beforeT=m.t,beforeL=m.lateral||0;
 if(magnitude>.1){
  // Full 2D input: forwards, sideways and backwards are all allowed. The
  // walkable lane bounds prevent shortcuts while the dice still count nodes.
  m.t=bound(m.t+tangent*WALK_SPEED*dt/d,0,1);
  m.lateral=bound(beforeL+sideways*WALK_SPEED*dt,-LANE_RADIUS,LANE_RADIUS);
 }
 m.walking=Math.abs(m.t-beforeT)>1e-6||Math.abs(m.lateral-beforeL)>1e-6;
 if(m.t<=.001&&tangent<-.15){
  // Reverse to the fork and choose again without consuming a die step.
  const pos=I().position(s,p),base=I().positionOnNode(s,p,m.from);
  m.nodeOffset={x:0,y:0};
  if(Number.isFinite(pos.x)&&Number.isFinite(pos.y)){
   const vx=pos.x-base.x,vy=pos.y-base.y,len=Math.hypot(vx,vy)||1;
   m.nodeOffset={x:len>NODE_RADIUS?vx*NODE_RADIUS/len:vx,y:len>NODE_RADIUS?vy*NODE_RADIUS/len:vy};
  }
  m.to=null;m.lateral=0;m.intent=null;m.intentTime=0;
  const options=s.map.nodes[p.currentNodeId].nextNodes;
  if(options.length>1){s.branch={options:[...options],selected:options[0]};movePhase(s,'branch');}
  else movePhase(s,'move_ready');
  return;
 }
 if(m.t>=1){
  const worldPos=I().position(s,p);
  p.currentNodeId=m.to;m.visited.push(m.to);m.to=null;m.remaining--;
  p.worldPosition={...worldPos};
  const node=s.map.nodes[p.currentNodeId].position;
  m.nodeOffset={x:worldPos.x-node.x,y:worldPos.y-node.y};
  if(s.map.nodes[p.currentNodeId].type==='milestone')s.milestone={at:s.time,position:s.map.nodes[p.currentNodeId].position};
  nextStep(s);
 }
}
// 5-second forward-only free steering. Completed edges advance the graph;
// mid-edge expiration stores a precise position and never awards the next node.
function updateRocket(s,dt){
 const m=s.move,p=current(s);if(!m||m.kind!=='rocket')return;
 const axesNow=axes(s,p.id),strength=Math.hypot(axesNow.x,axesNow.y);
 if(s.time>=m.expires){
  const point=I().position(s,p);p.worldPosition={...point};
  if(m.to&&m.t<.999){
   p.pendingTraverse={from:m.from,to:m.to,t:m.t,lateral:m.lateral||0,
    startPosition:{...m.startPosition},endPosition:{...m.endPosition}};
   land(s,false);return;
  }
  land(s,m.completedSteps>0);return;
 }
 if(strength<=.12)return;
 const stick={x:axesNow.x/strength,y:axesNow.y/strength};
 if(!m.to){
  const opts=s.map.nodes[p.currentNodeId].nextNodes;
  if(!opts.length){win(s,p);return;}
  const to=M().choose(s.map,p.currentNodeId,stick.x,stick.y);
  const a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position;
  const len=Math.hypot(b.x-a.x,b.y-a.y)||1;
  if((stick.x*(b.x-a.x)+stick.y*(b.y-a.y))/len<.23)return;
  m.from=p.currentNodeId;m.to=to;
  m.startPosition=I().position(s,p);m.endPosition={...b};
  m.t=0;m.lateral=0;
 }
 const a=m.startPosition,b=m.endPosition,dx=b.x-a.x,dy=b.y-a.y;
 const len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
 const forward=Math.max(0,stick.x*nx+stick.y*ny),side=-stick.x*ny+stick.y*nx;
 m.t=Math.min(1,m.t+forward*510*dt/len);
 m.lateral=bound((m.lateral||0)+side*510*dt,-LANE_RADIUS,LANE_RADIUS);
 m.walking=forward>.05||Math.abs(side)>.05;
 if(m.t>=1){
  p.worldPosition=I().position(s,p);
  p.currentNodeId=m.to;m.visited.push(m.to);m.completedSteps++;
  m.from=p.currentNodeId;m.to=null;m.lateral=0;
  if(p.currentNodeId===s.map.finishId)win(s,p);
 }
}
function roll(s){
 if(s.phase!=='ready'||s.rolled)return false;
 const p=current(s);if(p){p.bagOpen=false;p.bagMessage='';}
 s.rolled=true;s.moveDice=[D().roll(s.rng),D().roll(s.rng)];s.die=s.moveDice[0]+s.moveDice[1];
 phase(s,'dice',D().TIMING.throw+D().TIMING.hold);return true;
}
function remainingSteps(s,id){if(!id)return 0;return s.move?.playerId===id?s.move.remaining:current(s)?.id===id&&s.phase==='dice'&&s.time-s.phaseAt>=D().TIMING.throw?s.die:0;}
function forwardForce(s,p,toId){
 if(s.inputs[p.id]?.turnId!==s.turnId)return 0;
 const a=axes(s,p.id),strength=Math.hypot(a.x,a.y);if(strength<.25)return 0;
 const from=s.map.nodes[p.currentNodeId].position,to=s.map.nodes[toId]?.position;if(!to)return 0;
 const dx=to.x-from.x,dy=to.y-from.y;
 const dot=(dx*a.x+dy*a.y)/Math.hypot(dx,dy)/strength;
 return dot>.35?Math.min(1,strength)*dot:0;
}
function forwardInput(s,p){
 const a=axes(s,p.id),id=M().choose(s.map,p.currentNodeId,a.x,a.y);
 return forwardForce(s,p,id)>0?id:null;
}
// Slots remain fixed [Roll, Potion, UFO, Rocket, Bomber, Car, Shield].
// B skips empty item types and repeated rewards do not duplicate slots.
function cycleAction(s,p){
 if(s.phase!=='ready'||s.rolled)return false;
 const slots=I().availableSlots(p);
 const at=slots.indexOf(Number(p.actionIndex)||0);
 p.actionIndex=slots[(at+1)%slots.length];
 p.bagMessage='';
 if(p.actionGraceRound!==s.roundNumber){
  p.actionGraceRound=s.roundNumber;
  s.readyDeadline=Math.max(s.readyDeadline,s.time+9);
  s.deadline=s.readyDeadline;
 }
 return true;
}
function confirmAction(s,p){
 if(s.phase!=='ready'||s.rolled)return false;
 const selected=Math.min(I().ids.length,Math.max(0,Math.trunc(p.actionIndex||0)));
 if(selected===0)return roll(s);
 const kind=I().ids[selected-1];
 if(!I().bag(p).includes(kind)){p.actionIndex=0;p.bagMessage='ไม่มีไอเทมนี้';return false;}
 if(!p.debugUnlimitedItems&&p.usedRound===s.roundNumber){p.bagMessage='ใช้ไอเทมในรอบนี้แล้ว';return false;}
 if(!I().begin(s,p,api,kind)){
  p.bagMessage=kind==='potion'?'HP เต็มแล้ว':kind==='shield'?'โล่ยังทำงานอยู่':'ยังใช้ไอเทมนี้ไม่ได้';
  return false;
 }
 p.actionIndex=0;p.bagOpen=false;p.bagMessage='';
 return true;
}
function action(s,id,button){
 const p=s.players.find(p=>p.id===id);if(!p||!['A','B'].includes(button))return false;
 if(s.phase==='order')return rollOrder(s,p);

 if(p.id!==current(s)?.id)return false;
 if(s.phase==='ready'){
  return button==='A'?confirmAction(s,p):cycleAction(s,p);
 }
 if(s.move?.kind==='walk'&&s.camera.explore&&button==='A'&&
   (s.phase==='move_ready'||s.phase==='branch')){
   s.camera.explore=false;s.move.started=true;return true;
 }
 if(s.phase==='aim')return I().confirm(s,button,api);
 // Rocket travel is analogue-controlled; A does not select graph nodes.
 return false;
}
function input(s,id,packet){
 // Turn tokens change at every control boundary, including returning from a game.
 if(packet.turnId!==s.turnId||!Number.isSafeInteger(packet.actionId)||packet.actionId<0||packet.actionId<=(s.lastActions[id]??-1))return false;
 const p=s.players.find(p=>p.id===id);if(!p||s.phase==='finished'||s.phase==='minigame')return false;
 s.lastActions[id]=packet.actionId;
 // Edge detection is scoped to the current control token. A held or
 // previously pressed key from an expired phase must not suppress a new A/B
 // press when the next turn begins.
 const previous=s.inputs[id];
 const old=previous?.turnId===packet.turnId?previous:{};
 const k=packet.keys||{};
 const x=Number.isFinite(k.axisX)&&k.axisX!==0?Math.max(-1,Math.min(1,k.axisX)):Number(k.right===true)-Number(k.left===true);
 const y=Number.isFinite(k.axisY)&&k.axisY!==0?Math.max(-1,Math.min(1,k.axisY)):Number(k.down===true)-Number(k.jump===true);
 const a=k.action===true,b=k.alt===true;
 s.inputs[id]={x,y,a,b,at:s.time,turnId:packet.turnId};
 if(a&&!old.a)action(s,id,'A');else if(b&&!old.b)action(s,id,'B');
 return true;
}
function minigameStarted(s,mode){if(s.phase!=='minigame_pending')return false;s.lastMinigame=mode;phase(s,'minigame');return true;}
function minigameEnded(s,ranking){
 if(s.phase!=='minigame')return false;
 // Reject incomplete/duplicate outcomes rather than award arbitrary array order.
 if(ranking.length!==s.players.length||new Set(ranking.map(r=>r.id)).size!==s.players.length||ranking.some(r=>!s.players.some(p=>p.id===r.id)))throw Error('Incomplete BOARD PARTY outcome');
 const rewarded=window.BoardMinigame.rewards(ranking,s.players.length,s.rng);
 s.results=ranking.map(r=>({...r,reward:rewarded.includes(r.id)?I().ids[Math.floor(s.rng()*I().ids.length)]:null}));
 // Competition ranks remain unchanged; tied players retain their prior relative order.
 const ranks=new Map(ranking.map(r=>[r.id,r.rank]));
 s.nextOrder=[...s.order].sort((a,b)=>ranks.get(a)-ranks.get(b));
 s.pendingItems={};s.rewardGrantRound=null;phase(s,'standings',2.5);return true;
}
function grant(s){
 // A single minigame can never add rewards twice even if a stale render/update
 // repeats a transition. State and awarded count are owned by this round.
 if(s.rewardGrantRound===s.roundNumber)return false;
 s.rewardGrantRound=s.roundNumber;
 // Rewards are collected, never silently discarded or forcibly substituted.
 // Multiple identical item types may coexist and are consumed individually.
 for(const r of s.results){
  if(!r.reward)continue;
  const p=s.players.find(p=>p.id===r.id);
  if(p)I().add(p,r.reward);
 }
 s.pendingItems={};
 phase(s,'rewards',4.5);
 return true;
}
function update(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);s.time+=dt;
 if(s.phase==='overview'){if(s.time+1e-6>=s.deadline)beginIntroZoom(s);}
 else if(s.phase==='intro_zoom'){if(s.time+1e-6>=s.deadline)beginOrder(s);}
 else if(s.phase==='order'){
  for(const p of s.players)if(!p.dice&&(s.time>=s.deadline||(p.isBot&&s.time-s.phaseAt>.6+s.players.indexOf(p)*.12)))rollOrder(s,p);
  if(s.players.every(p=>p.dice&&s.time-p.rollAt>=D().TIMING.throw+D().TIMING.hold/2)){s.order=D().order(s.players,s.rng);phase(s,'order_result',3);}
 }else if(s.phase==='order_result'&&s.time>=s.deadline)startTurn(s);
 else if(s.phase==='ready'&&s.time>=s.deadline)roll(s);
 else if(s.phase==='dice'&&s.time>=s.deadline)beginMove(s,current(s),s.die);
 else if(s.phase==='rocket')updateRocket(s,dt);
  else if(s.phase==='move_ready'){
  if(s.move.kind==='walk')roamNode(s,current(s),dt);
  else if(s.time>=s.deadline){s.move.auto=true;step(s,s.map.nodes[current(s).currentNodeId].nextNodes[0]);}
 }else if(s.phase==='branch'){
  const to=forwardInput(s,current(s));if(to)s.branch.selected=to;
  if(s.move.kind==='walk')roamNode(s,current(s),dt);
  else if(to&&s.move.kind==='rocket'&&s.move.auto)step(s,to);
  else if(s.time>=s.deadline){if(s.time>=s.move.expires)land(s);else step(s,s.branch.selected);}
 }else if(s.phase==='moving'){
  const m=s.move,p=current(s);
  if(m.kind==='walk')walkEdge(s,p,dt);
  else{
   const advance=dt/.48;m.walking=advance>0;m.t=Math.min(1,m.t+advance);
   if(m.t>=1){p.worldPosition=I().position(s,p);p.currentNodeId=m.to;m.visited.push(m.to);m.to=null;m.remaining--;if(s.map.nodes[p.currentNodeId].type==='milestone')s.milestone={at:s.time,position:s.map.nodes[p.currentNodeId].position};nextStep(s);}
  }
 }else if(s.phase==='aim'||s.phase==='car')I().update(s,dt,api);
 else if(s.phase==='lucky_roulette'&&s.time>=s.deadline){
  const prize=s.lucky,p=s.players.find(q=>q.id===prize?.playerId);
  if(!prize||!p)throw Error('Missing Lucky Star prize');
  effect(s,{kind:'luckyReward',item:prize.item,points:[I().position(s,p)],
    targets:[p.id],next:prize.next},1.5);
 }
 else if(s.phase==='effect'&&s.time>=s.deadline){const next=s.effect.next;s.effect=null;s.lucky=null;if(next==='ready')ready(s);else endTurn(s);}
 else if(s.phase==='standings'&&s.time>=s.deadline)grant(s);
 else if(s.phase==='rewards'&&s.time>=s.deadline)phase(s,'returning',.6);
 else if(s.phase==='returning'&&s.time>=s.deadline){s.roundNumber++;s.order=[...s.nextOrder];s.turnIndex=0;phase(s,'round_order',1.8);}
 else if(s.phase==='round_order'&&s.time>=s.deadline)startTurn(s);
 window.BoardBots?.update(s,dt,api);
}
function snapshot(s){return JSON.parse(JSON.stringify({map:s.map,players:s.players,order:s.order,roundNumber:s.roundNumber,turnIndex:s.turnIndex}));}
function controls(s,id){
 const p=s.players.find(p=>p.id===id),mine=current(s)?.id===id;
 if(s.phase==='overview')return{a:'',b:'',help:'กำลังชมแผนที่ • อีกสักครู่กล้องจะซูมไปจุดเริ่มต้น'};
 if(s.phase==='intro_zoom')return{a:'',b:'',help:'กำลังซูมไปจุดเริ่มต้น • เตรียมทอยลูกเต๋าหาคนเริ่ม'};
 if(s.phase==='order')return{a:'ทอย',b:'ทอย',help:p?.dice?'ทอยแล้ว • รอเพื่อน':'A หรือ B ทอยลำดับ'};
 if(s.phase==='rewards')return{a:'',b:'',help:'ได้รับไอเทมรางวัลแล้ว'};
 if(s.phase==='lucky_roulette')return{a:'',b:'',help:'LUCKY STAR • กำลังสุ่มไอเทมเข้ากระเป๋า'};
 if(!mine)return{a:'',b:'',help:'รอตาของคุณ • '+(current(s)?.name||'สรุปผล')};
 if(s.phase==='ready'){
  const selected=Math.min(I().ids.length,Math.max(0,Math.trunc(p.actionIndex||0)));
  const name=selected===0?'ทอยลูกเต๋า':I().names[I().ids[selected-1]];
  return{a:selected===0?'ทอย':'ใช้ไอเทม',b:'เปลี่ยนตัวเลือก',
   help:'เลือก: '+name+(p.bagMessage?' • '+p.bagMessage:'')+' • B เปลี่ยน / A ยืนยัน'};
 }
 if(s.move?.kind==='walk')return{a:s.camera.explore?'เริ่มเดิน':'',b:'',
   help:(s.camera.explore?'ลากหน้าจอหลักดูแผนที่ • A เริ่มเดิน หรือขยับจอยเพื่อล็อกกล้อง':
     'ลากจอยเพื่อเดิน / ปล่อยเพื่อหยุด • ไม่มีการช่วยเดินอัตโนมัติ')+
     ' • เหลือ '+s.move.remaining+' ก้าว'};
 if(s.phase==='rocket')return{a:'',b:'',help:'จรวด '+Math.max(0,s.move.expires-s.time).toFixed(1)+'s • คุมอนาล็อกไปข้างหน้า ไม่มีจำกัดช่อง'};
  if(s.phase==='branch')return{a:'',b:'',help:'ชี้ทิศทางที่แยกด้วยอนาล็อก'};
 if(s.phase==='aim')return{a:'ยืนยัน',b:s.skill.kind==='bomber'?'หมุน 45°':'',help:s.skill.kind==='ufo'?'เล็งให้สัมผัสตัวละคร / A สลับ':'เลื่อนแนวบิน / B หมุน / A โจมตี'};
 if(s.phase==='car')return{a:'',b:'',help:'อนาล็อกขับตามลูกศร • ระเบิดเมื่อชนหรือครบ 6 วินาที'};
 
 return{a:'',b:'',help:'กำลังดำเนินตา'};
}
const api={create,beginOrder,updateRocket,MAX_HP,DAMAGE,HEAL,phase,current,axes,ready,startTurn,endTurn,effect,damage,win,land,beginMove,step,roll,action,input,update,minigameStarted,minigameEnded,snapshot,controls,remainingSteps};
window.BoardParty=Object.freeze(api);
})();
