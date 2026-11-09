/* Host-owned system modules are pinned to one session's BOARD core. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/platform/board-runtime.js','utf8');
const build='f'.repeat(20),hash=n=>n.repeat(24);
const entry=(category,id,h)=>({category,id,hash:hash(h),name:id.toUpperCase(),
 version:'1.0.0',apiVersion:1,enabled:true,
 entryUrl:'/board-system-assets/'+category+'/'+id+'/'+hash(h)+'/index.js'});
let manifest={schema:1,coreHash:build,systems:[
 entry('items','bonus','a'),entry('spaces','treasure','b'),entry('events','meteor','c')]};
let imports=0,registration=[],broken=false,counts=[];
const map={MAP_VERSION:'v10',create(){return{}},validate(){return true},assertCompatible(){return true}};
const art={draw(){}},btn={classList:{contains(){return true}},dataset:{sessionMode:'board'},addEventListener(){}};
const dom={readyState:'complete',baseURI:'https://board.local/index.html',
 hidden:false,getElementById(){return null},querySelector(){return btn;}};
const items={registerPlugins(mods){registration=mods.map(x=>x.id);},...{}};
const w={GAME_CORE_VERSION:build,BoardMap:map,BoardArt:art,BoardDice:{},BoardItems:items,
 BoardBots:{},BoardParty:{},BoardMinigame:{}};
w.__testImport=async url=>{
 imports++;
 const u=new URL(url),match=u.pathname.match(/^\/board-system-assets\/(items|spaces|events)\/([a-z-]+)\/([a-f0-9]{24})\/index.js$/);
 assert.ok(match,'version-pinned same-origin module');
 if(broken&&match[2]==='bonus')throw Error('network fails');
 const [category,id,version]=match.slice(1);
 const impl={category,id,name:id,onLand(){return {handled:true,kind:'bonus'}},
  onUpdate({session}){session.counter=(session.counter||0)+1},
  begin(s,p,api,helpers){helpers.consume(s,p,id);api.effect(s,{kind:'bonus'},.3);return true}};
 counts.push(version);
 return {default:impl};
};
const ctx={window:w,document:dom,URL,location:{origin:'https://board.local'},
 console,Date,setInterval(){},
 fetch:async url=>{
  assert.match(String(url),/board-system-catalog.json/);
  return {ok:true,json:async()=>manifest};
 }};
assert.equal((source.match(/await import\(url.href\)/g)||[]).length,2);
vm.runInNewContext(source.replaceAll('await import(url.href)','await window.__testImport(url.href)'),
 ctx,{filename:'board-runtime.js'});
(async()=>{
 const api=w.BoardRuntime,registry=w.BoardSystemPlugins;
 assert.equal(api.ready(),false,'system catalog must be prepared before BOARD begins');
 assert.equal(imports,0);
 await api.ensure();
 assert.equal(api.ready(),true);
 assert.equal(registration.join(','),'bonus'); // VM array has a different realm prototype
 assert.equal(imports,3);
 assert.equal(registry.list('spaces').length,1);
 assert.equal(registry.list('events').length,1);
 const first=registry.get('items','bonus');
 assert.ok(first);
 const s={counter:0};registry.list('events')[0].onUpdate({session:s});
 assert.equal(s.counter,1);
 manifest={schema:1,coreHash:build,systems:[
  entry('items','bonus','d'),entry('spaces','treasure','b'),entry('events','meteor','c')]};
 await registry.refresh();
 assert.equal(registry.get('items','bonus'),first,'a live session stays on prior item engine');
 assert.equal(api.ready(),false,'next BOARD session must load the new revision');
 await api.ensure();
 assert.notEqual(registry.get('items','bonus'),first);
 assert.equal(imports,4,'unchanged cached systems do not download twice');
 const upgraded=registry.get('items','bonus');
 manifest={...manifest,systems:[entry('items','bonus','e'),...manifest.systems.slice(1)]};
 broken=true;await registry.refresh();
 await api.ensure();
 assert.equal(registry.get('items','bonus'),upgraded,'broken release retains verified module');
 assert.ok(registry.rejected.length>0);
 manifest={...manifest,systems:[entry('items','bonus','f'),...manifest.systems.slice(1)]};
 broken=false;await registry.refresh();
 await api.ensure();
 assert.notEqual(registry.get('items','bonus'),upgraded,'good replacement is adopted on next session');
 console.log('BOARD SYSTEM RUNTIME PASS: catalog, lazy import, session pin, update, fallback and recovery');
})().catch(e=>{console.error(e);process.exitCode=1});
