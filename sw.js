/* Cache only content-addressed game assets and mutable catalogs.
 * Old immutable hashes are collected only after every open tab confirms it has
 * no active Host/Controller session. Unknown or older tabs pin assets safely. */
'use strict';
const scopePath=new URL(self.registration.scope).pathname;
const base=scopePath.endsWith('/')?scopePath:scopePath+'/';
// CacheStorage is shared by all registrations on an origin; isolate by scope.
const scopeKey=encodeURIComponent(base);
const GAME_CACHE='gf-immutable-games-v1:'+scopeKey;
const CATALOG_CACHE='gf-catalog-v1:'+scopeKey;
const BOARD_CACHE='gf-immutable-board-maps-v1:'+scopeKey;
let cleanupPending=null;
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 await self.clients.claim();
 await cleanupImmutableAssets();
})()));
async function gameAsset(request){
 const cache=await caches.open(GAME_CACHE);
 const hit=await cache.match(request);
 if(hit)return hit;
 const res=await fetch(request);
 if(res.ok)try{await cache.put(request,res.clone());}catch(_){/* optional cache */ }
 return res;
}
async function boardAsset(request){
 const cache=await caches.open(BOARD_CACHE);
 const hit=await cache.match(request);
 if(hit)return hit;
 const res=await fetch(request);
 if(res.ok)try{await cache.put(request,res.clone());}catch(_){/* optional cache */ }
 return res;
}
async function cachedCatalog(name){
 const cache=await caches.open(CATALOG_CACHE);
 const key=new Request(new URL(name,self.registration.scope));
 const response=await cache.match(key);
 if(!response)return null;
 try{return await response.clone().json();}catch(_){return null;}
}
function addAssetPrefix(prefixes,value,kind){
 if(typeof value!=='string'||!value)return;
 try{
  const url=new URL(value,self.registration.scope);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(base))return;
  const relative=url.pathname.slice(base.length);
  const match=kind==='game'?
   relative.match(/^game-assets\/[a-z][a-z0-9_]*\/[a-f0-9]{24}\//):
   kind==='map'?
   relative.match(/^board-map-assets\/[a-z][a-z0-9-]*\/[a-f0-9]{24}\//):
   relative.match(/^board-system-assets\/(?:items|spaces|events)\/[a-z][a-z0-9-]*\/[a-f0-9]{24}\//);
  if(match)prefixes.add(match[0]);
 }catch(_){}
}
function manifestPrefixes(gameData,mapData,systemData){
 const games=new Set(),boards=new Set();
 for(const item of gameData.games){
  addAssetPrefix(games,item.entryUrl,'game');
  addAssetPrefix(games,item.coverUrl,'game');
  for(const url of Array.isArray(item.legacyUrls)?item.legacyUrls:[])
   addAssetPrefix(games,url,'game');
 }
 for(const item of mapData.maps){
  addAssetPrefix(boards,item.entryUrl,'map');
  for(const url of Array.isArray(item.legacyUrls)?item.legacyUrls:[])
   addAssetPrefix(boards,url,'map');
 }
 for(const item of systemData.systems)
  addAssetPrefix(boards,item.entryUrl,'system');
 return {games,boards};
}
// Every controlled tab must answer. A timeout, unsupported message handler or
// malformed reply is treated as ACTIVE, never as permission to evict.
async function allScopedClientsIdle(){
 let clients;
 try{clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});}
 catch(_){return false;}
 clients=clients.filter(client=>{
  try{return new URL(client.url).origin===self.location.origin&&
   new URL(client.url).pathname.startsWith(base);}
  catch(_){return false;}
 });
 if(!clients.length)return true;
 const reports=await Promise.all(clients.map(client=>new Promise(resolve=>{
  let finished=false;
  const finish=idle=>{
   if(finished)return;
   finished=true;
   clearTimeout(timer);
   try{channel.port1.close();}catch(_){}
   resolve(idle===true);
  };
  let channel,timer;
  try{
   channel=new MessageChannel();
   timer=setTimeout(()=>finish(false),900);
   channel.port1.onmessage=event=>finish(event.data?.active===false);
   channel.port1.start?.();
   client.postMessage({type:'gf-query-session'},[channel.port2]);
  }catch(_){finish(false);}
 })));
 return reports.every(Boolean);
}
async function pruneCache(cacheName,prefixes,kind){
 const cache=await caches.open(cacheName);
 const keys=await cache.keys();
 let removed=0;
 for(const request of keys){
  let relative='';
  try{
   const url=new URL(request.url);
   if(url.origin!==self.location.origin||!url.pathname.startsWith(base))continue;
   relative=url.pathname.slice(base.length);
  }catch(_){continue;}
  const owned=kind==='game'?relative.startsWith('game-assets/'):
   relative.startsWith('board-map-assets/')||relative.startsWith('board-system-assets/');
  if(owned&&![...prefixes].some(prefix=>relative.startsWith(prefix))){
   if(await cache.delete(request))removed++;
  }
 }
 return removed;
}
async function cleanupImmutableAssets(){
 if(cleanupPending)return cleanupPending;
 cleanupPending=(async()=>{
  if(!await allScopedClientsIdle())return false;
  // Do not prune from a partial catalog set: maps/systems may not have been
  // requested yet in a freshly installed build or during offline recovery.
  const [gameData,mapData,systemData]=await Promise.all([
   cachedCatalog('game-catalog.json'),
   cachedCatalog('board-map-catalog.json'),
   cachedCatalog('board-system-catalog.json')
  ]);
  if(!gameData||!Array.isArray(gameData.games)||
     !mapData||!Array.isArray(mapData.maps)||
     !systemData||!Array.isArray(systemData.systems))return false;
  const keep=manifestPrefixes(gameData,mapData,systemData);
  await Promise.all([
   pruneCache(GAME_CACHE,keep.games,'game'),
   pruneCache(BOARD_CACHE,keep.boards,'board')
  ]);
  return true;
 })().finally(()=>{cleanupPending=null;});
 return cleanupPending;
}
async function catalog(request,name='game-catalog.json'){
 const cache=await caches.open(CATALOG_CACHE);
 const key=new Request(new URL(name,self.registration.scope));
 try{
  const res=await fetch(request);
  if(res.ok){
   try{await cache.put(key,res.clone());}catch(_){/* cache is optional */}
   // Cleanup checks every scoped tab before touching any pinned asset.
   await cleanupImmutableAssets();
  }
  return res;
 }catch(error){
  const hit=await cache.match(key);
  if(hit)return hit;
  throw error;
 }
}
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin)return;
 if(!url.pathname.startsWith(base))return;
 const rel=url.pathname.slice(base.length);
 if(rel==='game-catalog.json'||rel==='board-map-catalog.json'||rel==='board-system-catalog.json')
  e.respondWith(catalog(e.request,rel));
 else if(/^game-assets\/[a-z][a-z0-9_]*\/[a-f0-9]{24}\//.test(rel))
  e.respondWith(gameAsset(e.request));
 else if(/^(?:board-map-assets\/[a-z][a-z0-9-]*|board-system-assets\/(?:items|spaces|events)\/[a-z][a-z0-9-]*)\/[a-f0-9]{24}\//.test(rel))
  e.respondWith(boardAsset(e.request));
});
