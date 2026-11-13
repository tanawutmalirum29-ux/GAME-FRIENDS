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
 if(!id||forwardForce(s,p,id)<=0)return null;
 const node=s.map.nodes[p.currentNodeId],exits=node.nextNodes;
 if(exits.length>1){
  // A nearly equal angular fit is ambiguous, NOT a reason to hold the stick
  // for a fixed time. Once the heading is clear the player moves immediately.
  const strength=Math.hypot(a.x,a.y);
  const dot=toId=>{
   const to=s.map.nodes[toId].position,dx=to.x-node.position.x,dy=to.y-node.position.y;
   return (dx*a.x+dy*a.y)/(Math.hypot(dx,dy)*strength);
  };
  const best=dot(id);
  if(exits.some(other=>other!==id&&best-dot(other)<.08))return null;
 }
 return id;
}
// Slots remain fixed [Roll, Potion, UFO, Rocket, Bomber, Car, Shield].
// B skips empty item types and repeated rewards do not duplicate slots.
function cycleAction(s,p){
 if(s.phase!=='ready'||s.rolled)return false;
 const slots=I().availableSlots(p,s.roundNumber);
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
 if(p.usedRound===s.roundNumber){p.bagMessage='ใช้ไอเทมในรอบนี้แล้ว';return false;}
 if(!I().begin(s,p,api,kind)){
  p.bagMessage=kind==='potion'?'HP เต็มแล้ว':kind==='shield'?'โล่ยังทำงานอยู่':'ยังใช้ไอเทมนี้ไม่ได้';
  return false;
 }
 p.actionIndex=0;p.bagOpen=false;p.bagMessage='';
 return true;
}
function action(s,id,button){
 M().assertCompatible(s.map);
 const p=s.players.find(p=>p.id===id);if(!p||!['A','B','C'].includes(button))return false;
 if(s.phase==='overview')return button==='A'&&beginIntroZoom(s);
 if(s.phase==='order')return button!=='C'&&rollOrder(s,p);

 if(p.id!==current(s)?.id)return false;
 if(s.phase==='ready'){
  return button==='A'?confirmAction(s,p):button==='B'?cycleAction(s,p):false;
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
 M().assertCompatible(s.map);
 if(packet.mapId&&packet.mapId!==s.map.id)return false;
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
 const a=k.action===true,b=k.alt===true,c=k.cancel===true;
 s.inputs[id]={x,y,a,b,c,at:s.time,turnId:packet.turnId};
 // On a new phase token, phones can replay the A still held from selection.
 // Both UFO and bomber must see A released before any second confirmation.
 if(s.phase==='aim'&&['ufo','bomber'].includes(s.skill?.kind)&&!a)
  s.skill.requiresConfirmRelease=false;
 if(c&&!old.c)action(s,id,'C');
 else if(a&&!old.a)action(s,id,'A');
 else if(b&&!old.b)action(s,id,'B');
 return true;
}
