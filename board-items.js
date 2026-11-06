(() => {
'use strict';
const names={potion:'Healing Potion',ufo:'UFO Position Swap',rocket:'Rocket Ride',bomber:'Bomber Aircraft',car:'RC Bomb Car',shield:'Protection Shield'};
const ids=Object.keys(names),radius=18,blastRadius=72;
function bag(p){
 if(!Array.isArray(p.bag))p.bag=[];
 // Accept older single-slot session data without losing a previously held item.
 if(p.item&&(!p.bag.length||!p.bag.includes(p.item)))p.bag.unshift(p.item);
 return p.bag;
}
// Fixed HUD slots: Roll first, then each item type exactly once.
function counts(p){
 const held=bag(p),totals=Object.fromEntries(ids.map(id=>[id,0]));
 for(const id of held)if(Object.hasOwn(totals,id))totals[id]++;
 return totals;
}
function availableSlots(p){
 const stock=counts(p);
 return [0,...ids.flatMap((id,i)=>stock[id]>0?[i+1]:[])];
}
function add(p,kind){
 if(!ids.includes(kind))return false;
 bag(p).push(kind);p.item=p.bag[0]||null;return true;
}
function positionOnNode(s,p,nodeId=p.currentNodeId){
 const n=s.map.nodes[nodeId].position;
 if(nodeId===p.currentNodeId&&p.worldPosition)return {...p.worldPosition};
 const group=s.players.filter(q=>q.id===p.id||q.currentNodeId===nodeId),i=group.findIndex(q=>q.id===p.id);
 // Crowd offsets remain within the physical pad, never out in the water.
 if(group.length<2)return {...n};
 const angle=2*Math.PI*i/group.length;
 return{x:n.x+Math.cos(angle)*16,y:n.y+Math.sin(angle)*16};
}
function position(s,p){
 if(s.move?.playerId===p.id){
  const m=s.move;
  if(m.to){
   const a=m.startPosition||s.map.nodes[m.from].position,b=m.endPosition||s.map.nodes[m.to].position;
   const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
   const lateral=(m.kind==='walk'||m.kind==='rocket')?(m.lateral||0):0;
   return{x:a.x+dx*m.t-dy/dist*lateral,y:a.y+dy*m.t+dx/dist*lateral};
  }
  if(m.kind==='walk'&&m.nodeOffset){
   const n=s.map.nodes[p.currentNodeId].position;
   return{x:n.x+(m.nodeOffset.x||0),y:n.y+(m.nodeOffset.y||0)};
  }
 }
 return positionOnNode(s,p);
}
function target(s,point,user){return s.players.filter(p=>p.id!==user.id&&p.currentNodeId!==s.map.finishId).map(p=>({p,d:Math.hypot(position(s,p).x-point.x,position(s,p).y-point.y)})).filter(q=>q.d<=radius+8).sort((a,b)=>a.d-b.d||String(a.p.id).localeCompare(String(b.p.id)))[0]?.p||null;}
function bombs(aim){return Array.from({length:5},(_,i)=>({x:aim.x+Math.cos(aim.angle)*(i-2)*90,y:aim.y+Math.sin(aim.angle)*(i-2)*90}));}
function victims(s,points,user){return s.players.filter(p=>p.id!==user.id&&points.some(q=>Math.hypot(position(s,p).x-q.x,position(s,p).y-q.y)<=blastRadius+radius));}
function consume(s,p,kind){
 const items=bag(p),index=items.indexOf(kind);
 // Debug stock is host-only: infinite use never consumes a slot.
 if(index>=0&&!p.debugUnlimitedItems)items.splice(index,1);
 p.item=items[0]||null;
 p.bagIndex=Math.min(p.bagIndex||0,items.length);
 p.bagOpen=false;if(!p.debugUnlimitedItems)p.usedRound=s.roundNumber;
}
function begin(s,p,api,kind=bag(p)[p.bagIndex||0]){
 if(s.phase!=='ready'||!kind||!bag(p).includes(kind)||
   (!p.debugUnlimitedItems&&p.usedRound===s.roundNumber)||s.rolled||s.time>=s.readyDeadline)return false;
 if(kind==='potion'){
  if(p.hp>=api.MAX_HP)return false;
  const gained=Math.min(api.MAX_HP-p.hp,api.HEAL.potion);
  consume(s,p,kind);p.hp+=gained;
  s.heals.push({id:p.id,amount:gained,at:s.time,position:position(s,p)});
  api.effect(s,{kind:'heal',points:[position(s,p)],targets:[p.id],next:'ready'},.85);return true;
 }
 if(kind==='shield'){
  // Two own turns: the activation turn and the owner's next turn, inclusive.
  if(p.shieldTurns>0)return false;consume(s,p,kind);p.shieldTurns=2;
  api.effect(s,{kind:'shield',points:[position(s,p)],targets:[p.id],next:'ready'},.85);return true;
 }
 if(kind==='rocket'){consume(s,p,kind);api.beginMove(s,p,Infinity,'rocket');return true;}
 if(kind==='car'){
  consume(s,p,kind);
  s.skill={kind,nodeId:p.currentNodeId,visited:[p.currentNodeId],
    ...position(s,p),remaining:6,step:null,heading:{x:0,y:0}};
  api.phase(s,'car',6);return true;
 }
 if(kind==='ufo'||kind==='bomber'){
  // The FIRST A only opens the targeting preview. A fresh release followed by
  // a SECOND A is required for a bomber attack, even across network turn tokens.
  s.skill={kind,...position(s,p),angle:0,targetId:null,requiresConfirmRelease:kind==='bomber'};
  // Humans decide when to confirm/cancel. Bots retain an 8-second
  // failsafe so an unreachable target cannot stall an all-bot session.
  api.phase(s,'aim',kind==='bomber'&&!p.isBot?Infinity:8);return true;
 }
 return false;
}
function confirm(s,button,api){
 if(s.phase!=='aim')return false;
 const skill=s.skill,p=api.current(s);
 if(!skill||!p)return false;
 if(skill.kind==='bomber'&&button==='C'){
  // Abort the aircraft preview without consuming stock, dealing damage,
  // or changing the player's movement/roll state.
  api.ready(s);p.actionIndex=ids.indexOf('bomber')+1;
  p.bagMessage='ยกเลิกการใช้เครื่องบิน • ไอเทมยังอยู่';
  return true;
 }
 if(button==='B'&&skill.kind==='bomber'){
  skill.angle=Math.round((skill.angle+Math.PI/4)/(Math.PI/4))%8*(Math.PI/4);
  return true;
 }
 if(button!=='A')return false;
 if(skill.kind==='bomber'&&skill.requiresConfirmRelease)return false;
 if(skill.kind==='ufo'){
  const q=target(s,skill,p);if(!q)return false;
  if(q.shieldTurns>0){q.blockedUntil=s.time+1.2;return false;}
  const points=[position(s,p),position(s,q)],a=p.currentNodeId,b=q.currentNodeId;
  // Validate first, then commit both node IDs in the same host action.
  if(b===s.map.finishId||a===s.map.finishId)return false;
  p.currentNodeId=b;q.currentNodeId=a;delete p.worldPosition;delete q.worldPosition;consume(s,p,skill.kind);s.skill=null;
  api.effect(s,{kind:'ufo',points,targets:[p.id,q.id],next:'end'},1.25);return true;
 }
 if(skill.kind==='bomber'){
  const points=bombs(skill);consume(s,p,skill.kind);s.skill=null;
  // Freeze the preview geometry for BOTH animation and damage resolution.
  const hit=victims(s,points,p);for(const q of hit)api.damage(s,q,api.DAMAGE.bomber);
  api.effect(s,{kind:'bomber',points,targets:hit.map(q=>q.id),next:'end'},1.6);return true;
 }
 return false;
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function explode(s,api){
 const skill=s.skill,p=api.current(s),points=[{x:skill.x,y:skill.y}],hit=victims(s,points,p);
 for(const q of hit)api.damage(s,q,api.DAMAGE.car);s.skill=null;
 api.effect(s,{kind:'car',points,targets:hit.map(q=>q.id),next:'end'},1.2);
}
function update(s,dt,api){
 const skill=s.skill,p=api.current(s);if(!skill||!p)return;
 const input=api.axes(s,p.id);
 if(s.phase==='aim'){
  const speed=skill.kind==='ufo'?420:360;
  skill.x=Math.max(45,Math.min(s.map.width-45,skill.x+input.x*speed*dt));
  skill.y=Math.max(45,Math.min(s.map.height-45,skill.y+input.y*speed*dt));
  skill.targetId=skill.kind==='ufo'?target(s,skill,p)?.id||null:null;
  if(s.time>=s.deadline){s.skill=null;api.ready(s,false);}
 }else if(s.phase==='car'){
  skill.remaining=Math.max(0,skill.remaining-dt);
  if(skill.remaining<=0){explode(s,api);return;}
  const strength=Math.hypot(input.x,input.y);
  // No synthetic node-choice hold: joystick steers continuously along the
  // drivable forward network. Reverse thrust cannot revisit an old edge.
  if(strength>.12){
   const stick={x:input.x/strength,y:input.y/strength};
   if(!skill.step){
    const next=s.map.nodes[skill.nodeId].nextNodes.filter(n=>!skill.visited.includes(n));
    if(!next.length){explode(s,api);return;}
    const to=window.BoardMap.choose(s.map,skill.nodeId,stick.x,stick.y,next);
    const node=s.map.nodes[skill.nodeId].position,target=s.map.nodes[to].position;
    const len=Math.hypot(target.x-node.x,target.y-node.y)||1;
    const dot=(stick.x*(target.x-node.x)+stick.y*(target.y-node.y))/len;
    if(dot>.22)skill.step={from:skill.nodeId,to,t:0,lateral:0,
      startPosition:{x:skill.x,y:skill.y},endPosition:{...target}};
   }
   if(skill.step){
    const m=skill.step,a=m.startPosition,b=m.endPosition;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
    const forward=Math.max(0,stick.x*nx+stick.y*ny);
    const lateral=-stick.x*ny+stick.y*nx;
    const old={x:skill.x,y:skill.y};
    m.t=Math.min(1,m.t+forward*345*dt/len);
    m.lateral=Math.max(-15,Math.min(15,m.lateral+lateral*345*dt));
    skill.x=a.x+dx*m.t-ny*m.lateral;
    skill.y=a.y+dy*m.t+nx*m.lateral;
    skill.heading={x:nx,y:ny};
    const collision=s.players.some(q=>q.id!==p.id&&
      segmentDistance(position(s,q),old,skill)<=radius+12);
    if(collision){explode(s,api);return;}
    if(m.t>=1){skill.nodeId=m.to;skill.visited.push(m.to);
      skill.step=null;}
   }
  }

 }
}
window.BoardItems=Object.freeze({names,ids,radius,blastRadius,bag,counts,availableSlots,add,position,positionOnNode,target,bombs,victims,begin,confirm,update,segmentDistance});
})();
