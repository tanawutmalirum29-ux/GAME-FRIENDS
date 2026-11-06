'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
vm.runInContext(fs.readFileSync('board-map.js','utf8'),ctx,{filename:'board-map.js'});
const M=ctx.window.BoardMap;
const normalize=map=>{const copy=JSON.parse(JSON.stringify(map));delete copy.seed;return JSON.stringify(copy);};
const expected=normalize(M.create(0));
assert.equal(M.MAIN_LENGTH,120);assert.equal(M.MAP_VERSION,'winter-fixed-120-v2');
for(let seed=1;seed<=1000;seed++){const map=M.create(seed);assert.equal(normalize(map),expected,'Fixed geometry and tile types must ignore seed '+seed);}
const map=M.create(1001),nodes=Object.values(map.nodes);
assert.ok(nodes.length>=150,'At least 150 uniquely authored nodes');
assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
assert.ok(map.islands.filter(i=>i.nodeIds.length>=20).length>=3,'At least three large multi-turn islands');
assert.ok(map.bridges.length>=8,'Bridge routes include the Crown Island return detour');
assert.equal(map.nodes.b38_3.islandId,'sword');
assert.equal(map.nodes.b38_4.islandId,'crown');
assert.equal(map.nodes.b38_6.islandId,'crown');
assert.equal(map.nodes.b38_7.islandId,'sword');
assert.ok(map.bridges.some(([a,b])=>a==='b38_3'&&b==='b38_4'));
assert.ok(map.bridges.some(([a,b])=>a==='b38_6'&&b==='b38_7'));
for(let i=0;i<120;i++)assert.ok(map.nodes['n'+i].nextNodes.includes('n'+(i+1)),'Main route '+i+' must remain directed');
for(const n of nodes){assert.ok(n.position&&Number.isFinite(n.position.x)&&Number.isFinite(n.position.y));for(const to of n.nextNodes)assert.ok(map.nodes[to].previousNodes.includes(n.id));}
assert.equal(M.validate(map),true);
console.log('FIXED MAP PASS: 1,000 seeds identical, 120 main edges, '+nodes.length+' fixed nodes, '+map.bridges.length+' bridges and '+map.islands.length+' islands');
