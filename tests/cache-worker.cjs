'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const URLClass=URL;
const handlers=new Map(),cacheContents=new Map(),counts=new Map();
let offline=false;
class FakeResponse{
 constructor(body){this.body=body;this.ok=true;this.status=200;}
 clone(){return new FakeResponse(this.body);}
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
const self={
 location:{origin:'https://game.example'},
 registration:{scope:'https://game.example/'},
 clients:{async claim(){}},
 async skipWaiting(){},
 addEventListener(type,fn){handlers.set(type,fn);}
};
async function fetchMock(req){
 if(offline)throw Error('offline');
 const url=typeof req==='string'?req:req.url;
 counts.set(url,(counts.get(url)||0)+1);
 return new FakeResponse('fetched '+url);
}
const context={self,caches,Request:FakeRequest,URL:URLClass,fetch:fetchMock};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
async function request(url){
 let answer=null;
 const event={
  request:{method:'GET',url},
  respondWith(promise){answer=Promise.resolve(promise);}
 };
 handlers.get('fetch')(event);
 return answer?await answer:null;
}
(async()=>{
 const base='https://game.example/game-assets/ghost/';
 const first=base+'a'.repeat(24)+'/game.js',next=base+'b'.repeat(24)+'/game.js';
 assert.equal((await request(first)).body,'fetched '+first);
 assert.equal((await request(first)).body,'fetched '+first);
 assert.equal(counts.get(first),1,'immutable game bytes are fetched only once');
 assert.equal((await request(next)).body,'fetched '+next);
 assert.equal(counts.get(next),1,'changed hash triggers a new request');
 assert.equal(await request('https://game.example/app.js'),null,'never cache core JS');
 assert.equal(await request('https://other.example/game-assets/ghost/'+ 'a'.repeat(24) +'/game.js'),null,
  'third party code is not intercepted');
 const url='https://game.example/game-catalog.json?_=1';
 await request(url);
 offline=true;
 const fallback=await request('https://game.example/game-catalog.json?_=2');
 assert.equal(fallback.body,'fetched '+url,'last validated online catalog survives temporary outage');
 assert.equal(counts.get(url),1);
 assert.equal((await request(first)).body,'fetched '+first,'hashed asset stays cached offline');
 console.log('CACHE WORKER PASS: immutable assets, new hashes, origin guard and offline catalog');
})().catch(err=>{console.error(err);process.exitCode=1;});
