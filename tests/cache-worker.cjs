'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {MessageChannel}=require('node:worker_threads');
const ORIGIN='https://game.example';
const cacheContents=new Map(); // Shared origin-wide CacheStorage across SW registrations.
class FakeResponse{
 constructor(body,ok=true){this.body=body;this.ok=ok;this.status=ok?200:503;}
 clone(){return new FakeResponse(this.body,this.ok);}
 json(){return JSON.parse(this.body);}
}
class FakeRequest{
 constructor(url){this.url=String(url);this.method='GET';}
}
const caches={
 async open(name){
  if(!cacheContents.has(name))cacheContents.set(name,new Map());
  const map=cacheContents.get(name),key=req=>typeof req==='string'?req:req.url;
  return {
   async match(req){return map.get(key(req))||null;},
   async put(req,res){map.set(key(req),res);},
   async keys(){return [...map.keys()].map(url=>new FakeRequest(url));},
   async delete(req){return map.delete(key(req));}
  };
 }
};
const swSource=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
function worker(scope,initialActivity=null,{respondToSession=true}={}){
 const handlers=new Map(),counts=new Map(),catalogPayloads=new Map();
 const backgroundTasks=[];
 let offline=false,waitUntilCount=0;
 const testClient=initialActivity===null?null:{
  url:ORIGIN+scope+'index.html',active:initialActivity,
  postMessage(message,ports){
   if(message?.type==='gf-query-session'&&respondToSession)
    ports?.[0]?.postMessage({active:this.active});
  }
 };
 const self={
  location:{origin:ORIGIN},registration:{scope:ORIGIN+scope},
  clients:{async claim(){},async matchAll(){return testClient?[testClient]:[];}},async skipWaiting(){},
  addEventListener(type,fn){handlers.set(type,fn);}
 };
 async function fetchMock(req){
  if(offline)throw Error('offline');
  const url=typeof req==='string'?req:req.url;
  counts.set(url,(counts.get(url)||0)+1);
  const pathname=new URL(url).pathname;
  const catalogName=['game-catalog.json','board-map-catalog.json','board-system-catalog.json']
   .find(name=>pathname.endsWith('/'+name));
  if(catalogName&&catalogPayloads.has(catalogName))
   return new FakeResponse(JSON.stringify(catalogPayloads.get(catalogName)));
  return new FakeResponse('fetched '+url+' #'+counts.get(url));
 }
 vm.runInNewContext(swSource,{self,caches,Request:FakeRequest,URL,MessageChannel,
  fetch:fetchMock,setTimeout,clearTimeout},
  {filename:'sw.js'});
 async function request(url,method='GET'){
  let answer=null;
  const event={request:{method,url},
   waitUntil(promise){waitUntilCount++;backgroundTasks.push(Promise.resolve(promise));},
   respondWith(promise){answer=Promise.resolve(promise);}};
  handlers.get('fetch')(event);
  return answer?await answer:null;
 }
 return {request,counts,setOffline(value){offline=value;},
  setCatalog(name,payload){catalogPayloads.set(name,payload);},
  setClientActive(value){if(testClient)testClient.active=value;},
  waitUntilCount(){return waitUntilCount;},
  async waitForBackground(){await Promise.all(backgroundTasks);}};
}
const asset=(prefix,hash)=>ORIGIN+prefix+'game-assets/ghost/'+hash.repeat(24)+'/game.js';
async function suite(scope){
 const sw=worker(scope),a=asset(scope,'a'),b=asset(scope,'b'),unhashed=ORIGIN+scope+'game-assets/ghost/game.js';
 assert.equal((await sw.request(a)).body,'fetched '+a+' #1');
 assert.equal((await sw.request(a)).body,'fetched '+a+' #1','hashed asset hits immutable cache');
 assert.equal(sw.counts.get(a),1);
 assert.equal((await sw.request(b)).body,'fetched '+b+' #1','changed hash is independently fetched');
 assert.equal(sw.counts.get(b),1);
 assert.equal(await sw.request(unhashed),null,'unversioned assets must not be cached');
 assert.equal(await sw.request(ORIGIN+scope+'app.js'),null,'core assets must not be intercepted');
 assert.equal(await sw.request(ORIGIN+scope+'index.html'),null,'HTML must not be intercepted');
 assert.equal(await sw.request(a,'POST'),null,'non-GET must not be intercepted');
 assert.equal(await sw.request('https://other.example'+scope+'game-assets/ghost/'+ 'a'.repeat(24) +'/game.js'),null,
  'cross-origin requests must never be intercepted');
 const sysAsset=ORIGIN+scope+'board-system-assets/items/bonus/'+'c'.repeat(24)+'/index.js';
 assert.equal((await sw.request(sysAsset)).body,'fetched '+sysAsset+' #1');
 assert.equal((await sw.request(sysAsset)).body,'fetched '+sysAsset+' #1');
 const firstCatalog=ORIGIN+scope+'game-catalog.json?_=1';
 const newestCatalog=ORIGIN+scope+'game-catalog.json?_=2';
 assert.equal((await sw.request(firstCatalog)).body,'fetched '+firstCatalog+' #1');
 assert.equal((await sw.request(newestCatalog)).body,'fetched '+newestCatalog+' #1',
  'network-first catalog replaces previous version');
 const sysCatalog=ORIGIN+scope+'board-system-catalog.json?_=1';
 assert.equal((await sw.request(sysCatalog)).body,'fetched '+sysCatalog+' #1');
 // A long-running party can reference assets from far more than 120 updates.
 // The SW must never delete a still-pinned immutable asset on a new download.
 for(let i=0;i<132;i++){
  const hash=i.toString(16).padStart(24,'0');
  await sw.request(ORIGIN+scope+'game-assets/ghost/'+hash+'/game.js');
 }
 sw.setOffline(true);
 assert.equal((await sw.request(ORIGIN+scope+'game-catalog.json?_=3')).body,
  'fetched '+newestCatalog+' #1','offline catalog uses latest successful response');
 assert.equal((await sw.request(a)).body,'fetched '+a+' #1','offline v1 asset remains usable');
 assert.equal((await sw.request(b)).body,'fetched '+b+' #1','offline v2 asset stays pinned beyond 120 new assets');
 assert.equal((await sw.request(sysAsset)).body,'fetched '+sysAsset+' #1','BOARD systems must work offline after caching');
 assert.equal((await sw.request(ORIGIN+scope+'board-system-catalog.json?_=2')).body,'fetched '+sysCatalog+' #1');
 assert.equal((await sw.request(b)).body,'fetched '+b+' #1','offline updated asset remains usable');
 await assert.rejects(sw.request(asset(scope,'c')),/offline/,'uncached version cannot be invented offline');
 return sw;
}
(async()=>{
 const root=await suite('/');
 const sub=await suite('/GAME-FRIENDS/');
 // With separate registrations on the same origin, neither cache may leak.
 const gameCaches=[...cacheContents.keys()].filter(k=>k.startsWith('gf-immutable-games-v1:'));
 const catalogCaches=[...cacheContents.keys()].filter(k=>k.startsWith('gf-catalog-v1:'));
 assert.equal(gameCaches.length,2,'root and subpath have separate immutable caches');
 assert.equal(catalogCaches.length,2,'root and subpath have separate catalog caches');
 const rootGame=cacheContents.get('gf-immutable-games-v1:%2F');
 const subGame=cacheContents.get('gf-immutable-games-v1:%2FGAME-FRIENDS%2F');
 assert.ok(rootGame?.has(asset('/','a')));
 assert.ok(!rootGame?.has(asset('/GAME-FRIENDS/','a')));
 assert.ok(subGame?.has(asset('/GAME-FRIENDS/','a')));
 assert.ok(!subGame?.has(asset('/','a')));
 assert.equal(await sub.request(ORIGIN+'/game-assets/ghost/'+ 'a'.repeat(24) +'/game.js'),null,
  'subpath SW cannot intercept parent scope');
 assert.equal(await sub.request(ORIGIN+'/GAME-FRIENDS-other/game-catalog.json'),null,
  'path-prefix lookalikes cannot be intercepted');
 assert.equal(await root.request('https://outside.example/game-catalog.json'),null);
 // Offline subpath catalog must not return the root-scope catalog.
 const unprimed=worker('/fresh/');unprimed.setOffline(true);
 await assert.rejects(unprimed.request(ORIGIN+'/fresh/game-catalog.json'),/offline/,
  'a fresh scope must not read another scope\'s catalog');
 // An unresponsive tab consumes the full 900 ms safety timeout, but catalog
 // responses must return immediately while cleanup remains attached to the event.
 const delayed=worker('/slow-client/',true,{respondToSession:false});
 for(const poll of [1,2]){
  const started=Date.now();
  const response=await delayed.request(ORIGIN+'/slow-client/game-catalog.json?poll='+poll);
  const elapsed=Date.now()-started;
  assert.ok(response?.ok,'network catalog remains available with an unresponsive tab');
  assert.ok(elapsed<500,'catalog response must not wait for tab timeout (elapsed '+elapsed+' ms)');
 }
 assert.equal(delayed.waitUntilCount(),2,'each catalog fetch extends worker lifetime for best-effort cleanup');
 await delayed.waitForBackground();

 // Verify stale hashes are evicted only when all same-scope tabs report idle.
 async function cleanupCase(scope,active){
  const sw=worker(scope,active);
  const gameOld='a'.repeat(24),gameCurrent='b'.repeat(24);
  const mapOld='c'.repeat(24),mapCurrent='d'.repeat(24);
  const systemOld='e'.repeat(24),systemCurrent='f'.repeat(24);
  const gameUrl=h=>ORIGIN+scope+'game-assets/ghost/'+h+'/entry.js';
  const mapUrl=h=>ORIGIN+scope+'board-map-assets/winter-expedition/'+h+'/entry.js';
  const systemUrl=h=>ORIGIN+scope+'board-system-assets/items/bonus/'+h+'/entry.js';
  for(const url of [gameUrl(gameOld),gameUrl(gameCurrent),mapUrl(mapOld),mapUrl(mapCurrent),
   systemUrl(systemOld),systemUrl(systemCurrent)])await sw.request(url);
  // Catalog URLs follow their registration scope for this isolated cleanup fixture.
  sw.setCatalog('game-catalog.json',{schema:1,games:[
   {enabled:true,entryUrl:scope+'game-assets/ghost/'+gameCurrent+'/entry.js',legacyUrls:[],coverUrl:null}
  ]});
  sw.setCatalog('board-map-catalog.json',{schema:1,maps:[
   {enabled:true,entryUrl:scope+'board-map-assets/winter-expedition/'+mapCurrent+'/entry.js',legacyUrls:[]}
  ]});
  sw.setCatalog('board-system-catalog.json',{schema:1,systems:[
   {enabled:true,entryUrl:scope+'board-system-assets/items/bonus/'+systemCurrent+'/entry.js'}
  ]});
  for(const name of ['game-catalog.json','board-map-catalog.json','board-system-catalog.json'])
   await sw.request(ORIGIN+scope+name);
  // Catalog fetches no longer wait for cleanup. Let the first coalesced task
  // finish, then poll again with the complete manifest set available.
  await sw.waitForBackground();
  await sw.request(ORIGIN+scope+'game-catalog.json?cleanup=all-catalogs');
  await sw.waitForBackground();
  const games=cacheContents.get('gf-immutable-games-v1:'+encodeURIComponent(scope));
  const boards=cacheContents.get('gf-immutable-board-maps-v1:'+encodeURIComponent(scope));
  const oldKeys=[gameUrl(gameOld),mapUrl(mapOld),systemUrl(systemOld)];
  const newKeys=[gameUrl(gameCurrent),mapUrl(mapCurrent),systemUrl(systemCurrent)];
  if(active===false){
   for(const key of oldKeys)assert.ok(!games?.has(key)&&!boards?.has(key),
    'idle tab permits stale hash eviction: '+key);
  }else{
   for(const key of oldKeys)assert.ok(games?.has(key)||boards?.has(key),
    'active/unresponsive tab pins its old hash: '+key);
   sw.setClientActive(false);
   await sw.request(ORIGIN+scope+'game-catalog.json?refresh=idle');
   await sw.waitForBackground();
   for(const key of oldKeys)assert.ok(!games?.has(key)&&!boards?.has(key),
    'stale hash is removed after every tab reports idle: '+key);
  }
  for(const key of newKeys)assert.ok(games?.has(key)||boards?.has(key),
   'hashes in the latest catalogs remain cached: '+key);
 }
 await cleanupCase('/idle/',false);
 await cleanupCase('/active/',true);
 console.log('CACHE WORKER PASS: root/subpath assets, offline, updates, scope isolation and guards');
})().catch(err=>{console.error(err);process.exitCode=1;});
