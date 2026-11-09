function effect(s,fx,duration){s.effect={...fx,duration,at:s.time};phase(s,'effect',duration);}
// Protection is a SINGLE-use guard. The first incoming hostile HP hit, UFO
// displacement or negative effect consumes the shield immediately. If it
// never triggers, the round transition expires it as before.
function isProtected(s,p){return !!p&&p.shieldTurns>0&&p.shieldRound===s.roundNumber;}
function blockHarm(s,p){
 if(!isProtected(s,p))return false;
 p.shieldTurns=0;p.shieldRound=null;p.shieldBrokenAt=s.time;
 p.blockedUntil=s.time+1.2;
 return true;
}
function damage(s,p,amount){
 const actual=Math.min(p.hp,Math.max(0,Math.round(amount)));
 if(!actual)return false; // A zero-damage event cannot waste the one-use shield.
 if(blockHarm(s,p))return false;
 const position=I().position(s,p);
 p.hp=Math.max(0,p.hp-actual);p.hurtUntil=s.time+1.2;
 s.hits.push({id:p.id,amount:actual,at:s.time,position,color:p.color});
 if(s.hits.length>32)s.hits.shift();
 if(p.hp)return false;
 p.death={at:s.time,position};
 p.currentNodeId=s.map.startId;delete p.worldPosition;p.hp=MAX_HP;p.shieldTurns=0;p.shieldRound=null;
 // Inventory and claimed sword tiles survive this respawn.
 if(current(s)?.id===p.id){s.move=null;s.skill=null;}
 return true;
}
function win(s,p){
 if(p.currentNodeId!==s.map.finishId)return;
 if(s.phase==='finished'){if(s.time===s.phaseAt&&!s.winnerIds.includes(p.id))s.winnerIds.push(p.id);return;}
 s.winnerIds=[p.id];s.move=null;s.skill=null;phase(s,'finished');
}
