/* Host-authoritative session state, separate from every minigame's player data. */
(() => {
'use strict';
const M=()=>window.BoardMap,D=()=>window.BoardDice,I=()=>window.BoardItems;
let serial=0;
function create(roster,{seed=Date.now(),rng=Math.random}={}){
 if(!roster.length||roster.length>12)throw Error('BOARD PARTY needs 1–12 players');
 const s={id:'board-'+seed+'-'+(++serial),map:M().create(seed),rng,players:roster.map(p=>({id:p.id,name:p.name,color:p.color,costume:window.PartyPlayerAvatar?.costumeFor(p)||p.costume,isBot:!!p.isBot,currentNodeId:'n0',hp:3,item:null,usedRound:0,shieldTurns:0,dice:null,rollAt:0})),order:[],turnIndex:0,roundNumber:1,time:0,revision:0,turnId:'',inputs:{},lastActions:{},phase:'',deadline:0,rolled:false,move:null,skill:null,effect:null,results:[],pendingItems:{},winnerIds:[],camera:{x:480,y:320,zoom:1},lastMinigame:null};
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
function ready(s,extend=true){s.move=null;s.skill=null;if(extend)s.readyDeadline=s.time+12;phase(s,'ready',Math.max(.1,s.readyDeadline-s.time));}
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
 s.move={playerId:p.id,kind,remaining:steps,total:steps,from:p.currentNodeId,to:null,t:0,visited:[p.currentNodeId],auto:false,expires:kind==='rocket'?s.time+4.5:Infinity};
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
 m.from=p.currentNodeId;m.to=to;m.t=0;movePhase(s,'moving');return true;
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
function action(s,id,button){
 const p=s.players.find(p=>p.id===id);if(!p||!['A','B'].includes(button))return false;
 if(s.phase==='order')return rollOrder(s,p);
 if(s.phase==='rewards'){
  const pending=s.pendingItems[id];if(!pending||button!=='A')return false;
  if(pending.replace)p.item=pending.item;delete s.pendingItems[id];return true;
 }
 if(p.id!==current(s)?.id)return false;
 if(s.phase==='ready')return button==='A'?roll(s):I().begin(s,p,api);
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
 const old=s.inputs[id]||{},k=packet.keys||{};
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
 for(const r of s.results){if(!r.reward)continue;const p=s.players.find(p=>p.id===r.id);if(p.item)s.pendingItems[p.id]={item:r.reward,replace:false};else p.item=r.reward;}
 phase(s,'rewards',9);
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
  const to=forwardInput(s,current(s));
  if(to)step(s,to);
  else if(s.time>=s.deadline){s.move.auto=true;step(s,s.map.nodes[current(s).currentNodeId].nextNodes[0]);}
 }else if(s.phase==='branch'){
  const to=forwardInput(s,current(s));if(to)s.branch.selected=to;
  if(to&&s.move.kind==='walk'&&!s.move.auto)step(s,to);
  else if(s.time>=s.deadline){if(s.time>=s.move.expires)land(s);else {if(s.move.kind==='walk')s.move.auto=true;step(s,s.branch.selected);}}
 }else if(s.phase==='moving'){
  const m=s.move,p=current(s);
  let advance=dt/.48;
  if(m.kind==='walk'){
   const a=s.map.nodes[m.from].position,b=s.map.nodes[m.to].position;
   let force=m.auto?1:forwardForce(s,p,m.to);
   if(force>0)s.deadline=s.time+8;
   else if(s.time>=s.deadline){m.auto=true;force=1;}
   advance=dt*250*force/Math.hypot(b.x-a.x,b.y-a.y);
  }
  m.walking=advance>0;m.t=Math.min(1,m.t+advance);
  if(m.t>=1){p.currentNodeId=m.to;m.visited.push(m.to);m.to=null;m.remaining--;if(s.map.nodes[p.currentNodeId].type==='milestone')s.milestone={at:s.time,position:s.map.nodes[p.currentNodeId].position};nextStep(s);}
 }else if(s.phase==='aim'||s.phase==='car')I().update(s,dt,api);
 else if(s.phase==='effect'&&s.time>=s.deadline){const next=s.effect.next;s.effect=null;if(next==='ready')ready(s);else endTurn(s);}
 else if(s.phase==='standings'&&s.time>=s.deadline)grant(s);
 else if(s.phase==='rewards'){
  for(const p of s.players){const pending=s.pendingItems[p.id];if(!pending)continue;const a=axes(s,p.id);if(a.x>.4)pending.replace=true;else if(a.x<-.4)pending.replace=false;}
  if(s.time>=s.deadline||(!Object.keys(s.pendingItems).length&&s.time-s.phaseAt>3)){s.pendingItems={};phase(s,'returning',1.5);}
 }else if(s.phase==='returning'&&s.time>=s.deadline){s.roundNumber++;s.order=[...s.nextOrder];s.turnIndex=0;phase(s,'round_order',3);}
 else if(s.phase==='round_order'&&s.time>=s.deadline)startTurn(s);
 window.BoardBots?.update(s,dt,api);
}
function snapshot(s){return JSON.parse(JSON.stringify({map:s.map,players:s.players,order:s.order,roundNumber:s.roundNumber,turnIndex:s.turnIndex}));}
function controls(s,id){
 const p=s.players.find(p=>p.id===id),mine=current(s)?.id===id;
 if(s.phase==='order')return{a:'ทอย 2 ลูก',b:'ทอย 2 ลูก',help:p?.dice?'ทอยแล้ว • รอเพื่อน':'A หรือ B ทอยลำดับ'};
 if(s.phase==='rewards'&&s.pendingItems[id])return{a:'ยืนยัน',b:'',help:'ซ้าย เก็บเดิม / ขวา รับ '+I().names[s.pendingItems[id].item]};
 if(!mine)return{a:'',b:'',help:'รอตาของคุณ • '+(current(s)?.name||'สรุปผล')};
 if(s.phase==='ready')return{a:'ทอย 2 ลูก',b:p.item&&p.usedRound!==s.roundNumber?'ใช้ไอเทม':'',help:'A ทอย 2 ลูก / B ใช้ไอเทมก่อนทอย'};
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
