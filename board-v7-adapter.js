/* BOARD PARTY v7: graph-only adapter. Original dice, items, camera and
 * v6 authored tile types stay unchanged. New tiles retain their v7 draft
 * types until the owner reviews them. Do not import offline art into logic. */
(()=>{
'use strict';
const Base=window.BoardMap,D=window.BOARD_PARTY_V7_DESIGN;
if(!Base||!D)throw Error('BOARD v7: load board-map and design before adapter');
const VERSION='winter-expedition-152-v10',copy=x=>JSON.parse(JSON.stringify(x));
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
 ['harbor-watch','h2','h3'],
 ['ginger-watch','g4','g5'],
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
/* BOARD PARTY WS retirement: remove the eight ws* checkpoints while
 * preserving the four already-authored through-roads on Workshop Island.
 * Each new graph edge is a contraction of the exact two-edge original
 * (source -> ws -> destination), not a new playable shortcut.
 * The ws8/ws9 *optional detour* is removed rather than replaced by a
 * huge diagonal across the island. All four W sword-court nodes survive. */
function contractWorkshopWaypoints(){
 const required=[
  ['w0','ws0_0','w1'],['w1','ws1_0','w2'],
  ['w2','ws2_0','w3'],['w5','ws5_0','w6']
 ];
 const nodes=new Map(D.newNodes.map(n=>[n.id,n]));
 for(const [from,mid,to] of required){
  const a=nodes.get(from),m=nodes.get(mid),b=nodes.get(to);
  if(!a||!m||!b||!a.nextNodes.includes(mid)||!m.nextNodes.includes(to)||
     a.islandId!=='workshop'||m.islandId!=='workshop'||b.islandId!=='workshop')
   throw Error('Cannot safely contract existing Workshop edge '+from+'>'+mid+'>'+to);
  if(a.nextNodes.includes(to))throw Error('Duplicate Workshop contraction '+from+'>'+to);
  a.nextNodes=a.nextNodes.map(id=>id===mid?to:id);
  const p=D.allNodePositions[from],q=D.allNodePositions[to];
  if(!p||!q)throw Error('Missing Workshop coordinates for '+from+'>'+to);
  const line={from_:from,to,kind:'road',style:null,source:'ws-retirement',
   x1:p.x,y1:p.y,x2:q.x,y2:q.y};
  for(const collection of ['allPathSegments','existingRoadSegments']){
   if(!D[collection].some(e=>e.from_===from&&e.to===to))D[collection].push({...line});
  }
  D.roads.push({id:'ws-retirement-'+from+'-'+to,nodeIds:[from,to],kind:'road'});
 }
}
contractWorkshopWaypoints();
/* BOARD v9 graph reduction. The requested removals sever the v8 harbor
 * and ginger loops; deleting their orphaned tails is required to preserve
 * start-to-finish reachability WITHOUT inventing replacement connections.
 * All IDs are inspected against the real authored graph before mutation. */
function reduceGraphDesign(){
 const explicitIds=new Set(['ms19_0','ms18_0','ms18_1']);
 const removedPrefixes=['xbc','ss','hs','xhb','xgb','gs','wsxmout','xab','ws'];
 const source=Base.create(0);
 const all=new Map(Object.entries(source.nodes).map(([id,n])=>[id,[...n.nextNodes]]));
 for(const n of D.newNodes){
  if(all.has(n.id))throw Error('Duplicate initial V9 node '+n.id);
  all.set(n.id,[...n.nextNodes]);
 }
 for(const [id,extra] of Object.entries(D.patchOldNextNodes)){
  const options=all.get(id);
  if(!options)throw Error('Unknown v9 connector '+id);
  for(const dest of extra)if(!options.includes(dest))options.push(dest);
 }
 const explicit=[...all.keys()].filter(id=>explicitIds.has(id)||
   removedPrefixes.some(prefix=>id.startsWith(prefix)));
 if(explicit.length!==44)throw Error('V9 requested-removal set changed: '+explicit.length);
 if([...explicitIds].some(id=>!explicit.includes(id)))
  throw Error('Missing explicitly requested MS checkpoint');
 const deleteSet=new Set(explicit);
 const adjacency=new Map();
 for(const [id,targets] of all){
  if(deleteSet.has(id))continue;
  adjacency.set(id,targets.filter(to=>!deleteSet.has(to)&&
   !(id==='m2'&&to==='m3')));
 }
 const previous=new Map([...adjacency.keys()].map(id=>[id,[]]));
 for(const [id,targets] of adjacency)for(const to of targets){
  if(!previous.has(to))throw Error('Dangling V9 edge '+id+' -> '+to);
  previous.get(to).push(id);
 }
 const reach=(root,reverse=false)=>{
  const reached=new Set(),pending=[root];
  for(let i=0;i<pending.length;i++){
   const id=pending[i];if(reached.has(id))continue;
   if(!adjacency.has(id))throw Error('Missing reachability root '+id);
   reached.add(id);pending.push(...(reverse?previous.get(id):adjacency.get(id)));
  }
  return reached;
 };
 const forward=reach('n0'),backward=reach('n152',true);
 const keep=new Set([...adjacency.keys()].filter(id=>forward.has(id)&&backward.has(id)));
 const orphaned=[...adjacency.keys()].filter(id=>!keep.has(id));
 if(orphaned.length!==13)throw Error('V9 unexpected stranded nodes: '+orphaned.join(','));
 for(let i=0;i<=Base.MAIN_LENGTH;i++)
  if(!keep.has('n'+i))throw Error('V9 lost canonical main node n'+i);
 const edgeKeys=new Set();
 for(const [id,to] of adjacency)if(keep.has(id))for(const target of to)
  if(keep.has(target))edgeKeys.add(id+'>'+target);
 if(!edgeKeys.has('m2>ms20_0')||!edgeKeys.has('ms20_0>m3')||
    edgeKeys.has('m2>m3'))throw Error('V9 m2 detour graph violation');
 const allowedPath=(a,b)=>keep.has(a)&&keep.has(b)&&edgeKeys.has(a+'>'+b);
 D.newNodes=D.newNodes.filter(n=>keep.has(n.id));
 for(const n of D.newNodes)n.nextNodes=adjacency.get(n.id).filter(id=>keep.has(id));
 for(const [id,targets] of Object.entries(D.patchOldNextNodes)){
  D.patchOldNextNodes[id]=targets.filter(to=>allowedPath(id,to));
 }
 D.bridges=D.bridges.filter(r=>r.nodeIds.every(id=>keep.has(id))&&
   r.nodeIds.slice(1).every((to,i)=>allowedPath(r.nodeIds[i],to)));
 const roads=[];
 for(const road of D.roads){
  let segment=[];
  const flush=()=>{if(segment.length>=2)roads.push({...road,nodeIds:segment});
    segment=[];};
  for(const id of road.nodeIds){
   if(!keep.has(id)){flush();continue;}
   if(!segment.length){segment=[id];continue;}
   if(allowedPath(segment[segment.length-1],id))segment.push(id);
   else{flush();segment=[id];}
  }
  flush();
 }
 D.roads=roads;
 for(const collection of ['allPathSegments','existingRoadSegments','existingBridgeSegments'])
  D[collection]=D[collection].filter(e=>allowedPath(e.from_,e.to));
 for(const id of [...deleteSet,...orphaned])delete D.allNodePositions[id];
 D.overpasses=D.overpasses.filter(o=>edgeKeys.has(o.upper));
 const report={removedExplicit:explicit,removedOrphans:orphaned,
  baselineNodes:all.size,baselineEdges:[...all.values()].reduce((s,v)=>s+v.length,0),
  nodes:keep.size,edges:edgeKeys.size,missingPrefixes:removedPrefixes.filter(p=>
   ![...all.keys()].some(id=>id.startsWith(p)))};
 if(report.nodes!==302||report.edges!==321||D.bridges.length!==15)
  throw Error('V9 graph counts unexpected: '+JSON.stringify(report));
 D.graphMigration=Object.freeze(report);
 return report;
}
const V9_GRAPH=reduceGraphDesign();

/* V10: a one-way tour through each landmark. Every existing connector keeps
 * its internal ID. Only real directed links change, and all art/bridge
 * metadata is rebuilt from the exact playable graph. Saved V9 games are
 * intentionally rejected by MAP_VERSION; stale mid-edge positions cannot
 * silently resume on another route. */
function rebalanceV10(){
 const lookup=new Map(D.newNodes.map(n=>[n.id,n]));
 const replace=(from,oldTo,newTo)=>{
  const node=lookup.get(from);
  if(!node||!node.nextNodes.includes(oldTo)||node.nextNodes.includes(newTo))
   throw Error('V10 unexpected connector '+from+'>'+oldTo);
  node.nextNodes=node.nextNodes.map(id=>id===oldTo?newTo:id);
 };
 const remove=(from,to)=>{
  const node=lookup.get(from);
  if(!node||!node.nextNodes.includes(to))throw Error('V10 missing old route '+from+'>'+to);
  node.nextNodes=node.nextNodes.filter(id=>id!==to);
 };
 // Meadow: enter before the farm circuit, then traverse m0..m7 once and
 // return to the nearby GROVE, not jump 46 main checkpoints to n108.
 replace('xmin_2','m3','m0');
 remove('m0','xmout_1');
 replace('m7','m0','xmout_1');
 replace('xmout_2','n108','n56');
 // Workshop: the village bridge now enters w0, then the tour passes every
 // court and leaves from w7. A return visit must never repeat w0.
 replace('xvwb_5','w3','w0');
 remove('w6','xwf_1');
 replace('w7','w0','xwf_1');
 // Iceberg: arrive at s0; tour the sword court and exit from s7.
 replace('xacb_3','s6','s0');
 remove('s4','xba_1');
 replace('s7','s0','xba_1');
 const changes={
  min:['m3','m0'],mout:['m0','m7','n108','n56'],
  vwb:['w3','w0'],wf:['w6','w7'],
  acb:['s6','s0'],ba:['s4','s7']
 };
 const position=id=>D.allNodePositions[id]||lookup.get(id)?.position;
 // Move bridge waypoints with their endpoint; otherwise art retains the
 // original diagonal when graph traffic enters at a different side.
 for(const [key,edit] of Object.entries(changes)){
  const bridge=D.bridges.find(b=>b.id===key);
  if(!bridge)throw Error('V10 missing bridge '+key);
  const ids=bridge.nodeIds,oldFrom=ids[0],oldTo=ids[ids.length-1];
  const first=edit.length===4?edit[0]:key==='wf'||key==='ba'?edit[0]:oldFrom;
  const last=edit.length===4?edit[2]:key==='wf'||key==='ba'?oldTo:edit[0];
  const newFrom=edit.length===4?edit[1]:key==='wf'||key==='ba'?edit[1]:oldFrom;
  const newTo=edit.length===4?edit[3]:key==='wf'||key==='ba'?oldTo:edit[1];
  if(first!==oldFrom||last!==oldTo)throw Error('V10 bridge contract mismatch '+key);
  const oldA={...position(oldFrom)},oldB={...position(oldTo)};
  const newA={...position(newFrom)},newB={...position(newTo)};
  const dxA=newA.x-oldA.x,dyA=newA.y-oldA.y,dxB=newB.x-oldB.x,dyB=newB.y-oldB.y;
  for(let i=1;i<ids.length-1;i++){
   const t=i/(ids.length-1),node=lookup.get(ids[i]);
   if(!node)throw Error('V10 unknown waypoint '+ids[i]);
   node.position={
    x:Math.round(node.position.x+(1-t)*dxA+t*dxB),
    y:Math.round(node.position.y+(1-t)*dyA+t*dyB)
   };
   D.allNodePositions[node.id]={...node.position};
  }
  ids[0]=newFrom;ids[ids.length-1]=newTo;
 }
 // The new Meadow -> Grove exit skirts the forest's eastern bank, leaving
 // the original n51 inbound road unobscured and making both lanes legible.
 const start=position('m7'),end=position('n56');
 for(const [i,id] of ['xmout_1','xmout_2'].entries()){
  const t=(i+1)/3,bulge=Math.sin(Math.PI*t);
  const node=lookup.get(id);
  node.position={x:Math.round(start.x*(1-t)+end.x*t+160*bulge),
   y:Math.round(start.y*(1-t)+end.y*t+85*bulge)};
  D.allNodePositions[id]={...node.position};
 }
 // Harbor and Gingerbread have only three/two live tiles after V9. Treat
 // them as compact scenic stops, not large empty exploration islands.
 for(const name of ['harbor','ginger']){
  const island=D.islands.find(i=>i.id===name);
  const cells=D.newNodes.filter(n=>n.islandId===name);
  if(!island||cells.length!==(name==='harbor'?3:2))
   throw Error('Unexpected compact island '+name);
  const xs=cells.map(n=>n.position.x),ys=cells.map(n=>n.position.y);
  const cx=(Math.min(...xs)+Math.max(...xs))/2;
  const cy=(Math.min(...ys)+Math.max(...ys))/2;
  const rx=(Math.max(...xs)-Math.min(...xs))/2+230;
  const ry=(Math.max(...ys)-Math.min(...ys))/2+230;
  island.center={x:Math.round(cx),y:Math.round(cy)};
  island.outline=Array.from({length:32},(_,i)=>{
   const a=i*Math.PI/16;return{x:Math.round(cx+rx*Math.cos(a)),
    y:Math.round(cy+ry*Math.sin(a))};
  });
 }
 const actual=new Set([
  ...D.oldNodes.flatMap(n=>n.nextNodes.map(to=>n.id+'>'+to)),
  ...D.newNodes.flatMap(n=>n.nextNodes.map(to=>n.id+'>'+to)),
  ...Object.entries(D.patchOldNextNodes).flatMap(([id,to])=>to.map(dest=>id+'>'+dest))
 ]);
 const bridgeStyle=new Map();
 for(const b of D.bridges)for(let i=1;i<b.nodeIds.length;i++)
  bridgeStyle.set(b.nodeIds[i-1]+'>'+b.nodeIds[i],b.style);
 for(const key of bridgeStyle.keys())if(!actual.has(key))
  throw Error('V10 bridge route not traversable '+key);
 const oldSegments=new Map(D.allPathSegments.map(e=>[e.from_+'>'+e.to,e]));
 const segment=key=>{
  const [from_,to]=key.split('>'),a=position(from_),b=position(to);
  if(!a||!b)throw Error('V10 missing graphic endpoints '+key);
  const bridge=bridgeStyle.get(key);
  return {...(oldSegments.get(key)||{}),from_,to,
   kind:bridge?'bridge':'road',style:bridge||null,source:'v10',
   x1:a.x,y1:a.y,x2:b.x,y2:b.y};
 };
 D.allPathSegments=[...actual].map(segment);
 D.existingRoadSegments=D.existingRoadSegments.filter(e=>actual.has(e.from_+'>'+e.to))
  .map(e=>segment(e.from_+'>'+e.to));
 D.existingBridgeSegments=D.existingBridgeSegments.filter(e=>actual.has(e.from_+'>'+e.to))
  .map(e=>segment(e.from_+'>'+e.to));
 const roads=[];
 for(const road of D.roads){
  let group=[];
  const flush=()=>{if(group.length>1)roads.push({...road,nodeIds:group});group=[]};
  for(const id of road.nodeIds){
   if(!group.length){group.push(id);continue}
   if(actual.has(group[group.length-1]+'>'+id))group.push(id);
   else{flush();group.push(id)}
  }
  flush();
 }
 D.roads=roads;
 D.overpasses=D.overpasses.filter(o=>actual.has(o.upper));
 // Decoration collision clearance uses the same 88-unit road/bridge deck
 // and 44-unit tile radius as the renderer and manual-walking physics.
 D.isDecorationSpotClear=(x,y,r=25,pad=14)=>{
  const gap=r+pad;
  for(const id of Object.keys(D.allNodePositions)){
   const n=position(id);
   if(Math.hypot(n.x-x,n.y-y)<gap+44)return false;
  }
  for(const e of D.allPathSegments){
   const dx=e.x2-e.x1,dy=e.y2-e.y1,den=dx*dx+dy*dy||1;
   const t=Math.max(0,Math.min(1,((x-e.x1)*dx+(y-e.y1)*dy)/den));
   if(Math.hypot(x-e.x1-t*dx,y-e.y1-t*dy)<gap+44)return false;
  }
  return true;
 };
 if(actual.size!==318)throw Error('V10 expected 318 traversable edges, found '+actual.size);
 const report=Object.freeze({...V9_GRAPH,nodes:302,edges:actual.size,
  sourceVersion:'v9',topologyVersion:'v10'});
 D.graphMigration=report;
 return report;
}
const V10_GRAPH=rebalanceV10();

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
 const resolver=window.BoardBranchNaming;
 if(resolver?.fromGraph){
  const labels=resolver.fromGraph(m);
  m.nodePathIds=labels.nodePathIds;
  m.pathIdCollisions=labels.collisions;
  m.pathBranchCodes=labels.branchCodes;
  m.idMigration=Object.keys(m.nodes).sort().map(oldId=>({
   oldId,internalId:oldId,displayId:labels.nodePathIds[oldId]
  }));
  for(const entry of m.idMigration)m.nodes[entry.internalId].pathId=entry.displayId;
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
 if(window.BoardBranchNaming?.fromGraph){
  if(!m.nodePathIds||Object.keys(m.nodePathIds).length!==all.length||
     !Array.isArray(m.idMigration)||m.idMigration.length!==all.length)
   throw Error('Missing V9 path IDs');
  const seenIds=new Set();
  for(const entry of m.idMigration){
   if(!m.nodes[entry.internalId]||entry.oldId!==entry.internalId||
      m.nodePathIds[entry.internalId]!==entry.displayId||
      m.nodes[entry.internalId].pathId!==entry.displayId||
      seenIds.has(entry.internalId))throw Error('Invalid branch identity mapping');
   seenIds.add(entry.internalId);
  }
 }
 if(all.length!==V9_GRAPH.nodes||idSet.size!==all.length||
 m.islands.length!==ISLANDS||m.startId!=='n0'||m.finishId!=='n152'||
 m.nodes.n0.type!=='start'||m.nodes.n152.type!=='finish'||
 m.nodes.n152.nextNodes.length||m.length!==Base.MAIN_LENGTH)
  throw Error('BOARD v7 map endpoints or counts invalid');
 const islands=new Map(m.islands.map(i=>[i.id,i])),bridges=new Set();
 if(islands.size!==ISLANDS)throw Error('Duplicate island');
 for(const [a,b]of m.bridges){const k=a+'>'+b;if(bridges.has(k))throw Error('Duplicate bridge '+k);bridges.add(k);}
 const visited=new Set(),todo=[m.startId];
 while(todo.length){const id=todo.pop();if(visited.has(id))continue;visited.add(id);todo.push(...m.nodes[id].nextNodes);}
 if(visited.size!==all.length)throw Error('Unreachable BOARD v9 nodes');
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
window.BoardMap=Object.freeze({...Base,MAP_VERSION:VERSION,create,assertCompatible,validate,GRAPH_MIGRATION:V10_GRAPH});
})();
