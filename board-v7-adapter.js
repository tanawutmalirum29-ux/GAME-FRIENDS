/* BOARD PARTY v7: graph-only adapter. Original dice, items, camera and
 * v6 authored tile types stay unchanged. New tiles retain their v7 draft
 * types until the owner reviews them. Do not import offline art into logic. */
(()=>{
'use strict';
const Base=window.BoardMap,D=window.BOARD_PARTY_V7_DESIGN;
if(!Base||!D)throw Error('BOARD v7: load board-map and design before adapter');
const VERSION='winter-expedition-152-v7',copy=x=>JSON.parse(JSON.stringify(x));
const BASE_NODES=213,EXTRA_NODES=146,ISLANDS=17,BRIDGES=20;
const original=Base.create(0),oldIds=new Set(Object.keys(original.nodes));
if(oldIds.size!==BASE_NODES||D.newNodes.length!==EXTRA_NODES||
 D.islands.length!==ISLANDS||D.bridges.length!==BRIDGES)
 throw Error('BOARD v7 input count mismatch');
const seen=new Set();
for(const n of D.newNodes){
 if(oldIds.has(n.id)||seen.has(n.id))throw Error('Duplicate v7 node '+n.id);
 seen.add(n.id);
}
function create(seed=Date.now()){
 const m=Base.create(seed);m.version=VERSION;
 const originals=new Map(m.islands.map(i=>[i.id,i]));
 m.islands=D.islands.map(i=>{
  const old=originals.get(i.id);
  return old?{...old,name:i.name,theme:i.theme,center:copy(i.center),outline:copy(i.outline)}
   :{id:i.id,name:i.name,theme:i.theme,center:copy(i.center),outline:copy(i.outline),
     landmark:copy(i.center),nodeIds:[],decorations:[]};
 });
 const regions=new Map(m.islands.map(i=>[i.id,i]));
 for(const n of D.newNodes){
  const v={id:n.id,position:copy(n.position),type:n.type,
   nextNodes:[...n.nextNodes],previousNodes:[],islandId:n.islandId||null,
   bridgeId:n.bridgeId||null,progress:0,remainingSteps:0,longestRemainingSteps:0,effects:{hp:0}};
  m.nodes[v.id]=v;
  if(v.islandId){
   const region=regions.get(v.islandId);if(!region)throw Error('Unknown island '+v.islandId);
   region.nodeIds.push(v.id);
  }
  if(v.type==='lucky')m.luckyTileIds.push(v.id);
  if(v.type==='sword'){
   const id='v7-sword-'+v.id;
   m.territories[id]={id,nodeIds:[v.id],ownerId:null};
   v.territoryId=id;v.ownerId=null;
  }
 }
 for(const [id,next] of Object.entries(D.patchOldNextNodes)){
  const p=m.nodes[id];if(!p)throw Error('Missing original connector '+id);
  for(const dest of next)if(!p.nextNodes.includes(dest))p.nextNodes.push(dest);
 }
 for(const n of Object.values(m.nodes))n.previousNodes=[];
 for(const n of Object.values(m.nodes))for(const id of n.nextNodes){
  const p=m.nodes[id];if(!p)throw Error('Missing edge '+n.id+' → '+id);
  p.previousNodes.push(n.id);
 }
 for(const route of D.bridges){
  m.bridgeRoutes.push({id:route.id,style:route.style,nodeIds:[...route.nodeIds]});
  for(let j=1;j<route.nodeIds.length;j++){
   const a=route.nodeIds[j-1],b=route.nodeIds[j],key=a+'>'+b;
   m.bridges.push([a,b]);m.bridgeStyles[key]=route.style;
  }
 }
 // Backward BFS is finite even for intentionally directed v7 loops.
 const dist=new Map([[m.finishId,0]]),queue=[m.finishId];
 for(let i=0;i<queue.length;i++){
  const n=m.nodes[queue[i]],d=dist.get(n.id);
  for(const id of n.previousNodes)if(!dist.has(id)){dist.set(id,d+1);queue.push(id);}
 }
 for(const n of Object.values(m.nodes)){
  const d=dist.get(n.id);if(d==null)throw Error('No finish path from '+n.id);
  n.remainingSteps=d;n.longestRemainingSteps=d;
  if(seen.has(n.id))n.progress=Math.max(0,Base.MAIN_LENGTH-d);
 }
 return m;
}
function assertCompatible(map){
 if(map?.version!==VERSION)throw Error('Incompatible BOARD PARTY map '+(map?.version||'missing')+'; start a new game ('+VERSION+')');
 return true;
}
function validate(m){
 assertCompatible(m);
 const all=Object.entries(m.nodes),idSet=new Set(all.map(([id])=>id));
 if(all.length!==BASE_NODES+EXTRA_NODES||idSet.size!==all.length||
 m.islands.length!==ISLANDS||m.startId!=='n0'||m.finishId!=='n152'||
 m.nodes.n0.type!=='start'||m.nodes.n152.type!=='finish'||
 m.nodes.n152.nextNodes.length||m.length!==Base.MAIN_LENGTH)
  throw Error('BOARD v7 map endpoints or counts invalid');
 const islands=new Map(m.islands.map(i=>[i.id,i])),bridges=new Set();
 if(islands.size!==ISLANDS)throw Error('Duplicate island');
 for(const [a,b]of m.bridges){const k=a+'>'+b;if(bridges.has(k))throw Error('Duplicate bridge '+k);bridges.add(k);}
 const visited=new Set(),todo=[m.startId];
 while(todo.length){const id=todo.pop();if(visited.has(id))continue;visited.add(id);todo.push(...m.nodes[id].nextNodes);}
 if(visited.size!==all.length)throw Error('Unreachable BOARD v7 nodes');
 const assigned=new Set();
 for(const region of m.islands){
  if(region.outline.length<3)throw Error('Invalid island '+region.id);
  for(const id of region.nodeIds){
   if(assigned.has(id)||m.nodes[id]?.islandId!==region.id)throw Error('Island membership '+id);
   assigned.add(id);
  }
 }
 for(const [id,n]of all){
  if(n.id!==id||!Number.isFinite(n.position.x)||!Number.isFinite(n.position.y)||
    n.position.x<0||n.position.y<0||n.position.x>m.width||n.position.y>m.height)
    throw Error('Invalid node position '+id);
  if(id!==m.finishId&&!n.nextNodes.length)throw Error('Dead end '+id);
  if(n.islandId?!assigned.has(id):!n.bridgeId)throw Error('Unassigned node '+id);
  if(!Number.isFinite(n.remainingSteps)||n.remainingSteps<0||!Number.isFinite(n.progress))
    throw Error('Non-finite distance/progress '+id);
  if(new Set(n.nextNodes).size!==n.nextNodes.length||new Set(n.previousNodes).size!==n.previousNodes.length)
    throw Error('Duplicate node edge '+id);
  for(const dest of n.nextNodes)if(!m.nodes[dest]?.previousNodes.includes(id))throw Error('Missing reverse edge '+id+' → '+dest);
  for(const src of n.previousNodes)if(!m.nodes[src]?.nextNodes.includes(id))throw Error('Missing forward edge '+src+' → '+id);
  if(!['start','finish','movement','sword','lucky','healing','danger'].includes(n.type))
    throw Error('Unsupported tile '+id);
  if(n.type==='sword'&&!m.territories[n.territoryId]?.nodeIds?.includes(id))
    throw Error('Unregistered sword territory '+id);
 }
 for(let i=0;i<Base.MAIN_LENGTH;i++)if(!m.nodes['n'+i].nextNodes.includes('n'+(i+1)))
   throw Error('Original main path broken at n'+i);
 for(const route of m.bridgeRoutes)for(let i=1;i<route.nodeIds.length;i++){
  const a=route.nodeIds[i-1],b=route.nodeIds[i],key=a+'>'+b;
  if(!m.nodes[a].nextNodes.includes(b)||!bridges.has(key)||m.bridgeStyles[key]!==route.style)
   throw Error('Bridge disconnected '+route.id+' '+key);
 }
 return true;
}
validate(create(0));
window.BoardMap=Object.freeze({...Base,MAP_VERSION:VERSION,create,assertCompatible,validate});
})();
