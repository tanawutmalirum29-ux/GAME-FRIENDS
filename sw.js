/* Store only version-pinned game files; never cache room state, HTML or core JS. */
'use strict';
const GAME_CACHE='gf-immutable-games-v1', CATALOG_CACHE='gf-catalog-v1', MAX=120;
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
async function catalog(request){
 const cache=await caches.open(CATALOG_CACHE);
 const key=new Request(new URL('game-catalog.json',self.registration.scope));
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
 const base=new URL(self.registration.scope).pathname;
 if(url.pathname===base+'game-catalog.json')e.respondWith(catalog(e.request));
 else if(url.pathname.startsWith(base+'game-assets/')&&
  /^\/game-assets\/[a-z][a-z0-9_]*\/[a-f0-9]{24}\//.test(url.pathname))
  e.respondWith(gameAsset(e.request));
});
