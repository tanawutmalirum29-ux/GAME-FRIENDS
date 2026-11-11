/* Isolated build fixture proves zero-touch map discovery and graph rejection. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gf-board-maps-'));
const basedir=path.join(tmp,'src','board-party','maps');
try{
 fs.mkdirSync(basedir,{recursive:true});
 fs.cpSync(path.join(root,'src','board-party','maps','winter-expedition'),
  path.join(basedir,'winter-expedition'),{recursive:true});
 // Production emits the canonical built-in map and vector artwork as immutable
 // releases. Reproduce those runtime files in the isolated map fixture.
 const legacyFiles=['board-design.js','board-scenery.js','board-map.js','board-art.js'];
 for(const file of legacyFiles){
  const relative=path.join('src','board-party','runtime',file),dest=path.join(tmp,relative);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(root,relative),dest);
 }
 const fixture=path.join(basedir,'future-map');
 fs.mkdirSync(fixture,{recursive:true});
 fs.writeFileSync(path.join(fixture,'manifest.json'),JSON.stringify({
  id:'future-map',name:'FUTURE MAP',apiVersion:1,enabled:true,
  kind:'module',players:{min:1,max:12},entry:'./index.js',
  graphs:{small:'./small.json',large:'./large.json'}
 }));
 fs.writeFileSync(path.join(fixture,'index.js'),
  'export default {map:{create(){return null}},art:{draw(){}}};\n');
 const graph={startId:'n0',finishId:'n2',nodes:{
  n0:{id:'n0',type:'start',position:{x:0,y:0},nextNodes:['n1'],previousNodes:[]},
  n1:{id:'n1',type:'movement',position:{x:50,y:0},nextNodes:['n2'],previousNodes:['n0']},
  n2:{id:'n2',type:'finish',position:{x:100,y:0},nextNodes:[],previousNodes:['n1']}
 }};
 for(const tier of ['small','large'])fs.writeFileSync(path.join(fixture,tier+'.json'),JSON.stringify(graph));
 const env={...process.env,GAME_BUILD_ROOT:tmp};
 const build=()=>{
  const result=execFileSync(process.execPath,['scripts/build-board-map-catalog.cjs','--write'],
   {cwd:root,env,encoding:'utf8'});
  assert.match(result,/2 maps/);
  return JSON.parse(fs.readFileSync(path.join(tmp,'board-map-catalog.json'),'utf8'));
 };
 const first=build();
 assert.equal(first.maps.length,2);
 assert.deepEqual(first.maps.map(m=>m.id),['future-map','winter-expedition']);
 assert.equal(first.maps.find(m=>m.id==='future-map').kind,'module');
 const record=first.maps.find(m=>m.id==='future-map');
 assert.match(record.entryUrl,/^\/board-map-assets\/future-map\/[a-f0-9]{24}\/index\.js$/);
 assert.ok(fs.existsSync(path.join(tmp,record.entryUrl.slice(1))));
 const builtin=first.maps.find(m=>m.id==='winter-expedition');
 assert.equal(builtin.entryUrl,null);
 assert.equal(builtin.legacyUrls.length,4,'built-in board map has four immutable runtime assets');
 for(const url of builtin.legacyUrls)
  assert.ok(fs.existsSync(path.join(tmp,url.slice(1))),'Missing built-in map asset '+url);
 const originalCore=first.coreHash,originalBuiltInHash=builtin.hash;
 const changedSource=path.join(tmp,'src/board-party/runtime/board-map.js');
 fs.appendFileSync(changedSource,'\n// map-only hotfix\n');
 const afterBuiltInEdit=build();
 assert.notEqual(afterBuiltInEdit.maps.find(m=>m.id==='winter-expedition').hash,originalBuiltInHash,
  'Built-in BOARD map source changes must have an independent asset hash');
 assert.equal(afterBuiltInEdit.coreHash,originalCore,
  'Built-in BOARD content cannot invalidate a connected room Core');
 const initialHash=record.hash;
 fs.writeFileSync(path.join(fixture,'extra.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 assert.notEqual(build().maps[0].hash,initialHash,'Changed assets must receive immutable paths');
 graph.nodes.n1.nextNodes=['missing'];
 fs.writeFileSync(path.join(fixture,'large.json'),JSON.stringify(graph));
 assert.throws(build,/Dangling\/self edge/,'A broken branch must fail deployment');
 graph.nodes.n1.nextNodes=['n2'];
 graph.nodes.n2.previousNodes=[];
 fs.writeFileSync(path.join(fixture,'large.json'),JSON.stringify(graph));
 assert.throws(build,/Non-reciprocal directed edge/);
 console.log('BOARD MAP DISCOVERY PASS: immutable built-in art/map, same Core, 2 tiers and directed graph guards');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
