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
      (target==='n'||target===parent?'':names.get(target));
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
 return Object.freeze({alphabet,assign});
});
