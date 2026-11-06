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
 // Rewards are added directly to every bot's backpack by the host.
 const p=api.current(s);if(!p?.isBot)return;
 if(s.time-s.phaseAt<.5&&!(s.phase==='moving'&&s.move?.kind==='walk'))return;
 if(s.phase==='ready'){
  const bag=window.BoardItems.bag(p);
  const canUse=kind=>p.usedRound!==s.roundNumber&&(
   kind==='potion'?p.hp<70:kind==='shield'?!p.shieldTurns:
   kind==='rocket'?true:kind==='ufo'?!!forwardTarget(s,p):
   kind==='car'?!!forwardTarget(s,p):
   s.players.some(q=>q.id!==p.id&&!q.shieldTurns));
  // A failed UFO/bomber aim expires back to ready. Without a forced-roll
  // timeout a bot must not enter the same failed item indefinitely.
  const botTurnKey=s.roundNumber+':'+s.turnIndex;
  const target=p.botItemAttemptKey===botTurnKey?null:bag.find(canUse);
  const desiredIndex=target?window.BoardItems.ids.indexOf(target)+1:0;
  const currentIndex=Math.min(window.BoardItems.ids.length,Math.max(0,Math.trunc(p.actionIndex||0)));
  // The bot uses the same fixed [Roll, ...item types] cycle as a phone.
  // Record an attempted item before A so unsuccessful casts fall back to Roll.
  if(currentIndex===desiredIndex&&desiredIndex>0)p.botItemAttemptKey=botTurnKey;
  send(s,p,api,0,0,currentIndex===desiredIndex?'A':'B');
 }else if(s.phase==='move_ready'||(s.phase==='moving'&&s.move?.kind==='walk')){
  const m=s.move,from=window.BoardItems.position(s,p),
   goal=s.map.nodes[m.to||s.map.nodes[p.currentNodeId].nextNodes[0]]?.position;
  if(!goal)return;
  // Reach the current checkpoint before aiming around the next bend. On a
  // tight island hairpin, blending the next edge can point backwards and
  // strand a bot indefinitely just short of the current node.
  const dx=goal.x-from.x,dy=goal.y-from.y;
  const d=Math.hypot(dx,dy)||1;
  send(s,p,api,dx/d,dy/d);
 }else if(s.phase==='rocket'){
  const m=s.move,at=window.BoardItems.position(s,p),base=m.to||p.currentNodeId;
  const next=m.to?s.map.nodes[m.to]:s.map.nodes[p.currentNodeId];
  const goal=m.to?next?.position:s.map.nodes[base].nextNodes
   .map(id=>s.map.nodes[id]).sort((a,b)=>b.progress-a.progress)[0]?.position;
  if(!goal)return;
  const dx=goal.x-at.x,dy=goal.y-at.y,d=Math.hypot(dx,dy)||1;
  send(s,p,api,dx/d,dy/d);
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
  // UFO bots must also steer the marker before confirming. If the target is
  // already next to the caster, nudge away first to arm deliberate aiming.
  if(skill.kind==='ufo'&&(skill.aimTravel||0)<window.BoardItems.UFO_AIM_TRAVEL_MIN&&d<12){
   send(s,p,api,1,0);
  }else if(d<10&&(!skill.requiresConfirmRelease)&&
    (skill.kind!=='ufo'||(skill.aimTravel||0)>=window.BoardItems.UFO_AIM_TRAVEL_MIN)){
   send(s,p,api,0,0,'A');
  }else if(d>0){
   send(s,p,api,dx/d,dy/d);
  }
 }else if(s.phase==='car'){
  const sk=s.skill,q=forwardTarget(s,p);
  const choices=s.map.nodes[sk.step?.to||sk.nodeId].nextNodes;
  const path=q?route(s,sk.nodeId,q.currentNodeId):null;
  const toId=sk.step?.to||path?.[1]||choices[0];
  if(!toId)return;
  const at={x:sk.x,y:sk.y},to=s.map.nodes[toId].position;
  const dx=to.x-at.x,dy=to.y-at.y,d=Math.hypot(dx,dy)||1;
  send(s,p,api,dx/d,dy/d);
 }
}
window.BoardBots=Object.freeze({update});
})();
