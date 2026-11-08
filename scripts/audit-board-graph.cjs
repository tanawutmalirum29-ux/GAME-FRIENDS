/* BOARD PARTY destructive-change preflight. NO mutation of the deployed map.
   --strict refuses completion until the requested deletions preserve playability. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},Math,Date,console});
for(const name of ['board-map.js','board-v7-design.js','board-v7-adapter.js'])
 vm.runInContext(fs.readFileSync(name,'utf8'),ctx,{filename:name});
const map=ctx.window.BoardMap.create(0),all=Object.values(map.nodes);
const exact=new Set(['ms18_0','ms18_1','ms19_0']);
const prefixes=['xbc','ss','hs','xhb','xgb','gs','wsxmout','xab'];
const oldEdges=all.flatMap(n=>n.nextNodes.map(id=>[n.id,id]));
const toDelete=Object.keys(map.nodes).filter(id=>exact.has(id)||prefixes.some(p=>id.startsWith(p)));
const deleted=new Set(toDelete);
const nodes=Object.fromEntries(all.filter(n=>!deleted.has(n.id))
 .map(n=>[n.id,{...n,nextNodes:n.nextNodes.filter(id=>!deleted.has(id))}]));
// The requested m2 -> m3 direct edge is removed; the existing detour remains.
if(nodes.m2)nodes.m2.nextNodes=nodes.m2.nextNodes.filter(id=>id!=='m3');
const live=Object.values(nodes),newEdges=live.flatMap(n=>n.nextNodes.map(id=>[n.id,id]));
const prev=new Map(live.map(n=>[n.id,[]]));
for(const [from,to] of newEdges){if(!prev.has(to))throw Error('Dangling edge '+from+'>'+to);prev.get(to).push(from);}
function trace(start,reverse){
 const seen=new Set(),todo=[start];
 while(todo.length){const id=todo.pop();
  if(seen.has(id)||!nodes[id])continue;
  seen.add(id);todo.push(...(reverse?prev.get(id):nodes[id].nextNodes));}
 return seen;
}
const starts=trace(map.startId,false),finishes=trace(map.finishId,true);
const deadEnds=live.filter(n=>n.id!==map.finishId&&!n.nextNodes.length).map(n=>n.id);
const inaccessible=live.filter(n=>!starts.has(n.id)).map(n=>n.id);
const cannotFinish=live.filter(n=>!finishes.has(n.id)).map(n=>n.id);
const brokenTerritories=Object.values(map.territories)
 .filter(t=>t.nodeIds.some(id=>deleted.has(id))||
   t.nodeIds.length===2&&!nodes[t.nodeIds[0]]?.nextNodes.includes(t.nodeIds[1]))
 .map(t=>({id:t.id,nodeIds:t.nodeIds}));
const brokenBridgeRoutes=map.bridgeRoutes.filter(r=>r.nodeIds.some(id=>deleted.has(id)))
 .map(r=>r.id);
const report={
 original:{version:map.version,nodes:all.length,directedEdges:oldEdges.length},
 proposal:{nodes:live.length,directedEdges:newEdges.length},
 removed:toDelete,
 missingExact:[...exact].filter(id=>!map.nodes[id]),
 noMatchingPrefixes:prefixes.filter(p=>!Object.keys(map.nodes).some(id=>id.startsWith(p))),
 directM2M3Removed:!nodes.m2?.nextNodes.includes('m3'),
 existingM2Ms20M3Preserved:!!nodes.m2?.nextNodes.includes('ms20_0')&&
    !!nodes.ms20_0?.nextNodes.includes('m3'),
 deadEnds,inaccessible,cannotFinish,brokenTerritories,brokenBridgeRoutes,
 blocked:!!(deadEnds.length||inaccessible.length||cannotFinish.length||brokenTerritories.length||brokenBridgeRoutes.length)
};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&report.blocked)process.exitCode=1;
