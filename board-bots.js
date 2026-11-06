/* Bots use the same token-checked input path as phones, never write positions. */
(() => {
'use strict';
function send(s,p,api,x=0,y=0,button=null){
 const packet=keys=>({turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys});
 api.input(s,p.id,packet({axisX:x,axisY:y}));
 if(button)api.input(s,p.id,packet({axisX:x,axisY:y,action:button==='A',alt:button==='B'}));
}
function route(s,from,to){
 const queue=[[from]],seen=new Set([from]);
 while(queue.length){const path=queue.shift(),id=path[path.length-1];if(id===to)return path;
  for(const next of s.map.nodes[id].nextNodes)if(!seen.has(next)){seen.add(next);queue.push([...path,next]);}}
 return null;
}
function forwardTarget(s,p,maxSteps=Infinity){
 return s.players.filter(q=>q.id!==p.id&&!q.shieldTurns&&q.currentNodeId!==s.map.finishId&&s.map.nodes[q.currentNodeId].progress>s.map.nodes[p.currentNodeId].progress)
  .map(q=>({q,path:route(s,p.currentNodeId,q.currentNodeId)})).filter(v=>!Number.isFinite(maxSteps)||(v.path&&v.path.length-1<=maxSteps))
  .sort((a,b)=>Number.isFinite(maxSteps)?a.path.length-b.path.length:s.map.nodes[b.q.currentNodeId].progress-s.map.nodes[a.q.currentNodeId].progress)[0]?.q;
}
function update(s,dt,api){
 if(s.phase==='rewards')for(const p of s.players.filter(p=>p.isBot&&s.pendingItems[p.id])){
  if(s.time-s.phaseAt>1){const pending=s.pendingItems[p.id];send(s,p,api,p.item==='potion'&&p.hp===3||pending.item==='rocket'?1:-1,0);if(s.time-s.phaseAt>1.3)send(s,p,api,0,0,'A');}
 }
 const p=api.current(s);if(!p?.isBot)return;
 if(s.time-s.phaseAt<.5&&!(s.phase==='moving'&&s.move?.kind==='walk'))return;
 if(s.phase==='ready'){
  const use=p.item&&p.usedRound!==s.roundNumber&&(p.item==='potion'?p.hp<3:p.item==='shield'?!p.shieldTurns:p.item==='rocket'?true:p.item==='ufo'?!!forwardTarget(s,p):p.item==='car'?!!forwardTarget(s,p,6):s.players.some(q=>q.id!==p.id&&!q.shieldTurns));
  send(s,p,api,0,0,use?'B':'A');
 }else if(s.phase==='move_ready'||(s.phase==='moving'&&s.move?.kind==='walk')){
  const from=s.map.nodes[p.currentNodeId].position,to=s.map.nodes[s.move.to||s.map.nodes[p.currentNodeId].nextNodes[0]].position,d=Math.hypot(to.x-from.x,to.y-from.y);
  send(s,p,api,(to.x-from.x)/d,(to.y-from.y)/d);
 }else if(s.phase==='branch'){
  const opts=s.branch.options;
  const cost=id=>{const n=s.map.nodes[id];return n.progress-s.map.nodes[p.currentNodeId].progress-(p.hp<2&&n.type==='danger'?4:0)+(p.hp<3&&n.type==='healing'?2:0);};
  const to=[...opts].sort((a,b)=>cost(b)-cost(a))[0],a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position;
  send(s,p,api,(b.x-a.x)/Math.hypot(b.x-a.x,b.y-a.y),(b.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y));
  // Selection is resolved by the host update before the confirmation arrives.
  if(s.move.kind==='rocket'&&s.branch.selected===to)send(s,p,api,0,0,'A');
 }else if(s.phase==='aim'){
  const skill=s.skill,q=skill.kind==='ufo'?forwardTarget(s,p):s.players.find(q=>q.id!==p.id&&!q.shieldTurns);
  if(!q)return;
  const pos=window.BoardItems.position(s,q),dx=pos.x-skill.x,dy=pos.y-skill.y,d=Math.hypot(dx,dy);
  if(d<10)send(s,p,api,0,0,'A');else send(s,p,api,dx/d,dy/d);
 }else if(s.phase==='car'){
  const sk=s.skill,q=forwardTarget(s,p,6);if(!q)return;
  const path=route(s,sk.nodeId,q.currentNodeId);if(!path||path.length<2)return;
  const at=s.map.nodes[sk.nodeId].position,to=s.map.nodes[path[1]].position,d=Math.hypot(to.x-at.x,to.y-at.y)||1;
  send(s,p,api,(to.x-at.x)/d,(to.y-at.y)/d);
 }
}
window.BoardBots=Object.freeze({update});
})();
