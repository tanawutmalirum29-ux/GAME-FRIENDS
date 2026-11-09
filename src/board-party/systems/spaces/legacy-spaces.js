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
 const extension=window.BoardSystemPlugins?.get('spaces',n.type);
 if(extension){
  const outcome=extension.onLand({session:s,player:p,node:n,
   api:Object.freeze({damage,heal:HEAL,MAX_HP,effect,phase,isProtected,blockHarm,
    addItem:kind=>I().add(p,kind)})});
  if(outcome?.handled){
   effect(s,{kind:outcome.dead?'death':outcome.kind||'land',points:[n.position],
    targets:[p.id],next:!outcome.dead&&m?.kind==='rocket'?'ready':'end'},
    outcome.dead?1.5:.8);
   return;
  }
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
 let swordLoot=null;
 if(n.type==='danger'){
  const shielded=isProtected(s,p);
  dead=damage(s,p,DAMAGE.skull);kind=shielded?'shieldBreak':'hurt';
 }
 if(n.type==='event'){
  if(s.rng()<.5){p.hp=Math.min(MAX_HP,p.hp+HEAL.event);kind='heal';}
  else{const shielded=isProtected(s,p);dead=damage(s,p,DAMAGE.event);kind=shielded?'shieldBreak':'hurt';}
 }
 if(n.type==='sword'){
  const territory=s.map.territories[n.territoryId];
  if(!territory)throw Error('Missing sword territory');
  if(territory.ownerId==null){
   territory.ownerId=p.id;
   for(const id of territory.nodeIds)s.map.nodes[id].ownerId=p.id;
   kind='swordClaim';
  }else if(territory.ownerId===p.id)kind='swordSafe';
  else{
   const shielded=isProtected(s,p);
   dead=damage(s,p,DAMAGE.sword);
   kind=shielded?'shieldBreak':'swordHit';
   // Only a DEATH caused by this owned sword grants the defending owner one
   // random item. Claiming a sword, nonfatal hits and shield blocks pay none.
   if(dead){
    const owner=s.players.find(q=>q.id===territory.ownerId);
    if(owner){
     const pool=I().ids,index=Math.min(pool.length-1,Math.max(0,Math.floor(s.rng()*pool.length)));
     const item=pool[index];
     if(!I().add(owner,item))throw Error('Invalid sword kill reward');
     swordLoot={ownerId:owner.id,victimId:p.id,territoryId:territory.id,item};
     s.swordRewards.push({...swordLoot,at:s.time});
     if(s.swordRewards.length>32)s.swordRewards.shift();
    }
   }
  }
 }
 effect(s,{kind:dead?'death':kind,points:[n.position],targets:[p.id],
  swordLoot,
  ownerColor:n.type==='sword'?s.players.find(q=>q.id===n.ownerId)?.color:null,
  next:!dead&&m?.kind==='rocket'?'ready':'end'},dead?1.5:.8);
}
