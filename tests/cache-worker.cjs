'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ORIGIN='https://game.example';
const cacheContents=new Map(); // Shared origin-wide CacheStorage across SW registrations.
class FakeResponse{
 constructor(body,ok=true){this.body=body;this.ok=ok;this.status=ok?200:503;}
 clone(){return new FakeResponse(this.body,this.ok);}
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
function worker(scope){
 const handlers=new Map(),counts=new Map();
 let offline=false;
 const self={
  location:{origin:ORIGIN},registration:{scope:ORIGIN+scope},
  clients:{async claim(){}},async skipWaiting(){},
  addEventListener(type,fn){handlers.set(type,fn);}
 };
 async function fetchMock(req){
  if(offline)throw Error('offline');
  const url=typeof req==='string'?req:req.url;
  counts.set(url,(counts.get(url)||0)+1);
  return new FakeResponse('fetched '+url+' #'+counts.get(url));
 }
 vm.runInNewContext(swSource,{self,caches,Request:FakeRequest,URL,fetch:fetchMock},
  {filename:'sw.js'});
 async function request(url,method='GET'){
  let answer=null;
  const event={request:{method,url},respondWith(promise){answer=Promise.resolve(promise);}};
  handlers.get('fetch')(event);
  return answer?await answer:null;
 }
 return {request,counts,setOffline(value){offline=value;}};
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
 sw.setOffline(true);
 assert.equal((await sw.request(ORIGIN+scope+'game-catalog.json?_=3')).body,
  'fetched '+newestCatalog+' #1','offline catalog uses latest successful response');
 assert.equal((await sw.request(a)).body,'fetched '+a+' #1','offline v1 asset remains usable');
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
 console.log('CACHE WORKER PASS: root/subpath assets, offline, updates, scope isolation and guards');
})().catch(err=>{console.error(err);process.exitCode=1;});
