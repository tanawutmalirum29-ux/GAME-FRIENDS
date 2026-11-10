/* BOARD map metadata, lazy activation and safe same-core hot refresh. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/platform/board-runtime.js'),'utf8');
const hash=value=>value.repeat(24);
const core='f'.repeat(20);
const descriptor=(id,h,kind)=>({id,name:id.toUpperCase(),apiVersion:1,
 enabled:true,kind,players:{min:1,max:12},hash:hash(h),
 entryUrl:kind==='legacy'?null:'/board-map-assets/'+id+'/'+hash(h)+'/index.js'});
const legacyMap={MAP_ID:'winter-expedition',create(){return{};},
 validate(){return true;},assertCompatible(){return true;},
 choose(){return null;},neighbors(){return [];}};
const legacyArt={draw(){}};
const plugin=(mapId)=>({
 map:{MAP_ID:mapId,
  create(_seed,{players}={}){assert.ok([1,6,7,12].includes(players));
   return {id:mapId,startId:'n0',finishId:'n1',width:1000,height:600,
    nodes:{n0:{id:'n0'},n1:{id:'n1'}}};},
  validate(){return true;},assertCompatible(){return true;},
  choose(){return null;},neighbors(){return []}},
 art:{draw(){}}
});
const btn={dataset:{sessionMode:'board'},classList:{contains(name){return name==='active';}},
 addEventListener(){}};
const options=[];
let selector=null;
const mode={append(el){selector=el;},
 querySelectorAll(){return [btn];}};
const document={readyState:'complete',baseURI:'https://example.test/index.html',
 hidden:false,
 getElementById(id){return id==='sessionMode'?mode:id==='boardMapSelector'?selector:null;},
 querySelector(){return btn;},
 createElement(type){
  assert.ok(['select','option'].includes(type),'Only metadata dropdown may be created');
  return type==='select'?{
   value:'',style:{},disabled:false,options,
   setAttribute(){},replaceChildren(){options.splice(0);this.value='';},
   append(opt){options.push(opt);if(!this.value)this.value=opt.value;}
  }:{value:'',textContent:''};
 }};
const window={GAME_CORE_HASH:core,BoardMap:legacyMap,BoardArt:legacyArt,
 BoardDice:{},BoardItems:{},BoardBots:{},BoardMinigame:{},BoardParty:{}};
let catalog={schema:1,coreHash:core,maps:[
 descriptor('winter-expedition','a','legacy'),
 descriptor('coast','b','module')]};
let requested=0,imported=0,missing=false;
const context={window,document,URL,Date,console,location:{origin:'https://example.test'},
 setInterval(){},
 async fetch(url){requested++;return {ok:true,async json(){return String(url).includes('board-system-catalog')?{schema:1,coreHash:core,systems:[]}:catalog;}};}};
window.__testImport=async url=>{
 imported++;
 assert.ok(url.startsWith('https://example.test/board-map-assets/coast/'));
 return {default:missing?{map:{},art:{}}:plugin('coast')};
};
// The sole network import call is swapped with an injected module resolver for
// this Node VM; production keeps the actual native import() syntax.
assert.ok(source.includes('await import(url.href)'));
vm.runInNewContext(source.replace('await import(url.href)',
 'await window.__testImport(url.href)'),context,{filename:'board-runtime.js'});
const runtime=window.BoardRuntime;
(async()=>{
 assert.equal(runtime.ready(),false,'BOARD needs a validated systems catalog before startup');
 await runtime.ensure();
 assert.equal(runtime.ready(),true,'Existing canonical map remains ready and untouched');
 await runtime.refreshMaps();
 assert.equal(runtime.maps().length,2);
 assert.equal(window.BoardMap,legacyMap,'Catalog refresh must not swap a live map');
 assert.equal(imported,0,'Metadata discovery must not load any map module');
 assert.equal(selector.style.visibility,'visible');
 selector.value='coast';
 assert.equal(runtime.ready(),false);
 await runtime.ensure();
 assert.equal(imported,1,'Only selected map module is fetched');
 assert.equal(runtime.activeMapId,'coast');
 assert.notEqual(window.BoardMap,legacyMap);
 const running=window.BoardMap;
 catalog={...catalog,maps:[catalog.maps[0],descriptor('coast','c','module')]};
 await runtime.refreshMaps();
 assert.equal(window.BoardMap,running,'Active BOARD session may not swap on catalog refresh');
 assert.equal(runtime.ready(),false,'New hash waits until next BOARD session');
 await runtime.ensure();
 assert.equal(imported,2,'Next session downloads newly pinned map');
 assert.notEqual(window.BoardMap,running);
 selector.value='winter-expedition';
 await runtime.ensure();
 assert.equal(window.BoardMap,legacyMap,'Switching back restores canonical map');
 assert.equal(window.BoardArt,legacyArt);
 selector.value='coast';
 catalog={...catalog,maps:[catalog.maps[0],descriptor('coast','d','module')]};
 await runtime.refreshMaps();
 missing=true;
 await assert.rejects(runtime.ensure(),/BOARD map identity missing|Invalid BOARD map module/,
  'Broken downloaded plug-in must fail without mutating previous map');
 assert.equal(window.BoardMap,legacyMap);
 assert.equal(runtime.activeMapId,'winter-expedition');
 assert.ok(requested>=3);
 console.log('BOARD MAP RUNTIME PASS: metadata only, on-demand import, new-session hot pin, legacy fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
