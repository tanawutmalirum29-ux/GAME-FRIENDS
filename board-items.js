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
function add(p,kind){
 if(!ids.includes(kind))return false;
 bag(p).push(kind);p.item=p.bag[0]||null;return true;
}
function positionOnNode(s,p,nodeId=p.currentNodeId){
 const n=s.map.nodes[nodeId].position;
 const group=s.players.filter(q=>q.id===p.id||q.currentNodeId===nodeId),i=group.findIndex(q=>q.id===p.id);
 // Visual offsets also define the rendered avatar hitboxes; logical nodes never move.
 if(group.length<2)return {...n};
 const cols=group.length>6?4:group.length>3?3:group.length;
 const rows=Math.ceil(group.length/cols),col=i%cols,row=Math.floor(i/cols);
 return{x:n.x+(col-(cols-1)/2)*40,y:n.y+(row-(rows-1)/2)*44};
}
function position(s,p){
 if(s.move?.playerId===p.id){
  const m=s.move;
  if(m.to){
   const a=m.startPosition||s.map.nodes[m.from].position,b=m.endPosition||s.map.nodes[m.to].position;
   const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
   const lateral=m.kind==='walk'?(m.lateral||0):0;
   return{x:a.x+dx*m.t-dy/dist*lateral,y:a.y+dy*m.t+dx/dist*lateral};
  }
  if(m.kind==='walk'&&m.nodeOffset){
   const n=positionOnNode(s,p);
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
 if(index>=0)items.splice(index,1);
 p.item=items[0]||null;
 p.bagIndex=Math.min(p.bagIndex||0,items.length);
 p.bagOpen=false;p.usedRound=s.roundNumber;
}
function begin(s,p,api,kind=bag(p)[p.bagIndex||0]){
 if(s.phase!=='ready'||!kind||!bag(p).includes(kind)||
   p.usedRound===s.roundNumber||s.rolled||s.time>=s.readyDeadline)return false;
 if(kind==='potion'){
  if(p.hp>=3)return false;consume(s,p,kind);p.hp++;api.effect(s,{kind:'heal',points:[position(s,p)],targets:[p.id],next:'ready'},.85);return true;
 }
 if(kind==='shield'){
  // Two own turns: the activation turn and the owner's next turn, inclusive.
  if(p.shieldTurns>0)return false;consume(s,p,kind);p.shieldTurns=2;
  api.effect(s,{kind:'shield',points:[position(s,p)],targets:[p.id],next:'ready'},.85);return true;
 }
 if(kind==='rocket'){consume(s,p,kind);api.beginMove(s,p,5,'rocket');return true;}
 if(kind==='car'){
  consume(s,p,kind);s.skill={kind,nodeId:p.currentNodeId,visited:[p.currentNodeId],...s.map.nodes[p.currentNodeId].position,remaining:6,launchUntil:s.time+.55,step:null};api.phase(s,'car',6);return true;
 }
 if(kind==='ufo'||kind==='bomber'){
  s.skill={kind,...position(s,p),angle:0,targetId:null};api.phase(s,'aim',Math.min(8,s.readyDeadline-s.time));return true;
 }
 return false;
}
function confirm(s,button,api){
 if(s.phase!=='aim')return false;
 const skill=s.skill,p=api.current(s);
 if(button==='B'&&skill.kind==='bomber'){skill.angle=(skill.angle+Math.PI/4)%(2*Math.PI);return true;}
 if(button!=='A')return false;
 if(skill.kind==='ufo'){
  const q=target(s,skill,p);if(!q)return false;
  if(q.shieldTurns>0){q.blockedUntil=s.time+1.2;return false;}
  const points=[position(s,p),position(s,q)],a=p.currentNodeId,b=q.currentNodeId;
  // Validate first, then commit both node IDs in the same host action.
  if(b===s.map.finishId||a===s.map.finishId)return false;
  p.currentNodeId=b;q.currentNodeId=a;consume(s,p,skill.kind);s.skill=null;
  api.effect(s,{kind:'ufo',points,targets:[p.id,q.id],next:'end'},1.25);return true;
 }
 if(skill.kind==='bomber'){
  const points=bombs(skill);consume(s,p,skill.kind);s.skill=null;
  // Freeze the preview geometry for BOTH animation and damage resolution.
  const hit=victims(s,points,p);for(const q of hit)api.damage(s,q,1);
  api.effect(s,{kind:'bomber',points,targets:hit.map(q=>q.id),next:'end'},1.6);return true;
 }
 return false;
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function explode(s,api){
 const skill=s.skill,p=api.current(s),points=[{x:skill.x,y:skill.y}],hit=victims(s,points,p);
 for(const q of hit)api.damage(s,q,1);s.skill=null;
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
  skill.remaining-=dt;
  if(skill.remaining<=0){explode(s,api);return;}
  if(s.time<skill.launchUntil)return;
  if(!skill.step){
   const next=s.map.nodes[skill.nodeId].nextNodes.filter(n=>!skill.visited.includes(n));
   if(!next.length){explode(s,api);return;}
   const to=window.BoardMap.choose(s.map,skill.nodeId,input.x,input.y,next);
   skill.selectedNext=to;
   if(next.length>1){
    if(skill.forkNode!==skill.nodeId){skill.forkNode=skill.nodeId;skill.forkUntil=s.time+.5;}
    if(s.time<skill.forkUntil)return;
   }
   skill.step={from:skill.nodeId,to,t:0};
  }
  const m=skill.step,a=s.map.nodes[m.from].position,b=s.map.nodes[m.to].position,old={x:skill.x,y:skill.y};
  m.t=Math.min(1,m.t+dt/.65);skill.x=a.x+(b.x-a.x)*m.t;skill.y=a.y+(b.y-a.y)*m.t;
  // Swept collision prevents tunnelling through an avatar between two frames.
  const collision=s.players.some(q=>q.id!==p.id&&segmentDistance(position(s,q),old,skill)<=radius+12);
  if(m.t>=1){skill.nodeId=m.to;skill.visited.push(m.to);skill.step=null;}
  if(collision||skill.remaining<=0)explode(s,api);
 }
}
window.BoardItems=Object.freeze({names,ids,radius,blastRadius,bag,add,position,positionOnNode,target,bombs,victims,begin,confirm,update,segmentDistance});
})();
