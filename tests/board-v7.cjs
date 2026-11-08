'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({window:{},console,Math,Date});
for(const file of ['board-map.js','board-v7-design.js','board-v7-art.js','board-v7-adapter.js']){
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
}
const {BoardMap:M,BOARD_PARTY_V7_DESIGN:D,BOARD_PARTY_V7_ART:A}=ctx.window;
assert.equal(M.MAP_VERSION,'winter-expedition-152-v8');
assert.equal(D.islands.length,17);
assert.equal(D.newNodes.length,146);
assert.equal(D.bridges.length,20);
assert.equal(Object.keys(D.allNodePositions).length,359);
const expected=JSON.stringify(Object.entries(M.create(0).nodes).map(([id,n])=>[id,n.type]).sort());
for(const seed of [0,1,25,9987]){
 const map=M.create(seed),ids=Object.keys(map.nodes);
 assert.equal(map.version,M.MAP_VERSION);
 assert.equal(ids.length,359);
 assert.equal(map.islands.length,17);
 assert.equal(map.bridgeRoutes.length,35);
 assert.equal(M.validate(map),true);
 assert.equal(new Set(ids).size,359);
 assert.equal(JSON.stringify(Object.entries(map.nodes).map(([id,n])=>[id,n.type]).sort()),expected,
  'tile-type assignment must not change between runs');
 for(const n of Object.values(map.nodes)){
  assert.ok(Number.isFinite(n.remainingSteps)&&n.remainingSteps>=0,'distance to finish exists');
  assert.ok(map.nodes[n.id],'real node');
  if(n.type==='sword')assert.ok(map.territories[n.territoryId]?.nodeIds.includes(n.id),
   'every sword tile resolves to a territory');
 }
 for(let i=0;i<152;i++)assert.ok(map.nodes['n'+i].nextNodes.includes('n'+(i+1)),
   'the authored main route is preserved');
 assert.equal(map.nodes.n152.type,'finish');
}
const map=M.create(0),seen=new Set(),todo=['n152'];
while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);todo.push(...map.nodes[id].previousNodes);}
assert.equal(seen.size,359,'all nodes lead to the existing finish');
for(const route of D.bridges)for(let i=1;i<route.nodeIds.length;i++){
 const from=route.nodeIds[i-1],to=route.nodeIds[i],key=from+'>'+to;
 assert.ok(map.nodes[from].nextNodes.includes(to),'v7 bridge is traversable');
 assert.ok(map.bridges.some(([a,b])=>a===from&&b===to),'bridge surface exists');
 assert.equal(map.bridgeStyles[key],route.style);
}
const allNodeTypes=new Map(Object.entries(map.nodes).map(([id,n])=>[id,n.type]));
assert.equal(allNodeTypes.get('n42'),'lucky');
assert.equal(allNodeTypes.get('n43'),'sword');
assert.equal(allNodeTypes.get('n44'),'sword');
// Verify the actual v7 scene renderer can draw its 17 island layers on a
// canvas-like host without affecting the map graph or the game simulation.
let saves=0,restores=0;
const gradient={addColorStop(){}},g=new Proxy({},{
 get(_,name){
  if(name==='save')return()=>{saves++};
  if(name==='restore')return()=>{restores++};
  if(name==='createLinearGradient'||name==='createRadialGradient')return()=>gradient;
  if(name==='measureText')return text=>({width:String(text).length*11});
  return()=>{};
 },set(){return true;}
});
assert.equal(typeof A.render,'function');
const originalGraph=JSON.stringify(map);
const painted=A.render(g,D,{layers:{nodes:0,labels:0}});
assert.equal(saves,restores,'board art must restore Canvas state');
assert.ok(painted.islands>=17,'all authored islands rendered');
assert.ok(painted.bridges>=20,'v7 bridges have visual representation');
assert.equal(JSON.stringify(map),originalGraph,'art must not mutate gameplay world');
assert.equal(typeof A.createEffects,'function');
const effects=A.createEffects(D,1);
assert.equal(typeof effects.draw,'function');
effects.draw(g,{x:0,y:0,w:7350,h:5800,zoom:.2},10);
assert.equal(saves,restores,'FX layer must restore Canvas state');
assert.equal(M.validate(map),true);
console.log('BOARD v7 PASS: 359 nodes, 17 islands, 20 new bridges, v6 main and tile types preserved, loops and Phase 5 renderer');
