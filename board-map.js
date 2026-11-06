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
function create(seed=Date.now()){
 const rng=random(seed),nodes={},bridges=[];
 const nodesByZone=[[],[],[],[]];
 function add(id,x,y,progress,type='movement'){
  const node={id,position:{x,y},type,nextNodes:[],previousNodes:[],progress,effects:{}};
  addType(node,type);nodes[id]=node;nodesByZone[Math.min(3,Math.floor(progress/(MAIN_LENGTH/4)))].push(id);
 }
 function link(a,b,bridge=false){nodes[a].nextNodes.push(b);nodes[b].previousNodes.push(a);if(bridge)bridges.push([a,b]);}
 for(let i=0;i<=MAIN_LENGTH;i++){
  const row=Math.floor(i/10),col=i%10;
  const type=i===0?'start':i===MAIN_LENGTH?'finish':SWORD_TILES.includes('n'+i)?'sword':weighted[Math.floor(rng()*weighted.length)];
  add('n'+i,220+(row%2?9-col:col)*145,300+row*310+Math.sin(col*.75)*48,i,type);
  if(i)link('n'+(i-1),'n'+i,i%10===0);
 }
 // Alternatives preserve old node IDs. Longer routes deliberately contain
 // beneficial spaces as compensation for their extra distance.
 const branches=[
  {a:3,b:8,count:3,offset:-160},
  {a:13,b:18,count:3,offset:165},
  {a:24,b:28,count:6,offset:165},
  {a:41,b:47,count:8,offset:-160},
  {a:58,b:64,count:8,offset:165}
 ];
 for(const b of branches){
  let previous='n'+b.a;
  for(let j=1;j<=b.count;j++){
   const t=j/(b.count+1),from=nodes['n'+b.a].position,to=nodes['n'+b.b].position;
   const id='b'+b.a+'_'+j;
   // Color variants may change below, but every branch stays connected.
   add(id,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t+Math.sin(Math.PI*t)*b.offset,
    b.a+(b.b-b.a)*t,'movement');
   link(previous,id,j===1);previous=id;
  }
  link(previous,'n'+b.b,true);
  // Long routes pay the player back for added travel. Shortcuts have risk.
  const slots=Array.from({length:b.count},(_,i)=>nodes['b'+b.a+'_'+(i+1)]);
  const layout=b.count>b.b-b.a?
   ['healing','movement','event','movement','healing','movement','lucky','movement']:
   ['danger','movement','event'];
  for(let i=0;i<slots.length;i++)addType(slots[i],layout[i%layout.length]);
 }
 const map={seed,nodes,startId:'n0',finishId:'n'+MAIN_LENGTH,length:MAIN_LENGTH,width:1800,
  height:2800,rows:Math.ceil((MAIN_LENGTH+1)/10),bridges,branches,
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
 validate(map);return map;
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