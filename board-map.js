/* Directed winter board. Coordinates are world units, never screen pixels. */
(() => {
'use strict';
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const MAIN_LENGTH=54, SWORD_TILES=Object.freeze(['n20','n21']);
function create(seed=Date.now()){
 const rng=random(seed),nodes={},bridges=[];
 const types=['movement','movement','healing','danger','event','neutral','key','milestone'];
 function add(id,x,y,progress,type){
  nodes[id]={id,position:{x,y},type,nextNodes:[],previousNodes:[],progress,
    effects:type==='healing'?{hp:20}:type==='danger'?{hp:-35}:type==='event'?{randomHp:true}:{},
    ...(type==='sword'?{ownerId:null}:{})};
 }
 function link(a,b,bridge=false){nodes[a].nextNodes.push(b);nodes[b].previousNodes.push(a);if(bridge)bridges.push([a,b]);}
 for(let i=0;i<=MAIN_LENGTH;i++){
  const row=Math.floor(i/10),col=i%10;
  add('n'+i,220+(row%2?9-col:col)*145,300+row*310+Math.sin(col*.75)*48,i,
   i===0?'start':i===MAIN_LENGTH?'finish':SWORD_TILES.includes('n'+i)?'sword':types[Math.floor(rng()*types.length)]);
  if(i)link('n'+(i-1),'n'+i,i%10===0);
 }
 // Two risky shortcuts and a longer healing trail; every branch rejoins.
 for(const [a,b,count,offset,safe] of [[3,8,3,-160,false],[13,18,3,165,false],[24,28,6,165,true]]){
  let prev='n'+a;
  for(let j=1;j<=count;j++){
   const t=j/(count+1),from=nodes['n'+a].position,to=nodes['n'+b].position,id='b'+a+'_'+j;
   add(id,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t+Math.sin(Math.PI*t)*offset,
    a+(b-a)*t,safe?(j%2?'healing':'movement'):(j%2?'danger':'event'));
   link(prev,id,j===1);prev=id;
  }
  link(prev,'n'+b,true);
 }
 const map={seed,nodes,startId:'n0',finishId:'n'+MAIN_LENGTH,length:MAIN_LENGTH,width:1800,height:2100,rows:Math.ceil((MAIN_LENGTH+1)/10),bridges};
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
  for(const next of n.nextNodes){const q=map.nodes[next];if(!q||q.progress<=n.progress||!q.previousNodes.includes(id))throw Error('Invalid forward edge');visit(next);}
  visiting.delete(id);done.add(id);
 }
 visit(map.startId);
 if(done.size!==Object.keys(map.nodes).length||!done.has(map.finishId))throw Error('Unreachable board node');
 return true;
}
function choose(map,id,x,y,allowed=null){
 const n=map.nodes[id],options=allowed||n.nextNodes;
 if(Math.hypot(x,y)<.25)return options[0];
 return [...options].sort((a,b)=>{
  const dot=k=>{const p=map.nodes[k].position,dx=p.x-n.position.x,dy=p.y-n.position.y;return(dx*x+dy*y)/Math.hypot(dx,dy);};
  return dot(b)-dot(a);
 })[0];
}
window.BoardMap=Object.freeze({create,validate,choose,random,MAIN_LENGTH,SWORD_TILES});
})();
