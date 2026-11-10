/* Folder-only BOARD map discovery; no browser-side directory enumeration. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const mapsRoot=path.join(root,'src','board-party','maps');
const slugPattern=/^[a-z][a-z0-9-]*$/;
function assert(condition,message){if(!condition)throw Error(message);}
function list(dir,prefix=''){
 let result=[];
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  assert(!item.isSymbolicLink(),'Board map symlinks are forbidden: '+item.name);
  const relative=path.posix.join(prefix,item.name);
  if(item.isDirectory())result=result.concat(list(path.join(dir,item.name),relative));
  else if(item.isFile())result.push(relative);
  else throw Error('Unsupported board map asset: '+relative);
 }
 return result.sort();
}
function safeFile(value,local,label){
 assert(typeof value==='string'&&value.startsWith('./')&&!value.includes('..')&&
  !value.includes('\\')&&!value.includes('?')&&!value.includes('#'),
  'Unsafe '+label+' filename');
 const relative=value.slice(2);
 assert(relative&&local.includes(relative),'Missing '+label+': '+value);
 return relative;
}
function validateGraph(map,label){
 assert(map&&typeof map==='object'&&!Array.isArray(map),'Invalid board graph '+label);
 const nodes=map.nodes;
 assert(nodes&&typeof nodes==='object'&&!Array.isArray(nodes),'Missing nodes '+label);
 const entries=Object.entries(nodes);
 assert(entries.length>=2&&entries.length<=5000,'Invalid node count '+label);
 assert(map.startId==='n0','New board map must start at n0: '+label);
 assert(typeof map.finishId==='string'&&nodes[map.finishId],'Missing finish node '+label);
 assert(nodes.n0?.type==='start'&&nodes[map.finishId]?.type==='finish',
  'Start/finish tile types are invalid: '+label);
 const prev=new Map(),next=new Map();
 for(const [id,node] of entries){
  assert(slugPattern.test(id.replace(/_/g,'-'))&&node&&node.id===id,
   'Duplicate/mismatched node ID: '+label+'/'+id);
  assert(node.position&&Number.isFinite(node.position.x)&&Number.isFinite(node.position.y),
   'Invalid node position: '+label+'/'+id);
  assert(Array.isArray(node.nextNodes)&&Array.isArray(node.previousNodes),
   'Missing directed edges: '+label+'/'+id);
  for(const [key,target] of [['nextNodes',next],['previousNodes',prev]]){
   const links=node[key];
   assert(new Set(links).size===links.length,'Duplicate directed edge: '+label+'/'+id);
   for(const to of links)assert(typeof to==='string'&&to!==id&&nodes[to],
    'Dangling/self edge: '+label+'/'+id+' > '+to);
   target.set(id,links);
  }
 }
 assert(next.get(map.finishId).length===0,'Finish must have no outgoing edges: '+label);
 for(const [id,targets] of next)for(const dest of targets)
  assert(prev.get(dest).includes(id),'Non-reciprocal directed edge: '+label+'/'+id+' > '+dest);
 for(const [id,sources] of prev)for(const source of sources)
  assert(next.get(source).includes(id),'Non-reciprocal incoming edge: '+label+'/'+source+' > '+id);
 const visited=new Set(),stack=['n0'];
 while(stack.length){
  const id=stack.pop();
  if(visited.has(id))continue;
  visited.add(id);stack.push(...next.get(id));
 }
 assert(visited.has(map.finishId),'Unreachable finish: '+label);
 assert(visited.size===entries.length,'Disconnected board nodes: '+label);
 const canFinish=new Set(),back=[map.finishId];
 while(back.length){
  const id=back.pop();
  if(canFinish.has(id))continue;
  canFinish.add(id);back.push(...prev.get(id));
 }
 assert(canFinish.size===entries.length,'Board branch has no exit to finish: '+label);
 for(const [id,links] of next)if(id!==map.finishId)
  assert(links.length>0,'Dead-end path: '+label+'/'+id);
 return true;
}
function build({write=false,coreHash}={}){
 assert(fs.existsSync(mapsRoot),'Missing BOARD PARTY map directory');
 const hash=coreHash||require('./build-game-catalog.cjs').coreHash();
 assert(/^[a-f0-9]{20}$/.test(hash),'Invalid core fingerprint for board maps');
 const dirs=fs.readdirSync(mapsRoot,{withFileTypes:true})
  .filter(item=>item.isDirectory()).map(item=>item.name).sort();
 assert(dirs.length>0,'No BOARD PARTY maps found');
 const seen=new Set(),maps=[];
 for(const slug of dirs){
  assert(slugPattern.test(slug),'Invalid board map directory: '+slug);
  const folder=path.join(mapsRoot,slug),local=list(folder);
  assert(local.includes('manifest.json'),'Missing BOARD map manifest: '+slug);
  const info=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
  assert(info&&info.id===slug&&!seen.has(info.id),'Invalid/duplicate board map ID: '+slug);
  seen.add(info.id);
  assert(typeof info.name==='string'&&info.name.trim()&&info.name.length<=80,'Invalid board map name: '+slug);
  assert(info.apiVersion===1&&typeof info.enabled==='boolean',
   'Invalid board map API: '+slug);
  assert(info.players&&Number.isInteger(info.players.min)&&Number.isInteger(info.players.max)&&
   info.players.min===1&&info.players.max===12,'BOARD map must cover 1–12 players: '+slug);
  assert(['legacy','module'].includes(info.kind),'Invalid board map kind: '+slug);
  assert((info.kind==='legacy')===(slug==='winter-expedition'),
   'Only the existing winter-expedition map may use the legacy adapter');
  let entry=null;
  if(info.kind==='module'){
   entry=safeFile(info.entry,local,'map module entry');
   assert(entry.endsWith('.js'),'BOARD map module must be JavaScript: '+slug);
   assert(info.graphs&&typeof info.graphs==='object'&&!Array.isArray(info.graphs),
    'BOARD map must declare small and large graphs: '+slug);
   for(const tier of ['small','large']){
    const graphFile=safeFile(info.graphs[tier],local,tier+' graph');
    assert(graphFile.endsWith('.json'),'BOARD map graph must be JSON');
    validateGraph(JSON.parse(fs.readFileSync(path.join(folder,graphFile),'utf8')),slug+'/'+tier);
   }
  }
  const checksum=crypto.createHash('sha256');
  for(const relative of local){
   checksum.update(relative+'\0');
   checksum.update(fs.readFileSync(path.join(folder,relative)));
  }
  const fingerprint=checksum.digest('hex').slice(0,24);
  const prefix='board-map-assets/'+slug+'/'+fingerprint+'/';
  if(write&&info.kind==='module'){
   for(const relative of local){
    const dest=path.join(root,prefix,relative);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(folder,relative),dest);
   }
  }
  maps.push({id:info.id,name:info.name,apiVersion:1,
   enabled:info.enabled,kind:info.kind,players:info.players,hash:fingerprint,
   entryUrl:entry?'/'+prefix+entry:null});
 }
 const catalog={schema:1,coreHash:hash,maps};
 if(write)fs.writeFileSync(path.join(root,'board-map-catalog.json'),
  JSON.stringify(catalog,null,2)+'\n');
 return catalog;
}
if(require.main===module){
 const command=process.argv[2];
 assert(!command||['--check','--write'].includes(command),
  'Usage: node scripts/build-board-map-catalog.cjs [--check|--write]');
 const catalog=build({write:command==='--write'});
 process.stdout.write('BOARD map catalog validated: '+catalog.maps.length+' maps\n');
}
module.exports={build,validateGraph};
