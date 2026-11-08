'use strict';
/* Non-destructive final V9 graph audit. Run with --strict in CI. */
const fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},Math,Date,console});
for(const file of ['board-map.js','board-v7-design.js','board-branch-naming.js','board-v7-adapter.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const M=ctx.window.BoardMap,D=ctx.window.BOARD_PARTY_V7_DESIGN,m=M.create(0),graph=M.GRAPH_MIGRATION;
const ids=Object.keys(m.nodes),edges=Object.values(m.nodes).flatMap(n=>n.nextNodes.map(to=>n.id+'>'+to));
const edgeSet=new Set(edges),visual=new Set(D.allPathSegments.map(p=>p.from_+'>'+p.to));
const missingVisual=edges.filter(edge=>!visual.has(edge)),staleVisual=[...visual].filter(edge=>!edgeSet.has(edge));
const removed=[...graph.removedExplicit,...graph.removedOrphans],missing=removed.filter(id=>m.nodes[id]);
const starts=new Set(),toVisit=[m.startId];
for(let i=0;i<toVisit.length;i++){const id=toVisit[i];if(starts.has(id))continue;starts.add(id);toVisit.push(...m.nodes[id].nextNodes);}
const ends=new Set(),back=[m.finishId];
for(let i=0;i<back.length;i++){const id=back[i];if(ends.has(id))continue;ends.add(id);back.push(...m.nodes[id].previousNodes);}
const deadEnds=ids.filter(id=>id!==m.finishId&&!m.nodes[id].nextNodes.length);
const inaccessible=ids.filter(id=>!starts.has(id)),cannotFinish=ids.filter(id=>!ends.has(id));
const invalidTerritories=Object.values(m.territories).filter(t=>t.nodeIds.length!==2||
 !m.nodes[t.nodeIds[0]]?.nextNodes.includes(t.nodeIds[1])).map(t=>t.id);
const missingNames=ids.filter(id=>!m.nodePathIds?.[id]||m.nodes[id].pathId!==m.nodePathIds[id]);
const incorrectBridgeRoutes=m.bridgeRoutes.filter(route=>route.nodeIds.slice(1)
 .some((to,i)=>!edgeSet.has(route.nodeIds[i]+'>'+to))).map(r=>r.id);
const report={version:m.version,baseline:{nodes:graph.baselineNodes,edges:graph.baselineEdges},
 after:{nodes:ids.length,edges:edges.length},explicitRemoved:graph.removedExplicit,
 removedStranded:graph.removedOrphans,missingPrefixes:graph.missingPrefixes,
 directM2M3Removed:!edgeSet.has('m2>m3'),
 detourM2Ms20M3:edgeSet.has('m2>ms20_0')&&edgeSet.has('ms20_0>m3'),
 missing,deadEnds,inaccessible,cannotFinish,invalidTerritories,incorrectBridgeRoutes,
 missingVisual,staleVisual,missingNames,retainedWS:ids.filter(id=>id.startsWith('ws')),displayNameCollisions:m.pathIdCollisions,
 blocked:false};
try{M.validate(m);}catch(e){report.validationError=String(e);}
report.blocked=!!(report.validationError||report.after.nodes!==302||report.after.edges!==321||
 !report.directM2M3Removed||!report.detourM2Ms20M3||
 [missing,deadEnds,inaccessible,cannotFinish,invalidTerritories,incorrectBridgeRoutes,
 missingVisual,staleVisual,missingNames,report.retainedWS].some(list=>list.length));
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&report.blocked)process.exitCode=1;
