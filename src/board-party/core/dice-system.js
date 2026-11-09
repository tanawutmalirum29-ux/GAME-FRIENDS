function roll(s){
 if(s.phase!=='ready'||s.rolled)return false;
 const p=current(s);if(p){p.bagOpen=false;p.bagMessage='';}
 s.rolled=true;s.moveDice=[D().roll(s.rng),D().roll(s.rng)];s.die=s.moveDice[0]+s.moveDice[1];
 phase(s,'dice',D().TIMING.throw+D().TIMING.hold);return true;
}
function remainingSteps(s,id){if(!id)return 0;return s.move?.playerId===id?s.move.remaining:current(s)?.id===id&&s.phase==='dice'&&s.time-s.phaseAt>=D().TIMING.throw?s.die:0;}
