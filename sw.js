/* Store only version-pinned game files; never cache room state, HTML or core JS. */
'use strict';
const scopePath=new URL(self.registration.scope).pathname;
const base=scopePath.endsWith('/')?scopePath:scopePath+'/';
// CacheStorage is shared by all registrations on an origin; isolate by scope.
const scopeKey=encodeURIComponent(base);
const GAME_CACHE='gf-immutable-games-v1:'+scopeKey;
const CATALOG_CACHE='gf-catalog-v1:'+scopeKey;
const BOARD_CACHE='gf-immutable-board-maps-v1:'+scopeKey;
const MAX=120;
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
async function gameAsset(request){
 const cache=await caches.open(GAME_CACHE);
 const hit=await cache.match(request);
 if(hit)return hit;
 const res=await fetch(request);
 if(res.ok){
  try{
   await cache.put(request,res.clone());
   const entries=await cache.keys();
   for(const key of entries.slice(0,Math.max(0,entries.length-MAX)))await cache.delete(key);
  }catch(_){/* cache is optional when storage is exhausted */}
 }
 return res;
}
async function boardAsset(request){
 const cache=await caches.open(BOARD_CACHE);
 const hit=await cache.match(request);
 if(hit)return hit;
 const res=await fetch(request);
 // Do not evict version-pinned board assets that a live session may need.
 if(res.ok)try{await cache.put(request,res.clone());}catch(_){/* optional cache */}
 return res;
}
async function catalog(request,name='game-catalog.json'){
 const cache=await caches.open(CATALOG_CACHE);
 const key=new Request(new URL(name,self.registration.scope));
 try{
  const res=await fetch(request);
  if(res.ok)try{await cache.put(key,res.clone());}catch(_){}
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
 if(rel==='game-catalog.json'||rel==='board-map-catalog.json')
  e.respondWith(catalog(e.request,rel));
 else if(/^game-assets\/[a-z][a-z0-9_]*\/[a-f0-9]{24}\//.test(rel))
  e.respondWith(gameAsset(e.request));
 else if(/^board-map-assets\/[a-z][a-z0-9-]*\/[a-f0-9]{24}\//.test(rel))
  e.respondWith(boardAsset(e.request));
});
