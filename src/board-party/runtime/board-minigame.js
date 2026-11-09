/* The adapter reads engine outcomes; no board HP or coordinates enter an engine. */
(() => {
'use strict';
function eligible(registry,count){return Object.keys(registry).filter(id=>{const e=registry[id];return id!=='board'&&e&&typeof e.setup==='function'&&typeof e.update==='function'&&typeof e.draw==='function'&&count>=(e.minPlayers||1)&&count<=(e.maxPlayers||12);});}
function pick(registry,count,previous,rng=Math.random){const all=eligible(registry,count),pool=all.length>1?all.filter(x=>x!==previous):all;return pool[Math.floor(rng()*pool.length)]||null;}
function ranking(round,players){
 const plugin=round?.pluginEngine||window.GamePlatform?.engine(round.mode);
 if(plugin&&typeof plugin.getResult==='function'){
  const active=players.filter(p=>p.active),results=plugin.getResult(round,players);
  if(!Array.isArray(results)||results.length!==active.length)throw Error('Invalid plug-in result');
  const values=new Map();
  for(const item of results){
   if(!item||typeof item.id!=='string'||values.has(item.id)||
    typeof item.value!=='number'||Number.isNaN(item.value))throw Error('Invalid plug-in score');
   values.set(item.id,item);
  }
  if(active.some(p=>!values.has(p.id)))throw Error('Missing plug-in participant');
  return active.map(p=>{
   const item=values.get(p.id),rank=1+active.filter(q=>values.get(q.id).value>item.value).length;
   return {id:p.id,value:item.value,rank,label:typeof item.label==='string'?item.label:
    item.value===Infinity?'ผู้รอดชีวิต':item.value+' คะแนน'};
  }).sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 }
 throw Error('Missing minigame getResult provider: '+String(round?.mode||'unknown'));
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
