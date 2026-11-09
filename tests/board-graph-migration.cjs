'use strict';
// A standalone test from a fresh checkout restores only missing/stale outputs.
require('../scripts/build-board-v7.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},Math,Date,console});
for(const path of ['src/board-party/runtime/board-map.js','src/board-party/runtime/board-v7-design.js','src/board-party/runtime/board-branch-naming.js','src/board-party/runtime/board-v7-adapter.js'])
 vm.runInContext(fs.readFileSync(path,'utf8'),ctx,{filename:path});
const {BoardMap:M,BOARD_PARTY_V7_DESIGN:D,BoardBranchNaming:N}=ctx.window;
const map=M.create(0),ids=Object.keys(map.nodes),edges=Object.values(map.nodes).flatMap(n=>n.nextNodes.map(to=>n.id+'>'+to));
assert.equal(map.version,'winter-expedition-152-v10');
for(const [a,b] of [['m7','m0'],['w7','w0'],['s7','s0'],['xmout_2','n108']])
 assert.equal(map.nodes[a].nextNodes.includes(b),false,'V10 cannot return to original entry: '+a+'>'+b);
for(const [a,b] of [['m7','xmout_1'],['w7','xwf_1'],['s7','xba_1'],['xmout_2','n56']])
 assert.ok(map.nodes[a].nextNodes.includes(b),'V10 has a new forward tour exit '+a+'>'+b);
for(const place of ['harbor','ginger'])
 assert.equal(map.islands.find(i=>i.id===place).decorations.length,1,
  'compact island must have a fixed signature landmark: '+place);
assert.equal(ids.length,302);assert.equal(edges.length,318);
assert.equal(M.GRAPH_MIGRATION.baselineNodes,359);
assert.equal(M.GRAPH_MIGRATION.baselineEdges,398);
assert.equal(M.GRAPH_MIGRATION.removedExplicit.length,44);
assert.equal(M.GRAPH_MIGRATION.removedOrphans.length,13);
assert.equal(M.GRAPH_MIGRATION.missingPrefixes.join(','),'wsxmout');
assert.equal(D.newNodes.length,89);assert.equal(D.bridges.length,15);
assert.equal(M.validate(map),true);
assert.equal(map.nodes.m2.nextNodes.includes('m3'),false);
assert.equal(map.nodes.m2.nextNodes.includes('ms20_0'),true);
assert.equal(map.nodes.ms20_0.nextNodes.includes('m3'),true);
for(const id of [...M.GRAPH_MIGRATION.removedExplicit,...M.GRAPH_MIGRATION.removedOrphans])
 assert.equal(map.nodes[id],undefined,'deleted node absent from authoritative map '+id);
const oldWorkshop=['ws0_0','ws1_0','ws2_0','ws5_0','ws8_0','ws9_0','ws9_1','ws9_2'];
for(const id of oldWorkshop)assert.equal(map.nodes[id],undefined,'retired ws node must not exist: '+id);
for(const id of ids)assert.ok(!id.startsWith('ws'),'ws prefix cannot survive authoritative graph: '+id);
for(const [from,mid,to] of [
 ['w0','ws0_0','w1'],['w1','ws1_0','w2'],
 ['w2','ws2_0','w3'],['w5','ws5_0','w6']
]){
 assert.equal(map.nodes[from].nextNodes.includes(to),true,
  'preserve the real Workshop island route across retired '+mid);
 assert.equal(map.nodes[from].nextNodes.includes(mid),false);
}
assert.equal(map.territories['v8-court-workshop-watch'].nodeIds.join(','),'w6,w7',
 'do not delete/move the two adjacent workshop swords');
const visible=new Set(D.allPathSegments.map(p=>p.from_+'>'+p.to));
const artworkMetadata={
 nodes:D.newNodes,positions:D.allNodePositions,roads:D.roads,
 paths:D.allPathSegments,roadSegments:D.existingRoadSegments,
 bridgeSegments:D.existingBridgeSegments,bridges:D.bridges,
 patches:D.patchOldNextNodes
};
assert.doesNotMatch(JSON.stringify(artworkMetadata),/\bws\d+_\d+\b/,
 'playable and drawn map metadata must contain no old ws node references');
// Migration report deliberately keeps old IDs in its audit history only.
assert.equal(oldWorkshop.filter(id=>M.GRAPH_MIGRATION.removedExplicit.includes(id)).length,8);
assert.deepEqual([...visible].sort(),[...new Set(edges)].sort(),
 'no ghost or missing vector path; full physical/visual parity');
assert.equal(map.idMigration.length,302);assert.equal(Object.keys(map.nodePathIds).length,302);
assert.equal(new Set(map.idMigration.map(row=>row.internalId)).size,302);
const computed=N.fromGraph(map);
assert.deepEqual(JSON.parse(JSON.stringify(computed.nodePathIds)),JSON.parse(JSON.stringify(map.nodePathIds)));
for(const row of map.idMigration){
 assert.equal(row.oldId,row.internalId,'stable internal keys');
 assert.equal(row.displayId,map.nodes[row.internalId].pathId);
 if(/^n\d+$/.test(row.oldId))assert.equal(row.displayId,row.oldId);
 else assert.match(row.displayId,/^[a-z]+_\d+$/);
}
const collisions=Object.entries(map.idMigration.reduce((groups,row)=>{
 (groups[row.displayId]??=[]).push(row.internalId);return groups;
},{})).filter(([,list])=>list.length>1).map(([displayId])=>displayId).sort();
assert.deepEqual(collisions,JSON.parse(JSON.stringify(map.pathIdCollisions.map(c=>c.displayId).sort())));
for(const [territory,a,b] of [['v8-court-harbor-watch','h2','h3'],['v8-court-ginger-watch','g4','g5']]){
 assert.deepEqual(JSON.parse(JSON.stringify(map.territories[territory].nodeIds)),[a,b]);
 assert.equal(map.nodes[a].nextNodes.includes(b),true);
}
for(const seed of [1,42,997]){
 const other=M.create(seed);
 assert.equal(JSON.stringify(other.nodePathIds),JSON.stringify(map.nodePathIds));
 assert.equal(JSON.stringify(other.idMigration),JSON.stringify(map.idMigration));
}
console.log('BOARD V10 structural and identity migration PASS (302 nodes, 318 edges, no ghost paths)');
