'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gf-offline-'));
try{
 for(const file of ['index.html','host.html','scripts/build-static.cjs','service-worker.js','offline-cache.js','style.css']){
  const dst=path.join(dir,file);fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(path.join(root,file),dst);
 }
 // Build uses the complete list of static files, so copy the remaining tracked assets.
 const source=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
 const match=source.match(/const assets=\[([\s\S]*?)\];/);
 assert.ok(match,'asset list defined');
 const names=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 names.push('host.webmanifest','assets/game-friends-cover.svg','assets/game-friends-icon.svg','assets/game-friends-touch-icon.png');
 for(const name of new Set(names)){
  const dst=path.join(dir,name);fs.mkdirSync(path.dirname(dst),{recursive:true});
  if(!fs.existsSync(dst))fs.copyFileSync(path.join(root,name),dst);
 }
 const first='a'.repeat(40),second='b'.repeat(40);
 execFileSync(process.execPath,[path.join(dir,'scripts/build-static.cjs')],{env:{...process.env,GAME_BUILD_ROOT:dir,AWS_COMMIT_ID:first}});
 let manifest=JSON.parse(fs.readFileSync(path.join(dir,'offline-assets.json'),'utf8'));
 assert.equal(manifest.version,first);
 assert.ok(manifest.files.some(x=>x.path==='index.html'));
 assert.ok(manifest.files.some(x=>x.path==='offline-cache.js'));
 assert.ok(!manifest.files.some(x=>x.path==='version.json'));
 const before=Object.fromEntries(manifest.files.map(x=>[x.path,x.hash]));
 assert.ok(fs.readFileSync(path.join(dir,'service-worker.js'),'utf8').includes(first));
 execFileSync(process.execPath,[path.join(dir,'scripts/build-static.cjs')],{env:{...process.env,GAME_BUILD_ROOT:dir,AWS_COMMIT_ID:second}});
 manifest=JSON.parse(fs.readFileSync(path.join(dir,'offline-assets.json'),'utf8'));
 const after=Object.fromEntries(manifest.files.map(x=>[x.path,x.hash]));
 assert.equal(before['style.css'],after['style.css'],'unchanged assets must retain hash');
 assert.notEqual(before['index.html'],after['index.html'],'versioned HTML changes');
 assert.ok(fs.readFileSync(path.join(dir,'service-worker.js'),'utf8').includes(second));
 console.log('OFFLINE CACHE PASS: hashes, deployment version, reusable assets');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
