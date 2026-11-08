/* BOARD PARTY v7: graph-only adapter. Original dice, items, camera and
 * v6 authored tile types stay unchanged. New tiles retain their v7 draft
 * types until the owner reviews them. Do not import offline art into logic. */
(()=>{
'use strict';
const Base=window.BoardMap,D=window.BOARD_PARTY_V7_DESIGN;
if(!Base||!D)throw Error('BOARD v7: load board-map and design before adapter');
const VERSION='winter-expedition-152-v8',copy=x=>JSON.parse(JSON.stringify(x));
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
/* BOARD v8 — deterministic art/graph renovation.
 * v7's ten isolated sword zones and crowded short routes are not gameplay
 * compatible with two-cell territory rules. No seeded placement is used. */
const SWORD_COURTS=Object.freeze([
 ['workshop-watch','w6','w7'],
 ['harbor-watch','h0','hs30_0'],
 ['ginger-watch','g0','g1'],
 ['berg-watch','s3','s4']
]);
function remodelDesign(){
 const settings={
  workshop:{cx:3300,cy:2680,nx:1.10,ny:1.45,ox:1.11,oy:1.45,dx:0,dy:0},
  meadow:{cx:2750,cy:1000,nx:1.18,ny:1.31,ox:1.20,oy:1.34,dx:0,dy:0},
  harbor:{cx:2650,cy:5330,nx:1.28,ny:1.25,ox:1.32,oy:1.32,dx:130,dy:-15},
  ginger:{cx:6480,cy:5430,nx:1.10,ny:1.27,ox:1.13,oy:1.30,dx:0,dy:0},
  berg:{cx:6600,cy:2700,nx:1.17,ny:1.18,ox:1.21,oy:1.24,dx:0,dy:0}
 };
 const find=n=>D.newNodes.find(x=>x.id===n);
 for(const isl of D.islands){
  const k=settings[isl.id];if(!k)continue;
  isl.outline=isl.outline.map(p=>({x:Math.round(k.cx+(p.x-k.cx)*k.ox+k.dx),
                                   y:Math.round(k.cy+(p.y-k.cy)*k.oy+k.dy)}));
  isl.center={x:k.cx+k.dx,y:k.cy+k.dy};
 }
 const old=new Map();
 for(const node of D.newNodes){
  const k=settings[node.islandId];if(!k)continue;
  const p=node.position;
  node.position={x:k.cx+(p.x-k.cx)*k.nx+k.dx,y:k.cy+(p.y-k.cy)*k.ny+k.dy};
  old.set(node.id,{...node.position});
 }
 // Spatially separate dense tiles, retaining the original clockwise loop
 // and distinct branch entrances. These positions are deterministic.
 const inside=(pt,poly)=>{
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a.y>pt.y)!==(b.y>pt.y)&&pt.x<(b.x-a.x)*(pt.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
 };
 function fits(p,poly){
  if(!inside(p,poly))return false;
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   if(!inside({x:p.x+46*Math.cos(a),y:p.y+46*Math.sin(a)},poly))return false;
  }
  return true;
 }
 const grouped=new Map(Object.keys(settings).map(k=>[k,D.newNodes.filter(n=>n.islandId===k)]));
 for(const isl of D.islands){
  const nodes=grouped.get(isl.id);if(!nodes?.length)continue;
  const center=isl.center;
  for(let pass=0;pass<90;pass++){
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],dx=b.position.x-a.position.x,dy=b.position.y-a.position.y;
    let d=Math.hypot(dx,dy);
    if(d>=138)continue;
    const vx=d<1?((i+j)%2?1:-1):dx/Math.max(d,.001);
    const vy=d<1?0:dy/Math.max(d,.001);
    const force=(138-d)*.28;
    a.position.x-=force*vx;a.position.y-=force*vy;
    b.position.x+=force*vx;b.position.y+=force*vy;
   }
   for(const n of nodes){
    // Preserve identifiable graph flow: a soft spring retains its authored
    // region while the stronger separation force opens compact branches.
    const home=old.get(n.id);
    n.position.x+=(home.x-n.position.x)*.012;
    n.position.y+=(home.y-n.position.y)*.012;
    if(!fits(n.position,isl.outline)){
     for(let i=0;i<30&&!fits(n.position,isl.outline);i++){
      n.position.x+=(center.x-n.position.x)*.055;
      n.position.y+=(center.y-n.position.y)*.055;
     }
    }
   }
  }
 }

 // Renovate confusing crossing shortcuts as small, legible optional detours.
 // Main island loops remain intact; every alternate still rejoins downstream.
 const byId=new Map(D.newNodes.map(n=>[n.id,n]));
 const setNext=(id,to)=>{const n=byId.get(id);if(!n)throw Error('Missing v8 fork '+id);n.nextNodes=[...to];};
 const addNext=(id,to)=>{const n=byId.get(id);if(!n)throw Error('Missing v8 fork '+id);if(!n.nextNodes.includes(to))n.nextNodes.push(to);};
 const removeNext=(id,to)=>{const n=byId.get(id);if(!n)throw Error('Missing v8 fork '+id);n.nextNodes=n.nextNodes.filter(x=>x!==to);};
 // Workshop: the long upper detour now rejoins at w5, instead of slicing
 // through the distinct centre-court route.
 setNext('ws9_2',['w5']);setNext('ws8_0',['ws9_1']);
 // Meadow: separate the scenic m2->m3 branch from the m0 fork.
 removeNext('m0','ms20_0');addNext('m2','ms20_0');
 removeNext('m7','ms19_0');addNext('m4','ms19_0');
 // Harbor: replace its long counter-flow chord with a short roofside bypass.
 removeNext('h6','hs29_0');addNext('h2','hs29_0');setNext('hs29_0',['h4']);setNext('hs30_0',['h5']);
 // Gingerbread: an upper reward diversion instead of a diagonal through town.
 removeNext('g1','gs39_0');addNext('g4','gs39_0');
 // Glacier: dangerous direct shortcut vs a longer outer scenic route.
 removeNext('s0','ss51_0');addNext('s1','ss51_0');
 setNext('ss51_0',['s2']);
 setNext('ss49_0',['s4']);
 removeNext('s7','ss50_0');removeNext('s4','ss50_0');addNext('s5','ss50_0');
 setNext('ss50_1',['s7']);
 const routes={
  ws9_2:['w7','ws9_0','ws9_1','ws9_2','w5'],
  ws8_0:['w1','ws8_0','ws9_1'],
  ms20_0:['m2','ms20_0','m3'],
  ms19_0:['m4','ms19_0','m3'],
  hs29_0:['h2','hs29_0','h4'],
  hs30_0:['h0','hs30_0','h5'],
  gs39_0:['g4','gs39_0','g5'],
  ss51_0:['s1','ss51_0','s2'],
  ss49_0:['s1','ss49_0','s4'],
  ss50_0:['s5','ss50_0','ss50_1','s7']
 };
 for(const road of D.roads||[]){
  for(const [key,nodes] of Object.entries(routes))if(road.nodeIds.includes(key)){
   // Only replace the full authored variant path, never an unrelated route.
   road.nodeIds=[...nodes];break;
  }
 }
 // Curated clearance near the two sword courts and side trails.
 const lanePositions={
  ws9_0:[3550,2620],ws9_1:[3340,2425],ws9_2:[3080,2445],
  ms19_0:[2610,1000],ms20_0:[2490,1280],
  hs29_0:[2940,4955],hs30_0:[2610,5300],
  gs39_0:[6240,5180],
  ss51_0:[6610,3015],ss49_0:[6450,2700],
  ss50_0:[6580,2680],ss50_1:[6700,2690],
  xmw_8:[3185,2450],xgb_2:[6100,5160],xgb_3:[6000,4990],xgb_4:[5800,4970],
  ws9_1:[3410,2675],ws9_2:[3030,2660],
  xhl_1:[3210,5050],xhl_2:[3300,4920],
  xhb_1:[3210,5335],xhb_2:[3350,5340]
 };
 for(const [id,xy] of Object.entries(lanePositions)){
  const n=byId.get(id);if(n)n.position={x:xy[0],y:xy[1]};
 }
 // Route the Gingerbread->Lake return bridge as a separate lower lane from
 // the inbound lake->Gingerbread road and the original n134->n135 crossing.
 const lowerY={xgb_1:5518,
  xgb_5:5030,xgb_6:4930,xgb_7:4890,xgb_8:4740};
 for(const [id,y] of Object.entries(lowerY)){
  const n=find(id);if(n)n.position.y=y;
 }
 // After explicit detour/bridge clearance edits, bring any island point back
 // inside its silhouette with 46px of icon margin; never clip a tile at coast.
 const regionsById=new Map(D.islands.map(x=>[x.id,x]));
 for(const node of D.newNodes){
  if(!node.islandId)continue;
  const isl=regionsById.get(node.islandId);
  if(!isl)throw Error('Unknown v8 region '+node.islandId);
  for(let i=0;i<110&&!fits(node.position,isl.outline);i++){
   node.position.x+=(isl.center.x-node.position.x)*.045;
   node.position.y+=(isl.center.y-node.position.y)*.045;
  }
  if(!fits(node.position,isl.outline))throw Error('v8 node cannot fit on island '+node.id);
 }

 // All v7 bridge swords were single tiles, often in narrow water sections.
 // Replace them with four readable two-tile courts on distinct islands.
 const oldSingles=new Set(D.newNodes.filter(n=>n.type==='sword').map(n=>n.id));
 for(const n of D.newNodes)if(oldSingles.has(n.id))n.type='movement';
 for(const [,a,b] of SWORD_COURTS){
  for(const id of [a,b]){const n=find(id);if(!n||n.islandId===null)throw Error('Bad sword court '+id);n.type='sword';}
 }
 // Avoid an uninterrupted run of Lucky Stars on the same short side branch.
 const normals=['ws1_0','ws2_0','gs40_2'];
 for(const id of normals){const n=find(id);if(n)n.type='movement';}
 for(const id of ['g2']){const n=find(id);if(n)n.type='lucky';}
 const risky=find('ws9_1');if(risky)risky.type='danger';
 // Keep the precompiled v7 art segments faithful to the new route graph.
 const existingPaths=new Set([
  ...D.oldNodes.flatMap(n=>n.nextNodes.map(to=>n.id+'>'+to)),
  ...D.newNodes.flatMap(n=>n.nextNodes.map(to=>n.id+'>'+to)),
  ...Object.entries(D.patchOldNextNodes).flatMap(([id,arr])=>arr.map(to=>id+'>'+to))
 ]);
 const previousPaths=new Set(D.allPathSegments.map(e=>e.from_+'>'+e.to));
 D.allPathSegments=D.allPathSegments.filter(e=>existingPaths.has(e.from_+'>'+e.to));
 for(const key of existingPaths)if(!previousPaths.has(key)){
  const [from_,to]=key.split('>');
  D.allPathSegments.push({from_,to,kind:'road',style:null,source:'v8'});
 }
 for(const n of D.newNodes){
  n.position={x:Math.round(n.position.x),y:Math.round(n.position.y)};
  D.allNodePositions[n.id]={...n.position};
 }
 // Both the playable nodes AND the precompiled v7 vector path coordinates
 // must move together, or the visible roads disagree with collision/movement.
 for(const kind of ['allPathSegments','existingRoadSegments','existingBridgeSegments']){
  for(const e of D[kind]||[]){
   const a=D.allNodePositions[e.from_],b=D.allNodePositions[e.to];
   if(a&&b){e.x1=a.x;e.y1=a.y;e.x2=b.x;e.y2=b.y;}
  }
 }
 // Former crossover decks cannot be kept at stale world coordinates.
 if(Array.isArray(D.overpasses)){
  D.overpasses.length=0;
  // The original village->castle main road and the elevated Gingerbread
  // bridge have one deliberate grade-separated crossing. Mark the upper
  // viaduct visually so players cannot mistake it for a walking junction.
  D.overpasses.push({x:5270,y:4821,upper:'n134>n135',crossesOld:true});
  D.overpasses.push({x:6066,y:5341,upper:'xgl_6>g4',crossesOld:false});
 }
}
remodelDesign();
function applySwordCourts(m){
 for(const [name,a,b] of SWORD_COURTS){
  if(!m.nodes[a]?.nextNodes.includes(b))
   throw Error('Sword pair must be directly connected '+a+'>'+b);
  const territoryId='v8-court-'+name;
  for(const id of [a,b]){
   const n=m.nodes[id];
   if(n.type!=='sword'||n.islandId!==m.nodes[a].islandId)
    throw Error('Sword pair must share one island '+id);
   delete m.territories['v7-sword-'+id];
   n.territoryId=territoryId;n.ownerId=null;
  }
  m.territories[territoryId]={id:territoryId,nodeIds:[a,b],ownerId:null};
 }
 // No lonely v7 sword territories are permitted in a playable map.
 for(const [id,t] of Object.entries(m.territories))
  if(t.nodeIds.length!==2||!m.nodes[t.nodeIds[0]]?.nextNodes.includes(t.nodeIds[1]))
   throw Error('Orphan or nonadjacent sword court '+id);
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
 // Base v6 nodes remain fixed; every remodeled v7 tile uses the same
 // coordinates in the canvas design and in the authoritative graph.
 applySwordCourts(m);
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
  if(n.type==='sword'){
   const territory=m.territories[n.territoryId];
   if(!territory||territory.nodeIds.length!==2||!territory.nodeIds.includes(id))
    throw Error('Unpaired sword tile '+id);
   const [a,b]=territory.nodeIds;
   if(!m.nodes[a]?.nextNodes.includes(b))
    throw Error('Swords must form an adjacent pair '+id);
   if(n.territoryId.startsWith('v8-court-')&&
      (m.nodes[a].islandId!==m.nodes[b].islandId||!m.nodes[a].islandId))
    throw Error('v8 sword court must be placed fully on one island '+id);
  }
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
