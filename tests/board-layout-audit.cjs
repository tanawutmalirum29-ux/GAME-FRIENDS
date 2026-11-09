'use strict';
require('../scripts/build-board-v7.cjs');
const verbose=process.argv.includes('--verbose')||process.env.BOARD_LAYOUT_DEBUG==='1';
const detail=(...parts)=>{if(verbose)console.log(...parts);};
const fs=require('fs'),vm=require('vm'),ctx=vm.createContext({window:{},Math,Date,console});
for(const file of ['src/board-party/runtime/board-map.js','src/board-party/runtime/board-v7-design.js','src/board-party/runtime/board-v7-adapter.js'])
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
detail('DESIGN_KEYS '+JSON.stringify(Object.keys(D)));
detail('MAP_VERSION '+m.version+' NODES '+Object.keys(m.nodes).length+' EDGES '+edges.length+' ISLANDS '+m.islands.length);
detail('SWORD_SINGLES '+JSON.stringify(Object.values(m.territories).filter(x=>x.nodeIds.length!==2).map(x=>({id:x.id,nodes:x.nodeIds}))));
detail('CROSSINGS '+cuts.length+' FIRST '+JSON.stringify(cuts.slice(0,40)));
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
detail('ISLAND_AUDIT '+JSON.stringify(result));
detail('V7_NEW_NODES '+JSON.stringify(D.newNodes.map(n=>[n.id,n.type,n.islandId,n.nextNodes]).slice(0,85)));
detail('V7_BRIDGES '+JSON.stringify(D.bridges.map(x=>[x.id,x.style,x.nodeIds])));
detail('SWORD_TYPES '+JSON.stringify(Object.values(m.nodes).filter(n=>n.type==='sword').map(n=>[n.id,n.islandId,n.position.x,n.position.y,n.territoryId])));
detail('DESIGN_POS_SAMPLE '+JSON.stringify(Object.entries(D.allNodePositions).slice(0,5)));

detail('DESIGN_SHAPES '+JSON.stringify({
 version:D.version,
 map:D.map,
 roadsLength:D.roads?.length,roads:D.roads?.slice?.(0,4),
 overpasses:D.overpasses?.slice?.(0,3),
 newNodes:D.newNodes?.slice(0,3),
 oldNodes:D.oldNodes?.slice(0,3),
 bridges:D.bridges?.slice(0,2),
 islands:D.islands?.slice(0,2),
 decorZones:D.decorZones?.slice?.(0,2),
 oldNodePositions:Object.entries(D.oldNodePositions||{}).slice(0,3),
 existingRoadSegments:D.existingRoadSegments?.slice?.(0,2),
 allPathSegments:D.allPathSegments?.slice?.(0,3),
 frozen:Object.isFrozen(D),
 frozenPos:Object.isFrozen(D.allNodePositions)
}));
detail('EXTENDED_POS '+JSON.stringify(
 ['w0','w1','w2','w3','w4','w5','w6','w7','h0','h1','h2','h3','h4','h5','h6','g0','g1','g2','g3','g4','g5','g6','g7','s0','s1','s2','s3','s4','s5','s6','s7',
 'n134','n135','xgb_1','xgb_2','xgb_3','xgb_4','xgb_5','xgb_6','xgb_7','xgl_4','xgl_5','xgl_6']
 .map(id=>[id,m.nodes[id]?.position,m.nodes[id]?.nextNodes,m.nodes[id]?.islandId])));

detail('DENSE_POS '+JSON.stringify(['workshop','meadow','harbor','ginger','berg'].map(id=>({id,nodes:Object.values(m.nodes).filter(n=>n.islandId===id).map(n=>[n.id,n.position.x,n.position.y,n.nextNodes])}))));
detail('DESIGN_DECOR_ZONES '+JSON.stringify(Object.entries(D.decorZones||{}).slice(0,5).map(([id,v])=>[id,JSON.stringify(v).slice(0,250)])));

detail('CROSSING_GEOMETRY '+JSON.stringify(cuts.map(c=>{const [u,v]=c;return [u,v,...[...u.split('>'),...v.split('>')].map(id=>[id,m.nodes[id].position.x,m.nodes[id].position.y])]})));
detail('BERG_OUTLINE '+JSON.stringify(D.islands.find(i=>i.id==='berg').outline));

console.log('BOARD LAYOUT AUDIT: '+m.version+', '+Object.keys(m.nodes).length+
 ' nodes, '+edges.length+' routes, '+m.islands.length+' islands, '+cuts.length+
 ' geometric crossings, '+Object.keys(m.territories).length+' sword pairs'+
 (verbose?' (verbose details above)':' (use --verbose for JSON)'));
