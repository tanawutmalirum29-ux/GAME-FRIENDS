function rollOrder(s,p){if(p.dice||s.phase!=='order')return false;p.dice=[D().roll(s.rng),D().roll(s.rng)];p.rollAt=s.time;return true;}
function ready(s){s.camera.bagMapInspect=false;s.move=null;s.skill=null;for(const p of s.players){p.bagOpen=false;if(p.id===current(s)?.id){p.actionIndex=0;p.bagMessage='';}}s.readyDeadline=Infinity;phase(s,'ready',Infinity);}
function startTurn(s){M().assertCompatible(s.map);s.camera.overview=false;s.camera.explore=false;s.rolled=false;s.die=null;s.moveDice=null;s.move=null;s.skill=null;ready(s);}
function endTurn(s){
 if(s.phase==='finished')return;
 // An unused one-hit shield lasts until the end of this BOARD round.
 s.move=null;s.skill=null;s.effect=null;s.lucky=null;s.turnIndex++;
 if(s.turnIndex>=s.order.length){phase(s,'minigame_pending');return;}
 startTurn(s);
}
