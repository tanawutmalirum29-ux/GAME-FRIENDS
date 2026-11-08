'use strict';
const fs=require('fs'),vm=require('vm'),ctx=vm.createContext({window:{},Math,Date,console});
for(const file of ['board-map.js','board-v7-design.js','board-v7-adapter.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const M=ctx.window.BoardMap,D=ctx.window.BOARD_PARTY_V7_DESIGN,m=M.create(0);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const edges=Object.values(m.nodes).flatMap(n=>n.nextNodes.map(k=>[n,m.nodes[k]]));
const lineHit=(a,b,c,d)=>{
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 return ab1*ab2<-.0001&&cd1*cd2<-.0001;
};
const cuts=[];
for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
 const [a,b]=edges[i], [c,d]=edges[j];
 if([a.id,b.id].some(id=>id===c.id||id===d.id))continue;
 if(lineHit(a.position,b.position,c.position,d.position))
  cuts.push([a.id+'>'+b.id,c.id+'>'+d.id,a.islandId,b.islandId,c.islandId,d.islandId]);
}
console.log('DESIGN_KEYS '+JSON.stringify(Object.keys(D)));
console.log('MAP_VERSION '+m.version+' NODES '+Object.keys(m.nodes).length+' EDGES '+edges.length+' ISLANDS '+m.islands.length);
console.log('SWORD_SINGLES '+JSON.stringify(Object.values(m.territories).filter(x=>x.nodeIds.length!==2).map(x=>({id:x.id,nodes:x.nodeIds}))));
console.log('CROSSINGS '+cuts.length+' FIRST '+JSON.stringify(cuts.slice(0,40)));
const result=[];
for(const isl of m.islands){
 const nodes=Object.values(m.nodes).filter(x=>x.islandId===isl.id);
 const nearest=[];
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)
  nearest.push({a:nodes[i].id,b:nodes[j].id,d:Math.round(dist(nodes[i].position,nodes[j].position))});
 nearest.sort((a,b)=>a.d-b.d);
 const internal=edges.filter(([a,b])=>a.islandId===isl.id&&b.islandId===isl.id);
 const innerCuts=cuts.filter(c=>c.slice(2).every(z=>z===isl.id));
 const types=nodes.reduce((a,n)=>(a[n.type]=(a[n.type]||0)+1,a),{});
 const ingress=edges.filter(([a,b])=>a.islandId!==isl.id&&b.islandId===isl.id).map(([a,b])=>a.id+'>'+b.id);
 const egress=edges.filter(([a,b])=>a.islandId===isl.id&&b.islandId!==isl.id).map(([a,b])=>a.id+'>'+b.id);
 const xs=isl.outline.map(p=>p.x),ys=isl.outline.map(p=>p.y);
 const isSmall=nodes.length<10;
 result.push({id:isl.id,name:isl.name,theme:isl.theme,n:nodes.length,types,edges:internal.length,
  center:isl.center,box:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],
  close:nearest.filter(z=>z.d<145).slice(0,16),minDistance:nearest[0],
  crossings:innerCuts.length,ingress,egress,
  ids:isSmall?nodes.map(n=>[n.id,n.type,n.position.x,n.position.y]):undefined});
}
console.log('ISLAND_AUDIT '+JSON.stringify(result));
console.log('V7_NEW_NODES '+JSON.stringify(D.newNodes.map(n=>[n.id,n.type,n.islandId,n.nextNodes]).slice(0,85)));
console.log('V7_BRIDGES '+JSON.stringify(D.bridges.map(x=>[x.id,x.style,x.nodeIds])));
console.log('SWORD_TYPES '+JSON.stringify(Object.values(m.nodes).filter(n=>n.type==='sword').map(n=>[n.id,n.islandId,n.position.x,n.position.y,n.territoryId])));
console.log('DESIGN_POS_SAMPLE '+JSON.stringify(Object.entries(D.allNodePositions).slice(0,5)));
