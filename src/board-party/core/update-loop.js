function update(s,dt){
 M().assertCompatible(s.map);
 if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);s.time+=dt;
 // The panorama is an automatic, fixed 2-second intro for bot AND human lobbies.
  if(s.phase==='overview'){if(s.time-s.phaseAt>=INTRO_OVERVIEW_SECONDS-1e-6)beginIntroZoom(s);}
 else if(s.phase==='intro_zoom'){if(s.time+1e-6>=s.deadline)beginOrder(s);}
 else if(s.phase==='order'){
  for(const p of s.players)if(!p.dice&&p.isBot&&s.time-s.phaseAt>.6+s.players.indexOf(p)*.12)rollOrder(s,p);
  if(s.players.every(p=>p.dice&&s.time-p.rollAt>=D().TIMING.throw+D().TIMING.hold/2)){s.order=D().order(s.players,s.rng);phase(s,'order_result',3);}
 }else if(s.phase==='order_result'&&s.time>=s.deadline)startTurn(s);
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
 else if(s.phase==='effect'){
  const fx=s.effect;
  if(fx?.kind==='bomber'){
   // Apply damage only when the matching bomb reaches the ground AFTER
   // the passing airplane. One target can be damaged only once per volley.
   for(const hit of fx.pendingHits||[]){
    if(!hit.applied&&s.time-fx.at+1e-8>=hit.impact){
     hit.applied=true;
     const target=s.players.find(p=>p.id===hit.id);
     if(target)damage(s,target,DAMAGE.bomber);
    }
   }
  }
  if(s.time>=s.deadline){
   const next=fx.next;s.effect=null;s.lucky=null;
   if(next==='ready')ready(s);else endTurn(s);
  }
 }
 else if(s.phase==='standings'&&s.time>=s.deadline)grant(s);
 else if(s.phase==='rewards'&&s.time>=s.deadline)phase(s,'returning',.6);
 else if(s.phase==='returning'&&s.time>=s.deadline){
  s.roundNumber++;
  // Never carry a shield through the minigame into the next BOARD round.
  for(const p of s.players){p.shieldTurns=0;p.shieldRound=null;}
  s.order=[...s.nextOrder];s.turnIndex=0;phase(s,'round_order',1.8);
 }
 else if(s.phase==='round_order'&&s.time>=s.deadline)startTurn(s);
 for(const plugin of window.BoardSystemPlugins?.list('events')||[])
  plugin.onUpdate({session:s,dt,api});
 window.BoardBots?.update(s,dt,api);
}
