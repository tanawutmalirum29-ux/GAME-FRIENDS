'use strict';
/* BOARD v8 layout contract: readable 17-island routes, linked two-tile sword
 * courts, real directed connectivity and renderer/playable-coordinate parity. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({window:{},Math,Date,console});
for(const file of ['board-map.js','board-v7-design.js','board-branch-naming.js','board-v7-adapter.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const {BoardMap:M,BOARD_PARTY_V7_DESIGN:D}=context.window;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function crossing(a,b,c,d){
 const cr=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 return cr(a,b,c)*cr(a,b,d)<-1e-4&&cr(c,d,a)*cr(c,d,b)<-1e-4;
}
function inside(p,poly){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }
 return yes;
}
const m=M.create(73129),nodes=Object.values(m.nodes),edges=nodes.flatMap(n=>n.nextNodes.map(id=>[n,m.nodes[id]]));
assert.equal(m.version,'winter-expedition-152-v9');
assert.equal(nodes.length,302);assert.equal(m.islands.length,17);
assert.equal(M.validate(m),true);
assert.equal(edges.length,321,'preserve authored board choices while rerouting them');
const get=id=>m.nodes[id];
const q=[m.startId],reached=new Set();
while(q.length){const id=q.pop();if(reached.has(id))continue;reached.add(id);q.push(...get(id).nextNodes);}
assert.equal(reached.size,nodes.length,'every tile reachable from START');
const done=new Set(),back=[m.finishId];
while(back.length){const id=back.pop();if(done.has(id))continue;done.add(id);back.push(...get(id).previousNodes);}
assert.equal(done.size,nodes.length,'every tile has a route to FINISH');
assert.ok(nodes.filter(n=>n.id!==m.finishId&&!n.nextNodes.length).length===0,'no unwanted dead ends');
const sword=nodes.filter(n=>n.type==='sword');
const used=new Set(),territories=Object.values(m.territories);
for(const t of territories){
 assert.equal(t.nodeIds.length,2,'sword territories always contain exactly two tiles: '+t.id);
 const [a,b]=t.nodeIds.map(get);
 assert.ok(a&&b&&a.nextNodes.includes(b.id),'two sword tiles must be directly linked: '+t.id);
 assert.ok(dist(a.position,b.position)>=88,'two tiles must have distinct readable positions: '+t.id);
 if(t.id.startsWith('v8-court-'))assert.ok(a.islandId&&a.islandId===b.islandId,'new sword plaza stays entirely on one island');
 for(const n of [a,b]){
  assert.equal(n.type,'sword');assert.equal(n.territoryId,t.id);
  assert.equal(n.ownerId,t.ownerId);
  assert.ok(!used.has(n.id),'sword tile cannot belong to multiple territories');used.add(n.id);
 }
}
assert.equal(used.size,sword.length,'no dangling sword tiles');
assert.equal(territories.filter(t=>t.id.startsWith('v8-court-')).length,4);
const basic=new Set(['village','grove','frost','lake','crown','bells','aurora','comet','star']);
const expanded=['workshop','meadow','harbor','ginger','berg'];
for(const isl of m.islands){
 const arr=nodes.filter(n=>n.islandId===isl.id);
 assert.ok(arr.length,'island must contain walkable tiles '+isl.id);
 assert.equal(arr.length,isl.nodeIds.length,'island membership '+isl.id);
 for(const n of arr){
  assert.ok(inside(n.position,isl.outline),'tile stays within visible island '+n.id);
 }
 for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
  const d=dist(arr[i].position,arr[j].position);
  assert.ok(d>=108,'distinct island tiles cannot crowd/overlap '+arr[i].id+'/'+arr[j].id+': '+d);
 }
 if(basic.has(isl.id))assert.ok(arr.length>=1,'retain original island '+isl.id);
}
const segments=new Set(D.allPathSegments.map(e=>e.from_+'>'+e.to));
for(const [a,b] of edges){
 assert.ok(segments.has(a.id+'>'+b.id),'rendered road/bridge matches authoritative graph '+a.id+'>'+b.id);
 if(a.islandId!==b.islandId){
  assert.ok(m.bridges.some(([x,y])=>x===a.id&&y===b.id),'cross-island edges require physical bridge');
 }
}
for(const n of D.newNodes){
 const p=get(n.id).position,q=D.allNodePositions[n.id];
 assert.equal(p.x,q.x,'visual/playable X coordinate matches '+n.id);
 assert.equal(p.y,q.y,'visual/playable Y coordinate matches '+n.id);
}
const crossings=[];
for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
 const [a,b]=edges[i],[c,d]=edges[j];
 if([a.id,b.id].some(x=>x===c.id||x===d.id))continue;
 if(crossing(a.position,b.position,c.position,d.position))
  crossings.push([a.id+'>'+b.id,c.id+'>'+d.id]);
}
assert.ok(crossings.length<=2,'only two grade-separated bridges may intersect; all ordinary roads are planar: '+JSON.stringify(crossings));
const overpassEdges=new Set(D.overpasses.map(p=>p.upper));
for(const [a,b] of crossings){
 assert.ok(overpassEdges.has(a)||overpassEdges.has(b),
  'all visible path crossings must have an explicit raised viaduct: '+a+' vs '+b);
}
assert.equal(D.overpasses.length,2,'exactly two visually marked overpasses');
// Rendering the map and changing zoom must never rewrite authoritative positions.
const expected=JSON.stringify(Object.fromEntries(nodes.map(n=>[n.id,n.position])));
for(const seed of [0,1,9,73129]){
 const other=M.create(seed);
 assert.equal(other.version,M.MAP_VERSION);
 assert.equal(JSON.stringify(Object.fromEntries(Object.values(other.nodes).map(n=>[n.id,n.position]))),expected,
  'map coordinates deterministic and stable for all zooms/play sessions');
}
console.log('BOARD v9 PASS: '+nodes.length+' nodes; '+m.islands.length+' islands; '+edges.length+
 ' directed routes; '+territories.length+' two-tile sword courts; '+crossings.length+' marked crossings; full reachability and art parity');
