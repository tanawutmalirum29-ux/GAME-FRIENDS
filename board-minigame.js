/* The adapter reads engine outcomes; no board HP or coordinates enter an engine. */
(() => {
'use strict';
function eligible(registry,count){return Object.keys(registry).filter(id=>{const e=registry[id];return id!=='board'&&e&&typeof e.setup==='function'&&typeof e.update==='function'&&typeof e.draw==='function'&&count>=(e.minPlayers||1)&&count<=(e.maxPlayers||12);});}
function pick(registry,count,previous,rng=Math.random){const all=eligible(registry,count),pool=all.length>1?all.filter(x=>x!==previous):all;return pool[Math.floor(rng()*pool.length)]||null;}
function ranking(round,players){
 const value=p=>{
  switch(round.mode){
   case 'ghost':return !p.ghost?Infinity:Math.floor((Number.isFinite(p.infectedAt)?p.infectedAt:p.survival||0)*10+1e-7);
   case 'fruit_memory':return p.id===round.fruitMemory.winnerId?Infinity:(p.fruitEliminatedRound||p.fruitRounds||0);
   case 'shockwave':return p.id===round.shockwave.winnerId?Infinity:(p.shockEliminatedAt||0);
    case 'boulder_bash':return p.bb?.alive?Infinity:(p.bb?.eliminatedTick??0);
    case 'snow_brawl':return p.snow?.alive?Infinity:(p.snow?.eliminatedTick??0);
     case 'witching_snake':return p.ws?.alive?Infinity:(p.ws?.eliminatedTick??0);
   case 'color_claim':return round.colorClaim?.counts[p.cc?.slot]||0;
   case 'color_switch':case 'chickens':case 'pizza_time':case 'shopping_time':case 'lawn_mower':case 'knight_match':return Number(p.score)||0;
   default:throw Error('Missing result adapter for '+round.mode);
  }
 };
 const list=players.filter(p=>p.active).map(p=>({id:p.id,value:value(p)}));
 for(const p of list){p.rank=1+list.filter(q=>q.value>p.value).length;p.label=p.value===Infinity?'ผู้รอดชีวิต':round.mode==='ghost'?(p.value/10).toFixed(1)+' วินาที':round.mode==='shockwave'?'ตกรอบชุดที่ '+p.value:round.mode==='fruit_memory'?'รอดถึงรอบ '+p.value:round.mode==='boulder_bash'?'ตกรอบรอบฟิสิกส์ '+p.value:round.mode==='snow_brawl'?'ตกรอบรอบฟิสิกส์ '+p.value:round.mode==='witching_snake'?'ตกรอบ Tick '+p.value:p.value+(round.mode==='color_claim'?' ช่องพื้นที่':' คะแนน');}
 return list.sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
}
function rewards(ranking,count,rng=Math.random){
 let quota=Math.floor(count*.5);const ids=[];
 for(const rank of [...new Set(ranking.map(p=>p.rank))].sort((a,b)=>a-b)){
  const tied=ranking.filter(p=>p.rank===rank).map(p=>p.id);
  const group=tied.length>quota?window.BoardDice.shuffle(tied,rng):tied;
  ids.push(...group.slice(0,quota));quota-=Math.min(quota,group.length);if(!quota)break;
 }
 return ids;
}
window.BoardMinigame=Object.freeze({eligible,pick,ranking,rewards});
})();
