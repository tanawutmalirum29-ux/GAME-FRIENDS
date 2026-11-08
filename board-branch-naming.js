/* BOARD PARTY branch labels. Names are derived from topology descriptors,
 * never used as mutable node identities until a validated migration occurs. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(root)root.BoardBranchNaming=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 function alphabet(index){
  if(!Number.isSafeInteger(index)||index<0)throw Error('Invalid branch order');
  let out='',n=index;
  do{out=String.fromCharCode(97+n%26)+out;n=Math.floor(n/26)-1;}while(n>=0);
  return out;
 }
 function assign(records){
  if(!Array.isArray(records))throw Error('Branch records must be an array');
  const byId=new Map(),children=new Map();
  for(const r of records){
   if(!r||!r.internalId||typeof r.internalId!=='string'||byId.has(r.internalId))
    throw Error('Duplicate/invalid internal branch ID');
   if(!Array.isArray(r.nodeIds)||new Set(r.nodeIds).size!==r.nodeIds.length||
      r.nodeIds.some(n=>!n||typeof n!=='string'))
    throw Error('Invalid internal nodes');
   if(!Number.isFinite(r.sourceOrder))throw Error('Missing structural sourceOrder '+r.internalId);
   byId.set(r.internalId,r);
  }
  for(const r of records){
   const parent=r.parentId||'n';
   if(parent!=='n'&&!byId.has(parent))throw Error('Unknown branch parent '+parent);
   if(!children.has(parent))children.set(parent,[]);
   children.get(parent).push(r);
  }
  const names=new Map(),visiting=new Set(),seen=new Set();
  function walk(parent,prefix){
   const list=children.get(parent)||[];
   list.sort((a,b)=>a.sourceOrder-b.sourceOrder||
    (Number.isFinite(a.sourceAngle)?a.sourceAngle:0)-
    (Number.isFinite(b.sourceAngle)?b.sourceAngle:0));
   for(let j=1;j<list.length;j++){
    const a=list[j-1],b=list[j];
    if(a.sourceOrder===b.sourceOrder&&
       (!Number.isFinite(a.sourceAngle)||!Number.isFinite(b.sourceAngle)||
        a.sourceAngle===b.sourceAngle))
     throw Error('Ambiguous branch order '+parent);
   }
   for(let i=0;i<list.length;i++){
    const r=list[i],id=r.internalId;
    if(visiting.has(id))throw Error('Cyclic branch hierarchy '+id);
    if(seen.has(id))throw Error('Duplicate branch traversal '+id);
    visiting.add(id);names.set(id,prefix+alphabet(i));
    walk(id,prefix+alphabet(i));
    visiting.delete(id);seen.add(id);
   }
  }
  walk('n','');
  if(seen.size!==records.length)throw Error('Unreachable/cyclic branch hierarchy');
  const mapping=[],nodeIds=new Set(),byDisplay=new Map();
  for(const r of records){
   const parent=r.parentId||'n',target=r.terminalBranchId||'n';
   if(target!=='n'&&!byId.has(target))throw Error('Unknown terminal branch '+target);
   const displayPrefix=names.get(r.internalId)+
      (target==='n'||target===parent||target===r.internalId?'':names.get(target));
   r.nodeIds.forEach((nodeId,index)=>{
    if(nodeIds.has(nodeId))throw Error('Internal node occurs in multiple branches '+nodeId);
    nodeIds.add(nodeId);
    const displayId=displayPrefix+'_'+index;
    mapping.push({internalId:nodeId,internalBranchId:r.internalId,
      parentId:parent,terminalBranchId:target,
      depth:names.get(r.internalId).length,displayId});
    if(!byDisplay.has(displayId))byDisplay.set(displayId,[]);
    byDisplay.get(displayId).push(nodeId);
   });
  }
  mapping.sort((a,b)=>a.displayId.localeCompare(b.displayId)||a.internalId.localeCompare(b.internalId));
  return{mapping,branchCodes:Object.fromEntries(names),
   collisions:[...byDisplay].filter(([,ids])=>ids.length>1)
    .map(([displayId,internalIds])=>({displayId,internalIds}))};
 }

function fromGraph(map){
 if(!map?.nodes||!Number.isSafeInteger(map.length))throw Error('Missing board graph');
 const main=[],mainSet=new Set();
 for(let i=0;i<=map.length;i++){
  const id='n'+i,n=map.nodes[id];
  if(!n||i<map.length&&!n.nextNodes.includes('n'+(i+1)))
   throw Error('Broken main graph at '+id);
  main.push(id);mainSet.add(id);
 }
 const seen=new Set(main),owner=new Map(),records=[];
 const node=id=>{const n=map.nodes[id];if(!n)throw Error('Unknown graph node '+id);return n;};
 const angle=(a,b)=>{const x=node(a).position,y=node(b).position;
  return Math.atan2(y.y-x.y,y.x-x.x);};
 function visit(from,to,parentId,order){
  if(seen.has(to))return;
  const id='branch@'+from+'>'+to,children=[];
  const branch={internalId:id,parentId,sourceOrder:order,
   sourceAngle:angle(from,to),terminalNodeId:null,terminalBranchId:'n',nodeIds:[]};
  let previous=from,current=to;
  while(!seen.has(current)){
   const n=node(current);seen.add(current);owner.set(current,id);
   branch.nodeIds.push(current);
   const options=n.nextNodes.map(dest=>{
    const a=node(previous).position,p=n.position,q=node(dest).position;
    const ux=p.x-a.x,uy=p.y-a.y,vx=q.x-p.x,vy=q.y-p.y;
    return{dest,newNode:!seen.has(dest)&&!mainSet.has(dest),
     straight:(ux*vx+uy*vy)/
      (Math.max(1e-6,Math.hypot(ux,uy))*Math.max(1e-6,Math.hypot(vx,vy)))};
   }).sort((a,b)=>Number(b.newNode)-Number(a.newNode)||
      b.straight-a.straight||a.dest.localeCompare(b.dest));
   if(!options.length)throw Error('Dead end while naming '+current);
   const primary=options[0];
   for(const choice of options.slice(1))
    children.push({from:current,to:choice.dest,order:branch.nodeIds.length-1});
   previous=current;current=primary.dest;
  }
  branch.terminalNodeId=current;records.push(branch);
  children.sort((a,b)=>a.order-b.order||angle(a.from,a.to)-angle(b.from,b.to));
  for(const c of children)visit(c.from,c.to,id,c.order);
 }
 for(let i=0;i<main.length;i++){
  const from=main[i];
  const other=node(from).nextNodes.filter(to=>to!=='n'+(i+1))
   .sort((a,b)=>angle(from,a)-angle(from,b));
  for(const to of other)visit(from,to,'n',i);
 }
 const missing=Object.keys(map.nodes).filter(id=>!seen.has(id));
 if(missing.length)throw Error('Unassigned graph node '+missing.join(','));
 for(const rec of records){
  rec.terminalBranchId=mainSet.has(rec.terminalNodeId)?'n':owner.get(rec.terminalNodeId);
  if(!rec.terminalBranchId)throw Error('Missing destination for '+rec.internalId);
 }
 const resolved=assign(records),nodePathIds=Object.create(null);
 for(const id of main)nodePathIds[id]=id;
 for(const item of resolved.mapping)nodePathIds[item.internalId]=item.displayId;
 if(Object.keys(nodePathIds).length!==Object.keys(map.nodes).length)
  throw Error('Incomplete branch naming');
 return{...resolved,nodePathIds,descriptors:records};
}
 return Object.freeze({alphabet,assign,fromGraph});
});
