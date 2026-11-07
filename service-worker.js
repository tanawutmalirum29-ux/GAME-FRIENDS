/* GAME FRIENDS offline-first static assets; generated BUILD_ID is replaced at deploy. */
'use strict';
const BUILD_ID='__GAME_BUILD_ID__';
const PREFIX='gf-offline-v3-';
const CACHE_NAME=PREFIX+BUILD_ID;
const ASSET_KEY='gf_asset';
let assets=null;
const scope=self.registration.scope;
function absolute(path){return new URL(path,scope).href;}
function keyFor(file){const u=new URL(file.path,scope);u.searchParams.set(ASSET_KEY,file.hash);return u.href;}
async function loadManifest(){
  if(assets)return assets;
  const response=await fetch(absolute('offline-assets.json')+'?v='+encodeURIComponent(BUILD_ID),{cache:'no-store'});
  if(!response.ok)throw new Error('Offline manifest unavailable');
  const manifest=await response.json();
  if(manifest.version!==BUILD_ID||!Array.isArray(manifest.files))throw new Error('Offline version mismatch');
  assets=new Map(manifest.files.map(file=>[new URL(file.path,scope).pathname,file]));
  return assets;
}
async function installedAsset(file){
  const key=keyFor(file);
  const existing=await caches.match(key);
  if(existing)return existing;
  const response=await fetch(absolute(file.path)+'?v='+encodeURIComponent(BUILD_ID),{cache:'no-store'});
  if(!response.ok)throw new Error('Cannot cache '+file.path);
  return response;
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const files=[...(await loadManifest()).values()];
    const cache=await caches.open(CACHE_NAME);
    // Bound concurrency so the initial install does not overwhelm slow mobile networks.
    let index=0;
    await Promise.all(Array.from({length:Math.min(4,files.length)},async()=>{
      while(index<files.length){
        const file=files[index++];
        await cache.put(keyFor(file),await installedAsset(file));
      }
    }));
    // First install takes control; updates remain waiting until the application is idle.
    if(!self.registration.active)await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(name=>name.startsWith(PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='GF_ACTIVATE_WHEN_SAFE')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL(scope).pathname))return;
  // A newly deployed HTML page must not receive stale JavaScript from the older active worker.
  if(url.searchParams.has('v')&&url.searchParams.get('v')!==BUILD_ID)return;
  if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('/offline-assets.json')||url.pathname.endsWith('/service-worker.js'))return;
  event.respondWith((async()=>{
    let manifest;
    try{manifest=await loadManifest();}catch(_){return fetch(request);}
    const file=manifest.get(url.pathname);
    if(file){
      const cache=await caches.open(CACHE_NAME);
      const key=keyFor(file);
      const hit=await cache.match(key);
      if(hit)return hit;
      const response=await fetch(request);
      if(response.ok)await cache.put(key,response.clone());
      return response;
    }
    // Do not cache arbitrary join URLs or peer networking requests.
    if(request.mode==='navigate'){
      try{return await fetch(request);}
      catch(error){
        const fallback=manifest.get(new URL('index.html',scope).pathname);
        const hit=fallback&&await caches.match(keyFor(fallback));
        if(hit)return hit;
        throw error;
      }
    }
    return fetch(request);
  })());
});
