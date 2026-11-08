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
 return s.players.filter(q=>q.id!==p.id&&!window.BoardParty.isProtected(s,q)&&q.currentNodeId!==s.map.finishId&&s.map.nodes[q.currentNodeId].progress>s.map.nodes[p.currentNodeId].progress)
  .map(q=>({q,path:route(s,p.currentNodeId,q.currentNodeId)})).filter(v=>!Number.isFinite(maxSteps)||(v.path&&v.path.length-1<=maxSteps))
  .sort((a,b)=>Number.isFinite(maxSteps)?a.path.length-b.path.length:s.map.nodes[b.q.currentNodeId].progress-s.map.nodes[a.q.currentNodeId].progress)[0]?.q;
}
// Route scores cover every downstream tile, not only the next one. Reverse
// Dijkstra handles the directed graph, evaluates future hazard/health tradeoffs,
// and caches each health tier per map instead of rescanning every input frame.
const cachedFutureCosts=new WeakMap();
const hpTier=hp=>hp<=35?0:hp<50?1:hp<70?2:hp<80?3:4;
function tileCost(n,tier){
 let cost=1;
 if(n.type==='danger')cost+=[14,7,3.5,1.5,.65][tier];
 if(n.type==='healing')cost-=[0,.45,.45,.25,0][tier];
 if(n.type==='lucky')cost-=.13;
 return Math.max(.45,cost);
}
function remainingCost(map,tier){
 let variants=cachedFutureCosts.get(map);
 if(!variants){variants=new Map();cachedFutureCosts.set(map,variants);}
 if(variants.has(tier))return variants.get(tier);
 const cost=new Map([[map.finishId,0]]),done=new Set();
 for(;;){
  let cur=null,best=Infinity;
  for(const [id,weight] of cost)if(!done.has(id)&&weight<best){cur=id;best=weight;}
  if(cur===null)break;
  done.add(cur);
  const node=map.nodes[cur],via=best+tileCost(node,tier);
  for(const id of node.previousNodes)if(via<(cost.get(id)??Infinity))cost.set(id,via);
 }
 variants.set(tier,cost);return cost;
}
function chooseNext(s,p,from=p.currentNodeId){
 const options=s.map.nodes[from].nextNodes;
 if(!options.length)return null;
 const tier=hpTier(p.hp),cost=remainingCost(s.map,tier);
 const score=id=>tileCost(s.map.nodes[id],tier)+(cost.get(id)??Infinity);
 return [...options].sort((a,b)=>score(a)-score(b))[0];
}
function update(s,dt,api){
 // Rewards are added directly to every bot's backpack by the host.
 const p=api.current(s);if(!p?.isBot)return;
 if(s.time-s.phaseAt<.5&&!(s.phase==='moving'&&s.move?.kind==='walk'))return;
 if(s.phase==='ready'){
  const bag=window.BoardItems.bag(p);
  const canUse=kind=>p.usedRound!==s.roundNumber&&(
   kind==='potion'?p.hp<70:kind==='shield'?false:
   kind==='rocket'?true:kind==='ufo'?!!forwardTarget(s,p):
   kind==='car'?!!forwardTarget(s,p):
   s.players.some(q=>q.id!==p.id&&!api.isProtected(s,q)));
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
   goal=s.map.nodes[m.to||chooseNext(s,p)]?.position;
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
  const goal=m.to?next?.position:s.map.nodes[chooseNext(s,p,base)]?.position;
  if(!goal)return;
  const dx=goal.x-at.x,dy=goal.y-at.y,d=Math.hypot(dx,dy)||1;
  send(s,p,api,dx/d,dy/d);
 }else if(s.phase==='branch'){
  // All candidates are outgoing graph edges.
  const to=chooseNext(s,p),a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position;
  send(s,p,api,(b.x-a.x)/Math.hypot(b.x-a.x,b.y-a.y),(b.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y));
  // Selection is resolved by the host update before the confirmation arrives.
  if(s.move.kind==='rocket'&&s.branch.selected===to)send(s,p,api,0,0,'A');
 }else if(s.phase==='aim'){
  const skill=s.skill;
  if(!skill)return;
  const q=skill.kind==='ufo'?forwardTarget(s,p):s.players.find(q=>q.id!==p.id&&!api.isProtected(s,q));
  // Cancel an unreachable or timed-out aim, preserving the inventory.
  if(!q||s.time-s.phaseAt>12){
   api.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys:{cancel:true}});
   p.botItemAttemptKey=s.roundNumber+':'+s.turnIndex;p.actionIndex=0;
   return;
  }
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
window.BoardBots=Object.freeze({update,chooseNext,route});
})();
