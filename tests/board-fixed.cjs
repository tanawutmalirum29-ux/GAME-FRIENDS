'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('board-map.js','utf8'),ctx=vm.createContext({window:{},console});
vm.runInContext(source,ctx,{filename:'board-map.js'});
const M=ctx.window.BoardMap,plain=x=>JSON.parse(JSON.stringify(x));
const normalize=map=>{const copy=plain(map);delete copy.seed;return JSON.stringify(copy);};
const map=M.create(0),expected=normalize(map),nodes=Object.values(map.nodes);
assert.equal(M.MAIN_LENGTH,152);assert.equal(M.MAP_VERSION,'winter-expedition-152-v5');
for(let seed=1;seed<=1000;seed++)assert.equal(normalize(M.create(seed)),expected,'Full definition, including scenery, must ignore seed '+seed);
const fresh=vm.createContext({window:{},console});vm.runInContext(source,fresh);
assert.equal(normalize(fresh.window.BoardMap.create(9987)),expected,'reload recreates identical geometry and tile effects');
assert.equal(nodes.length,213);assert.equal(map.islands.length,9);
assert.ok(map.islands.filter(i=>i.nodeIds.length>=25).length>=4);
assert.ok(nodes.some(n=>n.nextNodes.length===3),'three-way fork exists');
assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
let at=map.startId,mainEdges=0,previousIsland=null,visitedIslands=new Set(),returns=0;
while(at!==map.finishId){
 const n=map.nodes[at];
 if(n.islandId&&n.islandId!==previousIsland){if(visitedIslands.has(n.islandId))returns++;visitedIslands.add(n.islandId);previousIsland=n.islandId;}
 assert.equal(n.nextNodes[0],'n'+(++mainEdges));at=n.nextNodes[0];
}
assert.equal(mainEdges,152,'count actual main-route edges, not branch nodes');
assert.equal(returns,2,'the MAIN route revisits village and lake through new nodes');
assert.equal(map.nodes.n0.remainingSteps,140,'shortcuts do not skip most of the expedition');
assert.equal(map.nodes.n0.longestRemainingSteps,174);
for(const n of nodes){
 assert.ok(Number.isFinite(n.position.x)&&Number.isFinite(n.position.y));
 for(const to of n.nextNodes){assert.ok(map.nodes[to].previousNodes.includes(n.id));assert.ok(map.nodes[to].progress>n.progress);}
 const seen=new Set();function walk(id){if(seen.has(id))return;seen.add(id);const q=map.nodes[id];if(!q.nextNodes.length)assert.equal(id,map.finishId);for(const next of q.nextNodes)walk(next);}
 walk(n.id);assert.ok(seen.has(map.finishId),'every branch and checkpoint reaches finish');
}
assert.equal(new Set(map.bridgeRoutes.map(b=>b.style)).size,5);
for(const r of map.bridgeRoutes){
 assert.ok(r.nodeIds.length>=3,'bridges contain actual stepping nodes');
 for(let i=1;i<r.nodeIds.length;i++)assert.ok(map.nodes[r.nodeIds[i-1]].nextNodes.includes(r.nodeIds[i]));
}
assert.equal(M.validate(map),true);
assert.deepEqual(plain(map.nodes.b72_5.nextNodes),['n74','b72_6']);
assert.deepEqual(plain(map.nodes.b72_6.previousNodes),['b72_5']);
assert.deepEqual(plain(map.nodes.b72_6.nextNodes),['c76_2']);
assert.ok(map.nodes.c76_2.previousNodes.includes('b72_6'));
assert.equal(map.nodes.b72_6.type,'movement');
assert.equal(map.nodes.b72_6.islandId,'lake');
assert.deepEqual(plain(map.nodes.b72_6.position),{x:4170,y:4840});
assert.equal(map.bridgeStyles['b72_5>b72_6'],'ice');
assert.ok(map.bridges.some(([a,b])=>a==='b72_5'&&b==='b72_6'));
assert.deepEqual(plain(map.bridgeRoutes.find(r=>r.id==='star-spur')?.nodeIds),
 ['b72_4','b72_5','b72_6']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
assert.ok(distance(map.nodes.b72_6.position,map.nodes.b72_5.position)>90);
assert.ok(distance(map.nodes.b72_6.position,map.nodes.c76_2.position)>90);
assert.equal(M.choose(map,'b72_5',260,-270),'b72_6',
 'diagonal joystick on the ice bridge selects the new route');
assert.equal(M.choose(map,'b72_5',0,-270),'n74',
 'upward joystick still selects the original route');
// Mutations must be diagnosed rather than silently accepted as old IDs on new geography.
function invalid(edit,re){const bad=plain(map);edit(bad);assert.throws(()=>M.validate(bad),re);}
invalid(m=>m.version='winter-fixed-120-v2',/Incompatible/);
invalid(m=>m.version='winter-expedition-152-v3',/Incompatible/);
invalid(m=>m.version='winter-expedition-152-v4',/Incompatible/);
invalid(m=>delete m.version,/Incompatible/);
invalid(m=>m.nodes.n1.id='n0',/ID/);
invalid(m=>m.nodes.n1.position.x=NaN,/position/);
invalid(m=>m.nodes.n1.nextNodes=[],/Dead end/);
invalid(m=>m.nodes.n152.nextNodes=['n0'],/endpoints/);
invalid(m=>m.nodes.n1.nextNodes=['n0'],/forward edge|cycle/);
invalid(m=>m.nodes.n1.previousNodes.push('n10'),/previous edge/);
invalid(m=>m.nodes.n1.remainingSteps=0,/graph distance/);
invalid(m=>m.nodes.ghost={...m.nodes.n1,id:'ghost'},/Unreachable/);
invalid(m=>m.bridges.push(['n1','n9']),/Orphan/);
invalid(m=>m.bridgeRoutes[0].nodeIds[1]='n100',/bridge edge/);
invalid(m=>m.nodes.n26.bridgeId='missing',/bridge checkpoint/);
invalid(m=>m.nodes.b72_6.nextNodes=[],/Dead end|graph distance/);
invalid(m=>m.nodes.b72_5.nextNodes=['n74'],/previous edge|bridge edge|Orphan/);
invalid(m=>m.islands[0].nodeIds.push('n1'),/membership/);
invalid(m=>m.nodes.n14.ownerId='p1',/sword ownership/);
invalid(m=>m.nodes.n20.territoryId=M.TERRITORY_ID,/Stale sword metadata/);
invalid(m=>m.nodes.c76_11.type='movement',/Sword territory set/);
// Session ownership cannot contaminate the literal or another game.
map.nodes.n14.ownerId='p1';map.nodes.n15.ownerId='p1';map.territories[M.TERRITORY_ID].ownerId='p1';
map.islands[0].decorations[0].x=-10;
assert.equal(normalize(M.create(0)),expected);
console.log('FIXED MAP PASS: 1,000 full-data seed comparisons, fresh reload, 152 main edges / 213 nodes / 9 islands, 140–174 route steps, two main-route island returns, validator mutation checks');
