/* Directed winter board, validated at graph level. World coordinates, never pixels. */
(() => {
'use strict';
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const MAIN_LENGTH=72,SWORD_TILES=Object.freeze(['n20','n21']);
const TERRITORY_ID='sword-territory-1';
const weighted=['movement','movement','movement','movement','neutral','key','event','event','healing','danger','movement'];
function neighbors(map,id){const n=map.nodes[id];return [...n.nextNodes,...n.previousNodes];}
function adjacentType(map,id,type){return neighbors(map,id).some(k=>map.nodes[k]?.type===type);}
function addType(n,type){
 n.type=type;n.effects=type==='healing'?{hp:20}:type==='danger'?{hp:-35}:type==='event'?{randomHp:true}:
  type==='lucky'?{item:true}:{};
}
// Seven authored regions form a horseshoe around the final summit. Geometry is
// independent of the seeded tile distribution: changing art never changes rules.
function arrange(map){
 const regions=[
  ['camp','SNOWFALL HARBOR',0,10,500,1850,40,270,400,310],
  ['grove','LANTERN GROVE',11,18,480,750,90,345,360,330],
  ['sword','SWORDKEEP',19,30,1490,450,165,375,430,290],
  ['frost','FROSTFANG RIDGE',31,40,2550,750,195,430,390,310],
  ['aurora','AURORA REACH',41,50,2870,1740,250,510,470,370],
  ['lucky','STARFALL GARDEN',51,64,1810,2300,330,620,450,310],
  ['crown','CROWN SUMMIT',65,72,1630,1350,90,350,370,300]
 ];
 const sample=(points,t)=>{
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
  let remaining=lengths.reduce((a,b)=>a+b,0)*t;
  for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const u=remaining/lengths[i];return{x:points[i].x+(points[i+1].x-points[i].x)*u,y:points[i].y+(points[i+1].y-points[i].y)*u};}remaining-=lengths[i];}
 };
 const sx=1.2,sy=.85,point=(x,y)=>({x:Math.round(x*sx),y:Math.round(y*sy)});
 map.islands=regions.map(([theme,name,first,last,x,y,begin,end,rx,ry])=>{
  const island={id:theme,name,theme,center:point(x,y),landmark:point(x,y),nodeIds:[],outline:[]};
  const curve=Array.from({length:121},(_,j)=>{const a=(begin+(end-begin)*j/120)*Math.PI/180;return point(x+Math.cos(a)*rx,y+Math.sin(a)*ry);});
  for(let i=first;i<=last;i++){
   const n=map.nodes['n'+i];n.position=sample(curve,(i-first)/(last-first));n.islandId=theme;island.nodeIds.push(n.id);
  }
  island.radii={x:rx*sx,y:ry*sy};
  return island;
 });
 for(const b of map.branches){
  const a=map.nodes['n'+b.a],z=map.nodes['n'+b.b],island=map.islands.find(i=>i.id===a.islandId);
  const dx=z.position.x-a.position.x,dy=z.position.y-a.position.y,d=Math.hypot(dx,dy);
  const mx=(a.position.x+z.position.x)/2,my=(a.position.y+z.position.y)/2;
  const sign=(-dy*(island.center.x-mx)+dx*(island.center.y-my))>=0?1:-1;
  const depth=45;
  b.kind=b.count>b.b-b.a?'scenic':'risky';b.islandId=island.id;
  let detour=null;
  if(b.kind==='scenic'){
   const rx=island.radii.x,ry=island.radii.y,c=island.center;
   const begin=Math.atan2((a.position.y-c.y)/ry,(a.position.x-c.x)/rx);
   let end=Math.atan2((z.position.y-c.y)/ry,(z.position.x-c.x)/rx);while(end>=begin)end-=Math.PI*2;
   const radius=b.a===24?.53:b.a===41?.65:.65;
   detour=[a.position,...Array.from({length:101},(_,i)=>{const angle=begin+(end-begin)*i/100;return{x:c.x+Math.cos(angle)*rx*radius,y:c.y+Math.sin(angle)*ry*radius};}),z.position];
  }
  for(let j=1;j<=b.count;j++){
   const t=j/(b.count+1),offset=Math.sin(Math.PI*t)*depth*sign,n=map.nodes['b'+b.a+'_'+j];
   n.position=detour?sample(detour,t):{x:Math.round(a.position.x+dx*t-dy/d*offset),y:Math.round(a.position.y+dy*t+dx/d*offset)};
   n.islandId=island.id;island.nodeIds.push(n.id);
  }
 }
 // Buffered convex shorelines follow the authored paths, giving each island a
 // different silhouette. All walkable segments remain on snow, not over water.
 const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 for(const island of map.islands){
  const points=[...island.nodeIds.map(id=>map.nodes[id].position),island.center];
  const cloud=points.flatMap((p,i)=>Array.from({length:12},(_,j)=>{
   const a=j*Math.PI/6,r=110+9*Math.sin(i*1.7+j*2.1);return{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};
  })).sort((a,b)=>a.x-b.x||a.y-b.y);
  const lower=[],upper=[];
  for(const p of cloud){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of [...cloud].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  island.outline=[...lower.slice(0,-1),...upper.slice(0,-1)];
  const edges=island.nodeIds.flatMap(id=>map.nodes[id].nextNodes.filter(to=>map.nodes[to].islandId===island.id).map(to=>[map.nodes[id].position,map.nodes[to].position]));
  const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
  let clearance=-1;
  for(let dx=-170;dx<=170;dx+=34)for(let dy=-140;dy<=140;dy+=28){
   const p={x:island.center.x+dx,y:island.center.y+dy},d=Math.min(...edges.map(([a,b])=>distance(p,a,b)));
   if(d>clearance){clearance=d;island.landmark=p;}
  }
  island.landmark.clearance=clearance;
 }
 map.bridges=[];map.bridgeStyles={};
 const materials=['wood','stone','ice','wood','ice','stone'];let k=0;
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){
  if(n.islandId===map.nodes[id].islandId)continue;
  map.bridges.push([n.id,id]);map.bridgeStyles[n.id+'>'+id]=materials[k++%materials.length];
 }
 const shores=map.islands.flatMap(i=>i.outline);
 map.bounds={minX:Math.max(0,Math.min(...shores.map(p=>p.x))-65),minY:Math.max(0,Math.min(...shores.map(p=>p.y))-65),
  maxX:Math.max(...shores.map(p=>p.x))+65,maxY:Math.max(...shores.map(p=>p.y))+85};
 map.width=Math.ceil(map.bounds.maxX+55);map.height=Math.ceil(map.bounds.maxY+55);map.rows=map.islands.length;
}
function create(seed=Date.now()){
 const rng=random(seed),nodes={},bridges=[];
 function add(id,x,y,progress,type='movement'){
  const node={id,position:{x,y},type,nextNodes:[],previousNodes:[],progress,effects:{}};
  addType(node,type);nodes[id]=node;
 }
 function link(a,b){nodes[a].nextNodes.push(b);nodes[b].previousNodes.push(a);}
 for(let i=0;i<=MAIN_LENGTH;i++){
  const type=i===0?'start':i===MAIN_LENGTH?'finish':SWORD_TILES.includes('n'+i)?'sword':weighted[Math.floor(rng()*weighted.length)];
  add('n'+i,0,0,i,type);
  if(i)link('n'+(i-1),'n'+i);
 }
 // Alternatives preserve old node IDs. Longer routes deliberately contain
 // beneficial spaces as compensation for their extra distance.
 const branches=[
  {a:3,b:8,count:3},
  {a:13,b:18,count:3},
  {a:24,b:28,count:6},
  {a:41,b:47,count:8},
  {a:58,b:64,count:8}
 ];
 for(const b of branches){
  let previous='n'+b.a;
  for(let j=1;j<=b.count;j++){
   const t=j/(b.count+1);
   const id='b'+b.a+'_'+j;
   // Color variants may change below, but every branch stays connected.
   add(id,0,0,b.a+(b.b-b.a)*t,'movement');
   link(previous,id);previous=id;
  }
  link(previous,'n'+b.b);
  // Long routes pay the player back for added travel. Shortcuts have risk.
  const slots=Array.from({length:b.count},(_,i)=>nodes['b'+b.a+'_'+(i+1)]);
  const layout=b.count>b.b-b.a?
   ['healing','movement','event','movement','healing','movement','lucky','movement']:
   ['danger','movement','event'];
  for(let i=0;i<slots.length;i++)addType(slots[i],layout[i%layout.length]);
 }
 const map={seed,nodes,startId:'n0',finishId:'n'+MAIN_LENGTH,length:MAIN_LENGTH,width:0,
  height:0,rows:0,bridges,branches,
  territories:{[TERRITORY_ID]:{id:TERRITORY_ID,nodeIds:[...SWORD_TILES],ownerId:null}},luckyTileIds:[]};
 for(const id of SWORD_TILES){addType(nodes[id],'sword');nodes[id].territoryId=TERRITORY_ID;nodes[id].ownerId=null;}
 // Six seed-varying core Lucky Stars, distributed across the map, never
 // adjacent via ANY edge (including fork endpoints). Plus a branch Lucky Star
 // on the two longer detours as a balanced reward.
 const mainRegions=[[6,12],[14,19],[24,33],[36,45],[49,58],[61,70]];
 for(const [from,to] of mainRegions){
  const options=Array.from({length:to-from+1},(_,j)=>'n'+(from+j));
  for(let i=options.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
  const id=options.find(id=>!adjacentType(map,id,'lucky')&&!SWORD_TILES.includes(id));
  if(!id)throw Error('No non-adjacent Lucky Star in region');
  addType(nodes[id],'lucky');
 }
 // Graph-aware de-clustering for healing and Lucky Star. Priority: retain the
 // six main Lucky Stars, then preserve branch rewards where separation allows.
 for(const id of Object.keys(nodes)){
  const n=nodes[id];if(n.type!=='healing')continue;
  if(adjacentType(map,id,'healing'))addType(n,'movement');
 }
 // Any branch Lucky Star touching a main Lucky Star becomes a healing space.
 for(const id of Object.keys(nodes)){
  const n=nodes[id];if(n.type!=='lucky'||id[0]!=='b')continue;
  if(adjacentType(map,id,'lucky'))addType(n,'healing');
 }
 // Newly introduced healing spaces must also respect graph adjacency.
 for(const id of Object.keys(nodes)){
  const n=nodes[id];if(n.type==='healing'&&adjacentType(map,id,'healing'))addType(n,'movement');
 }
 // Guarantee the longer detours contain a beneficial reward even after
 // adjacency de-clustering, without introducing touching heal/lucky nodes.
 for(const b of branches.filter(b=>b.count>b.b-b.a)){
  const path=Array.from({length:b.count},(_,j)=>nodes['b'+b.a+'_'+(j+1)]);
  if(!path.some(n=>n.type==='healing'||n.type==='lucky')){
   const good=path.find(n=>!adjacentType(map,n.id,'healing')&&!adjacentType(map,n.id,'lucky'));
   if(good)addType(good,'healing');
  }
 }
 map.luckyTileIds=Object.values(nodes).filter(n=>n.type==='lucky').map(n=>n.id);
 arrange(map);validate(map);return map;
}
function validate(map){
 const visiting=new Set(),done=new Set();
 function visit(id){
  if(visiting.has(id))throw Error('Board cycle at '+id);
  if(done.has(id))return;
  const n=map.nodes[id];if(!n)throw Error('Missing node '+id);
  if(id!==map.finishId&&!n.nextNodes.length)throw Error('Dead end '+id);
  visiting.add(id);
  for(const next of n.nextNodes){
   const q=map.nodes[next];
   if(!q||q.progress<=n.progress||!q.previousNodes.includes(id))throw Error('Invalid forward edge '+id);
   visit(next);
  }
  visiting.delete(id);done.add(id);
 }
 visit(map.startId);
 if(done.size!==Object.keys(map.nodes).length||!done.has(map.finishId))throw Error('Unreachable board node');
 const regions=new Map(map.islands.map(i=>[i.id,i])),bridgeKeys=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 for(const node of Object.values(map.nodes)){
  const region=regions.get(node.islandId),p=node.position;
  if(!region?.nodeIds.includes(node.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>map.width||p.y<0||p.y>map.height)throw Error('Invalid island placement '+node.id);
  for(const next of node.nextNodes){const crosses=node.islandId!==map.nodes[next].islandId,key=node.id+'>'+next;
   if(crosses!==bridgeKeys.has(key)||(crosses&&!map.bridgeStyles[key]))throw Error('Missing island connector '+key);
  }
 }
 for(const node of Object.values(map.nodes)){
  if(node.type==='milestone')throw Error('Deprecated trophy tile '+node.id);
  if(['lucky','healing'].includes(node.type)&&adjacentType(map,node.id,node.type))
   throw Error('Adjacent '+node.type+' tiles at '+node.id);
 }
 const t=map.territories[TERRITORY_ID];
 if(!t||t.nodeIds.length!==2||t.nodeIds.some(id=>map.nodes[id].territoryId!==TERRITORY_ID))throw Error('Linked swords invalid');
 if(!map.nodes.n20.nextNodes.includes('n21'))throw Error('Sword tiles not connected');
 for(const b of map.branches){
  const short=Array.from({length:b.b-b.a-1},(_,i)=>map.nodes['n'+(b.a+i+1)]);
  const long=Array.from({length:b.count},(_,i)=>map.nodes['b'+b.a+'_'+(i+1)]);
  if(b.count>b.b-b.a-1&&long.filter(n=>['healing','lucky'].includes(n.type)).length===0)
   throw Error('Long branch missing beneficial tiles '+b.a);
  if(!short.length||!long.length)throw Error('Branch disconnected');
 }
 return true;
}
function choose(map,id,x,y,allowed=null){
 const n=map.nodes[id],options=allowed||n.nextNodes;
 if(!options.length)return null;
 if(Math.hypot(x,y)<.25)return options[0];
 return [...options].sort((a,b)=>{
  const dot=k=>{const p=map.nodes[k].position,dx=p.x-n.position.x,dy=p.y-n.position.y;return(dx*x+dy*y)/Math.hypot(dx,dy);};
  return dot(b)-dot(a);
 })[0];
}
window.BoardMap=Object.freeze({create,validate,choose,neighbors,random,MAIN_LENGTH,SWORD_TILES,TERRITORY_ID});
})();