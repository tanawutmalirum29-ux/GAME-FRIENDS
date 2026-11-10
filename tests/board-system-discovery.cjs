'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const original=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'board-systems-'));
try{
 const folder=path.join(temp,'src/board-party/plugins/items/bonus');
 fs.mkdirSync(folder,{recursive:true});
 const m={id:'bonus',category:'items',name:'Bonus',apiVersion:1,
 enabled:true,entry:'./index.js'};
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(m));
 fs.writeFileSync(path.join(folder,'index.js'),"export default {id:'bonus',category:'items',begin(){return false}};\n");
 const env={...process.env,GAME_BUILD_ROOT:temp};
 const build=()=>cp.execFileSync(process.execPath,['scripts/build-board-system-catalog.cjs','--write'],{cwd:original,env,encoding:'utf8'});
 assert.match(build(),/1 plug-ins/);
 const first=JSON.parse(fs.readFileSync(path.join(temp,'board-system-catalog.json')));
 assert.equal(first.systems[0].id,'bonus');
 assert.match(first.systems[0].entryUrl,/^\/board-system-assets\/items\/bonus\/[a-f0-9]{24}\/index\.js$/);
 assert.ok(fs.existsSync(path.join(temp,first.systems[0].entryUrl.slice(1))));
 fs.appendFileSync(path.join(folder,'index.js'),'// changed\n');
 build();const second=JSON.parse(fs.readFileSync(path.join(temp,'board-system-catalog.json')));
 assert.notEqual(first.systems[0].hash,second.systems[0].hash);
 m.entry='../escape.js';fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(m));
 assert.throws(build,/missing\/unsafe entry/);
 m.entry='./index.js';m.id='potion';fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(m));
 assert.throws(build,/invalid manifest/);
 console.log('BOARD SYSTEM DISCOVERY PASS: folder only, content-addressed assets, validation and unsafe path rejection');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
