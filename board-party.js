/* Host-authoritative session state, separate from every minigame's player data. */
(() => {
'use strict';
const M=()=>window.BoardMap,D=()=>window.BoardDice,I=()=>window.BoardItems;
let serial=0;
function create(roster,{seed=Date.now(),rng=Math.random}={}){
 if(!roster.length||roster.length>12)throw Error('BOARD PARTY needs 1–12 players');
 const s={id:'board-'+seed+'-'+(++serial),map:M().create(seed),rng,players:roster.map(p=>({id:p.id,name:p.name,color:p.color,costume:window.PartyPlayerAvatar?.costumeFor(p)||p.costume,isBot:!!p.isBot,currentNodeId:'n0',hp:3,item:null,bag:[],bagOpen:false,bagIndex:0,bagMessage:'',usedRound:0,shieldTurns:0,dice:null,rollAt:0})),order:[],turnIndex:0,roundNumber:1,time:0,revision:0,turnId:'',inputs:{},lastActions:{},phase:'',deadline:0,rolled:false,move:null,skill:null,effect:null,results:[],pendingItems:{},winnerIds:[],camera:{x:480,y:320,zoom:1},lastMinigame:null};
 phase(s,'order',12);return s;
}
function phase(s,name,duration=0){s.phase=name;s.phaseAt=s.time;s.deadline=s.time+duration;s.turnId=s.id+':'+(++s.revision);}
// A continuous walk owns one input token until it lands; holding the stick
// across a node must not wait for a network round trip or require another tap.
function movePhase(s,name,duration=8){
 if(s.move?.kind!=='walk'){phase(s,name,duration);return;}
 s.phase=name;s.phaseAt=s.time;s.deadline=s.time+duration;
}
const current=s=>s.players.find(p=>p.id===s.order[s.turnIndex]);
function axes(s,id){const a=s.inputs[id];return a&&s.time-a.at<.9?{x:a.x,y:a.y}:{x:0,y:0};}
function rollOrder(s,p){if(p.dice||s.phase!=='order')return false;p.dice=[D().roll(s.rng),D().roll(s.rng)];p.rollAt=s.time;return true;}
function ready(s,extend=true){s.move=null;s.skill=null;for(const p of s.players)p.bagOpen=false;if(extend)s.readyDeadline=s.time+12;phase(s,'ready',Math.max(.1,s.readyDeadline-s.time));}
function startTurn(s){s.rolled=false;s.die=null;s.moveDice=null;s.move=null;s.skill=null;ready(s);}
function endTurn(s){
 if(s.phase==='finished')return;
 // Count the shield's owner's completed turns, regardless of round reordering.
 const p=current(s);if(p?.shieldTurns>0)p.shieldTurns--;
 s.move=null;s.skill=null;s.effect=null;s.turnIndex++;
 if(s.turnIndex>=s.order.length){phase(s,'minigame_pending');return;}
 startTurn(s);
}
function effect(s,fx,duration){s.effect={...fx,duration,at:s.time};phase(s,'effect',duration);}
function damage(s,p,amount){
 if(p.shieldTurns>0){p.blockedUntil=s.time+1.2;return false;}
 p.hp=Math.max(0,p.hp-amount);p.hurtUntil=s.time+1.2;
 if(p.hp)return false;
 p.death={at:s.time,position:I().position(s,p)};
 p.currentNodeId=s.map.startId;p.hp=3;p.shieldTurns=0;
 // Inventory and turn order survive respawn. No movement credit survives death.
 if(current(s)?.id===p.id){s.move=null;s.skill=null;}
 return true;
}
function win(s,p){
 if(p.currentNodeId!==s.map.finishId)return;
 if(s.phase==='finished'){if(s.time===s.phaseAt&&!s.winnerIds.includes(p.id))s.winnerIds.push(p.id);return;}
 s.winnerIds=[p.id];s.move=null;s.skill=null;phase(s,'finished');
}
function land(s){
 const m=s.move,p=current(s);s.move=null;
 if(p.currentNodeId===s.map.finishId){win(s,p);return;}
 const n=s.map.nodes[p.currentNodeId];let dead=false,kind='land';
 if(n.type==='healing'){p.hp=Math.min(3,p.hp+1);kind='heal';}
 if(n.type==='danger'){dead=damage(s,p,1);kind=p.shieldTurns>0?'shield':'hurt';}
 if(n.type==='event'){if(s.rng()<.5){p.hp=Math.min(3,p.hp+1);kind='heal';}else{dead=damage(s,p,1);kind=p.shieldTurns>0?'shield':'hurt';}}
 effect(s,{kind:dead?'death':kind,points:[n.position],targets:[p.id],next:!dead&&m?.kind==='rocket'?'ready':'end'},dead?1.5:.8);
}
function beginMove(s,p,steps,kind='walk'){
 s.move={playerId:p.id,kind,remaining:steps,total:steps,from:p.currentNodeId,to:null,t:0,lateral:0,nodeOffset:{x:0,y:0},intent:null,intentTime:0,visited:[p.currentNodeId],auto:false,expires:kind==='rocket'?s.time+4.5:Infinity};
 if(kind==='walk'&&s.inputs[p.id]){s.inputs[p.id].x=0;s.inputs[p.id].y=0;s.inputs[p.id].at=-Infinity;}
 phase(s,'move_ready',8);
 nextStep(s);
}
function nextStep(s){
 const m=s.move,p=current(s);
 if(!m)return;
 if(p.currentNodeId===s.map.finishId){win(s,p);return;}
 if(m.remaining<=0||m.stop||s.time>=m.expires||(m.kind==='rocket'&&m.expires-s.time<.48)){land(s);return;}
 const options=s.map.nodes[p.currentNodeId].nextNodes;
 if(options.length>1){s.branch={options:[...options],selected:options[0]};movePhase(s,'branch',Math.min(m.kind==='walk'&&!m.auto?8:4,m.expires-s.time));return;}
 if(m.kind==='walk'&&!m.auto){movePhase(s,'move_ready');return;}
 step(s,options[0]);
}
function step(s,to){
 const m=s.move,p=current(s);
 if(!m||m.to||!s.map.nodes[p.currentNodeId].nextNodes.includes(to)||m.visited.includes(to))return false;
 m.startPosition=I().position(s,p);m.endPosition=I().positionOnNode(s,p,to);
 m.from=p.currentNodeId;m.to=to;m.t=0;m.lateral=0;m.nodeOffset={x:0,y:0};m.intent=null;m.intentTime=0;
 movePhase(s,'moving');return true;
}
const WALK_SPEED=240,LANE_RADIUS=50,NODE_RADIUS=55,TURN_DELAY=.16;
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
function roamNode(s,p,dt){
 const m=s.move;if(!m)return;
 const a=axes(s,p.id),strength=Math.hypot(a.x,a.y);
 if(m.auto){
  const next=s.phase==='branch'?s.branch.selected:s.map.nodes[p.currentNodeId].nextNodes[0];
  step(s,next);return;
 }
 if(strength>.11){
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
 if(s.time>=s.deadline){
  m.auto=true;
  step(s,s.phase==='branch'?s.branch.selected:s.map.nodes[p.currentNodeId].nextNodes[0]);
 }
}
function walkEdge(s,p,dt){
 const m=s.move;
 const a=m.startPosition,b=m.endPosition;
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
 const stick=axes(s,p.id),magnitude=Math.hypot(stick.x,stick.y);
 if(!m.auto&&magnitude>.13){
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
    if(candidateDot>.55&&candidateDot>currentDot+.15&&Math.abs(lateral)<LANE_RADIUS+10){
     m.to=candidate;m.endPosition=end;m.t=bound(projected,0,.75);m.lateral=bound(lateral,-LANE_RADIUS,LANE_RADIUS);
     // The sprite retains its real position when the fork is reselected.
     return;
    }
   }
  }
 }
 const tangent=stick.x*nx+stick.y*ny;
 const sideways=-stick.x*ny+stick.y*nx;
 const beforeT=m.t,beforeL=m.lateral||0;
 if(m.auto){
  m.t=Math.min(1,m.t+WALK_SPEED*dt/d);
  m.lateral=beforeL*(1-Math.min(1,dt*5));
 }else if(magnitude>.1){
  // Full 2D input: forwards, sideways and backwards are all allowed. The
  // walkable lane bounds prevent shortcuts while the dice still count nodes.
  m.t=bound(m.t+tangent*WALK_SPEED*dt/d,0,1);
  m.lateral=bound(beforeL+sideways*WALK_SPEED*dt,-LANE_RADIUS,LANE_RADIUS);
 }
 m.walking=Math.abs(m.t-beforeT)>1e-6||Math.abs(m.lateral-beforeL)>1e-6;
 if(m.walking)s.deadline=s.time+8;
 if(!m.auto&&m.t<=.001&&tangent<-.15){
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
  p.currentNodeId=m.to;m.visited.push(m.to);m.to=null;m.remaining--;
  m.lateral=0;m.nodeOffset={x:0,y:0};
  if(s.map.nodes[p.currentNodeId].type==='milestone')s.milestone={at:s.time,position:s.map.nodes[p.currentNodeId].position};
  nextStep(s);
 }else if(!m.auto&&s.time>=s.deadline)m.auto=true;
}
function roll(s){
 if(s.phase!=='ready'||s.rolled)return false;
 s.rolled=true;s.moveDice=[D().roll(s.rng),D().roll(s.rng)];s.die=s.moveDice[0]+s.moveDice[1];
 phase(s,'dice',1.8);return true;
}
function remainingSteps(s,id){if(!id)return 0;return s.move?.playerId===id?s.move.remaining:current(s)?.id===id&&s.phase==='dice'&&s.time-s.phaseAt>=.85?s.die:0;}
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
function openBag(s,p){
 if(s.phase!=='ready'||s.rolled)return false;
 if(p.bagOpen)return true;
 p.bagOpen=true;p.bagIndex=0;p.bagMessage='';
 // Opening a menu once gives time to read item names, but cannot create an
 // infinite timer extension by repeatedly opening and closing it.
 if(!p.bagGraceRound||p.bagGraceRound!==s.roundNumber){
  p.bagGraceRound=s.roundNumber;
  s.readyDeadline=Math.max(s.readyDeadline,s.time+9);
  s.deadline=s.readyDeadline;
 }
 return true;
}
function cycleBag(s,p){
 if(!p.bagOpen)return false;
 p.bagIndex=((p.bagIndex||0)+1)%(I().bag(p).length+1);
 p.bagMessage='';return true;
}
function confirmBag(s,p){
 if(!p.bagOpen)return false;
 const items=I().bag(p),at=p.bagIndex||0;
 if(at>=items.length){p.bagOpen=false;p.bagMessage='';return true;}
 if(p.usedRound===s.roundNumber){p.bagMessage='ใช้ไอเทมในรอบนี้แล้ว';return false;}
 const kind=items[at];
 if(!I().begin(s,p,api,kind)){
  p.bagMessage=kind==='potion'?'HP เต็มแล้ว':kind==='shield'?'โล่ยังทำงานอยู่':'ยังใช้ไอเทมนี้ไม่ได้';
  return false;
 }
 p.bagOpen=false;p.bagMessage='';return true;
}
function action(s,id,button){
 const p=s.players.find(p=>p.id===id);if(!p||!['A','B'].includes(button))return false;
 if(s.phase==='order')return rollOrder(s,p);

 if(p.id!==current(s)?.id)return false;
 if(s.phase==='ready'){
  if(p.bagOpen)return button==='A'?cycleBag(s,p):confirmBag(s,p);
  return button==='A'?roll(s):openBag(s,p);
 }
 if(s.phase==='aim')return I().confirm(s,button,api);
 if(s.phase==='branch'&&s.move?.kind==='rocket'&&button==='A')return step(s,forwardInput(s,p)||s.branch.selected);
 if(s.phase==='moving'&&s.move?.kind==='rocket'&&button==='A'){s.move.stop=true;return true;}
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
 s.pendingItems={};phase(s,'standings',4);return true;
}
function grant(s){
 // Rewards are collected, never silently discarded or forcibly substituted.
 // Multiple identical item types may coexist and are consumed individually.
 for(const r of s.results){
  if(!r.reward)continue;
  const p=s.players.find(p=>p.id===r.id);
  if(p)I().add(p,r.reward);
 }
 s.pendingItems={};
 phase(s,'rewards',5);
}
function update(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);s.time+=dt;
 if(s.phase==='order'){
  for(const p of s.players)if(!p.dice&&(s.time>=s.deadline||(p.isBot&&s.time-s.phaseAt>.6+s.players.indexOf(p)*.12)))rollOrder(s,p);
  if(s.players.every(p=>p.dice&&s.time-p.rollAt>.85)){s.order=D().order(s.players,s.rng);phase(s,'order_result',3);}
 }else if(s.phase==='order_result'&&s.time>=s.deadline)startTurn(s);
 else if(s.phase==='ready'&&s.time>=s.deadline)roll(s);
 else if(s.phase==='dice'&&s.time>=s.deadline)beginMove(s,current(s),s.die);
 else if(s.phase==='move_ready'){
  if(s.move.kind==='walk')roamNode(s,current(s),dt);
  else if(s.time>=s.deadline){s.move.auto=true;step(s,s.map.nodes[current(s).currentNodeId].nextNodes[0]);}
 }else if(s.phase==='branch'){
  const to=forwardInput(s,current(s));if(to)s.branch.selected=to;
  if(s.move.kind==='walk')roamNode(s,current(s),dt);
  else if(to&&s.move.kind==='rocket'&&s.move.auto)step(s,to);
  else if(s.time>=s.deadline){if(s.time>=s.move.expires)land(s);else{if(s.move.kind==='walk')s.move.auto=true;step(s,s.branch.selected);}}
 }else if(s.phase==='moving'){
  const m=s.move,p=current(s);
  if(m.kind==='walk')walkEdge(s,p,dt);
  else{
   const advance=dt/.48;m.walking=advance>0;m.t=Math.min(1,m.t+advance);
   if(m.t>=1){p.currentNodeId=m.to;m.visited.push(m.to);m.to=null;m.remaining--;if(s.map.nodes[p.currentNodeId].type==='milestone')s.milestone={at:s.time,position:s.map.nodes[p.currentNodeId].position};nextStep(s);}
  }
 }else if(s.phase==='aim'||s.phase==='car')I().update(s,dt,api);
 else if(s.phase==='effect'&&s.time>=s.deadline){const next=s.effect.next;s.effect=null;if(next==='ready')ready(s);else endTurn(s);}
 else if(s.phase==='standings'&&s.time>=s.deadline)grant(s);
 else if(s.phase==='rewards'&&s.time>=s.deadline)phase(s,'returning',1.5);else if(s.phase==='returning'&&s.time>=s.deadline){s.roundNumber++;s.order=[...s.nextOrder];s.turnIndex=0;phase(s,'round_order',3);}
 else if(s.phase==='round_order'&&s.time>=s.deadline)startTurn(s);
 window.BoardBots?.update(s,dt,api);
}
function snapshot(s){return JSON.parse(JSON.stringify({map:s.map,players:s.players,order:s.order,roundNumber:s.roundNumber,turnIndex:s.turnIndex}));}
function controls(s,id){
 const p=s.players.find(p=>p.id===id),mine=current(s)?.id===id;
 if(s.phase==='order')return{a:'ทอย 2 ลูก',b:'ทอย 2 ลูก',help:p?.dice?'ทอยแล้ว • รอเพื่อน':'A หรือ B ทอยลำดับ'};
 if(s.phase==='rewards')return{a:'',b:'',help:'เก็บไอเทมรางวัลลงกระเป๋าอัตโนมัติ'};
 if(!mine)return{a:'',b:'',help:'รอตาของคุณ • '+(current(s)?.name||'สรุปผล')};
 if(s.phase==='ready'){
  if(p.bagOpen){
   const items=I().bag(p),at=p.bagIndex||0,close=at>=items.length;
   return{a:'เลือกถัดไป',b:close?'ปิดกระเป๋า':'ใช้ไอเทม',
    help:'กระเป๋า '+(at+1)+'/'+(items.length+1)+' • '+(close?'ปิดกระเป๋า':I().names[items[at]])+
      (p.bagMessage?' • '+p.bagMessage:'')+' • A เลือก / B ยืนยัน'};
  }
  return{a:'ทอย 2 ลูก',b:'เปิดกระเป๋า',help:'A ทอย 2 ลูก • B เปิดกระเป๋า ('+I().bag(p).length+' ชิ้น)'};
 }
 if(s.move?.kind==='walk')return{a:'',b:'',help:(s.move.auto?'ช่วยเดินเมื่อหมดเวลา':'ลากจอยหรือปุ่มทิศทางเพื่อเดิน / ปล่อยเพื่อหยุด')+' • เหลือ '+s.move.remaining+' ก้าว'};
 if(s.phase==='branch')return{a:'เลือกทาง',b:'',help:'อนาล็อกเลือกทางจรวด / A ยืนยัน'};
 if(s.phase==='aim')return{a:'ยืนยัน',b:s.skill.kind==='bomber'?'หมุน 45°':'',help:s.skill.kind==='ufo'?'เล็งให้สัมผัสตัวละคร / A สลับ':'เลื่อนแนวบิน / B หมุน / A โจมตี'};
 if(s.phase==='car')return{a:'',b:'',help:'อนาล็อกขับตามลูกศร • ระเบิดเมื่อชนหรือครบ 6 วินาที'};
 if(s.phase==='moving'&&s.move?.kind==='rocket')return{a:'ลงช่องถัดไป',b:'',help:'จรวดไปข้างหน้า / A ลงจอด'};
 return{a:'',b:'',help:'กำลังดำเนินตา'};
}
const api={create,phase,current,axes,ready,startTurn,endTurn,effect,damage,win,land,beginMove,step,roll,action,input,update,minigameStarted,minigameEnded,snapshot,controls,remainingSteps};
window.BoardParty=Object.freeze(api);
})();
