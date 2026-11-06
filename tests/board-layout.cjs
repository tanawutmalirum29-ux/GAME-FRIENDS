/* Physical multi-island layout checks, independent of renderer implementation. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
for(const file of ['board-map','board-dice','board-items','board-minigame','board-party'])vm.runInContext(fs.readFileSync(file+'.js','utf8'),ctx,{filename:file+'.js'});
const {BoardMap:M,BoardItems:I,BoardParty:P}=ctx.window;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pointInside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
}return yes;};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-1e-6&&cross(c,d,a)*cross(c,d,b)<-1e-6;
let coveredEdges=0;
for(let seed=0;seed<100;seed++){
 const map=M.create(seed),nodes=Object.values(map.nodes),islands=map.islands;
 assert.ok(islands.length>=6,'adventure has at least six distinct islands');
 assert.equal(new Set(islands.map(i=>i.theme)).size,islands.length,'island themes are distinct');
 const edges=nodes.flatMap(n=>n.nextNodes.map(id=>[n,map.nodes[id]]));
 let up=0,down=0,left=0,right=0,islandChanges=0;
 const bridges=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 for(const n of nodes){
  if(n.bridgeId){
   assert.equal(n.islandId,null);
   const bridge=map.bridgeRoutes.find(b=>b.id===n.bridgeId);
   assert.ok(bridge&&bridge.nodeIds.includes(n.id),'water checkpoints belong to an authored bridge');
   continue;
  }
  const island=islands.find(i=>i.id===n.islandId);
  assert.ok(island&&island.nodeIds.includes(n.id),'every node belongs to one island: '+n.id);
  assert.ok(pointInside(n.position,island.outline),'node sits on actual snow: '+n.id);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   assert.ok(pointInside({x:n.position.x+Math.cos(angle)*48,y:n.position.y+Math.sin(angle)*48},island.outline),'full tile remains on land: '+n.id);
  }
 }
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert.ok(distance(nodes[i].position,nodes[j].position)>=90,'tiles do not overlap: '+nodes[i].id+'/'+nodes[j].id);
 for(const [a,b] of edges){
  const dx=b.position.x-a.position.x,dy=b.position.y-a.position.y;
  if(dx>45)right++;if(dx< -45)left++;if(dy>45)down++;if(dy< -45)up++;
  if(!a.islandId||!b.islandId||a.islandId!==b.islandId){islandChanges++;assert.ok(bridges.has(a.id+'>'+b.id),'ocean crossings have actual bridges');}
  else{
   const island=islands.find(i=>i.id===a.islandId);
   for(let j=1;j<10;j++){const t=j/10,p={x:a.position.x+dx*t,y:a.position.y+dy*t};assert.ok(pointInside(p,island.outline),'on-island path remains on land: '+a.id+'>'+b.id);}
  }
 }
 assert.ok(up>=12&&down>=12&&left>=12&&right>=12,'route has substantial travel in all directions');
 assert.ok(islandChanges>=islands.length-1,'route truly travels between islands');
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  const [a,b]=edges[i],[c,d]=edges[j];if([a.id,b.id].some(id=>id===c.id||id===d.id))continue;
  assert.ok(!intersects(a.position,b.position,c.position,d.position),'unrelated paths never cross: '+a.id+'>'+b.id+' / '+c.id+'>'+d.id);
 }
 assert.equal(M.validate(map),true);
}
// Actually steer every edge through the same host input handler used by phones.
// Repeat with 1–12 players so shared-node offsets cannot strand a walker.
for(let count=1;count<=12;count++){
 const roster=Array.from({length:count},(_,i)=>({id:'p'+i,name:'Explorer '+i,color:'#72bfd8',isBot:false}));
 const template=M.create(count),edges=Object.values(template.nodes).flatMap(n=>n.nextNodes.map(id=>[n.id,id]));
 for(const [from,to] of edges){
  const s=P.create(roster,{seed:count,rng:M.random(count)});s.order=s.players.map(p=>p.id);
  const p=s.players[0];s.players.forEach(q=>q.currentNodeId=from);P.startTurn(s);P.beginMove(s,p,1);
  const a=s.map.nodes[from].position,b=s.map.nodes[to].position,d=distance(a,b);
  let iterations=0;
  while(p.currentNodeId!==to&&iterations++<600){
   P.input(s,p.id,{turnId:s.turnId,actionId:iterations,keys:{axisX:(b.x-a.x)/d,axisY:(b.y-a.y)/d}});
   P.update(s,.05);
   if(s.move?.to){
    assert.equal(s.move.to,to,'stick selects the intended outgoing edge');
    assert.ok(I.segmentDistance(I.position(s,p),a,b)<=19,'physical walker stays within selected lane');
   }
  }
  assert.equal(p.currentNodeId,to,'real controller can traverse '+from+'>'+to+' with '+count+' players');
  assert.ok(!s.move||s.move.remaining===0,'one edge consumes precisely one step');
  coveredEdges++;
 }
}
console.log('LAYOUT PASS: 100 seeds, island and tile containment, distinct zones, four-way route flow, no unrelated crossings; '+coveredEdges+' actual edge traversals across 1–12 players');
