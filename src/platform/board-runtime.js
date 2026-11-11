/* BOARD PARTY core and folder-discovered map loader.
 * Map code is activated only immediately before starting a NEW BOARD session. */
(()=>{
'use strict';
const DEFAULT='winter-expedition';
const LEGACY_ASSETS=['board-design.js','board-scenery.js','board-map.js','board-art.js'];
const INITIAL_LEGACY_HASH=String(window.GAME_DEFAULT_BOARD_MAP_HASH||'');
const files=["src/board-party/runtime/board-map.js","src/board-party/runtime/board-design.js","src/board-party/runtime/board-scenery.js",
 "src/board-party/runtime/board-branch-naming.js","src/board-party/runtime/board-layout.js","src/board-party/runtime/board-dice.js","src/board-party/runtime/board-dice-renderer.js",
 "src/board-party/runtime/board-items.js","src/board-party/runtime/board-bots.js","src/board-party/runtime/board-minigame.js","src/board-party/runtime/board-party.js","src/board-party/runtime/board-art.js"];
const required=['BoardMap','BoardDice','BoardItems','BoardBots','BoardMinigame','BoardParty','BoardArt'];
const loaded=new Set(),modules=new Map();
let pending=null,refreshing=null,legacy=null,active=DEFAULT,activeHash=INITIAL_LEGACY_HASH||null;
let legacyHash=INITIAL_LEGACY_HASH||null,defaultCatalogChecked=!INITIAL_LEGACY_HASH;
let catalog=[{id:DEFAULT,name:'WINTER EXPEDITION',kind:'legacy',enabled:true}],revision=0,selector=null;
let deferredMaps=null,applyingLobby=null;
// A live BOARD session pins BoardMap/BoardArt and the selected-map menu.
function playingBoard(){
 return document.body?.classList?.contains('board-playing')===true;
}
function applyMapCatalog(next){
 if(JSON.stringify(next)===JSON.stringify(catalog)){render();return false;}
 catalog=next;revision++;render();return true;
}
function applyPendingMaps(){
 if(playingBoard()||!deferredMaps)return false;
 const next=deferredMaps;deferredMaps=null;
 return applyMapCatalog(next);
}
const globalsReady=()=>required.every(id=>!!window[id]);
function captureDefault(){
 if(!legacy&&globalsReady())
  legacy={map:window.BoardMap,art:window.BoardArt};
}
captureDefault();
const chosen=()=>selector?.value||DEFAULT;
function ready(){
 if(!globalsReady()||chosen()!==active||!systemPrepared)return false;
 if(active===DEFAULT){
  if(!defaultCatalogChecked)return false;
  const meta=catalog.find(m=>m.id===DEFAULT&&m.enabled);
  return !meta?.hash||meta.hash===legacyHash;
 }
 return catalog.some(m=>m.id===active&&m.enabled&&m.hash===activeHash);
}
function inject(file){
 return new Promise((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.async=false;
  const url=new URL('./'+file,document.baseURI);
  tag.src=url.href;
  tag.onload=()=>{loaded.add(file);resolve();};
  tag.onerror=()=>{tag.remove();reject(Error('BOARD PARTY asset unavailable: '+file));};
  document.head.append(tag);
 });
}
function inspect(data){
 if(!data||data.schema!==1||!/^[a-f0-9]{20}$/.test(data.coreHash)||
    !Array.isArray(data.maps)||!data.maps.length)throw Error('Invalid BOARD map catalog');
 const seen=new Set();
 return data.maps.map(m=>{
  if(!m||! /^[a-z][a-z0-9-]*$/.test(m.id)||seen.has(m.id)||
    typeof m.name!=='string'||typeof m.enabled!=='boolean'||
    m.apiVersion!==1||
    !/^[a-f0-9]{24}$/.test(m.hash)||!['legacy','module'].includes(m.kind)||
    m.players?.min!==1||m.players?.max!==12)throw Error('Invalid BOARD map descriptor');
  seen.add(m.id);
  if(m.kind==='legacy'){
   const prefix='/board-map-assets/'+DEFAULT+'/'+m.hash+'/runtime/';
   if(m.id!==DEFAULT||m.entryUrl!==null||
      !Array.isArray(m.legacyUrls)||m.legacyUrls.length!==LEGACY_ASSETS.length||
      m.legacyUrls.some((url,i)=>url!==prefix+LEGACY_ASSETS[i]))
    throw Error('Invalid immutable default BOARD assets');
  }else if(typeof m.entryUrl!=='string'||
    !m.entryUrl.startsWith('/board-map-assets/'+m.id+'/'+m.hash+'/')||
    !/\.js$/.test(m.entryUrl))throw Error('Invalid BOARD map URL');
  return Object.freeze({...m});
 });
}
function render(){
 if(!selector)return;
 const wanted=selector.value||DEFAULT;
 const choices=catalog.filter(m=>m.enabled);
 selector.replaceChildren();
 for(const m of choices){
  const option=document.createElement('option');
  option.value=m.id;option.textContent=m.name;selector.append(option);
 }
 selector.value=choices.some(m=>m.id===wanted)?wanted:DEFAULT;
 selector.disabled=choices.length<2;
 selector.style.visibility=choices.length>1&&
  document.querySelector('[data-session-mode="board"]')?.classList.contains('active')?
   'visible':'hidden';
}
async function refreshMaps(){
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  const url=new URL('./board-map-catalog.json',document.baseURI);
  url.searchParams.set('_',String(Date.now()));
  const res=await fetch(url.href,{cache:'no-store'});
  if(!res.ok)throw Error('BOARD map catalog unavailable: '+res.status);
  const data=await res.json();
  // A different Core must wait for a safe full reload; keep the pinned map.
  if(window.GAME_CORE_HASH&&data.coreHash!==window.GAME_CORE_HASH){
   defaultCatalogChecked=true;return false;
  }
  defaultCatalogChecked=true;
  const next=inspect(data);
  if(!next.some(m=>m.id===DEFAULT&&m.enabled))throw Error('Default BOARD map unavailable');
  if(playingBoard()){
   // Do not replace the map picker or activate new topology during gameplay.
   // The latest valid catalog is staged until BOARD returns to Host lobby.
   deferredMaps=JSON.stringify(next)===JSON.stringify(catalog)?null:next;
   return deferredMaps!==null;
  }
  deferredMaps=null;
  return applyMapCatalog(next);
 })().finally(()=>{refreshing=null;});
 return refreshing;
}
function checkPlugin(plugin){
 if(!plugin||!legacy||!plugin.map||!plugin.art)throw Error('Invalid BOARD map module');
 const {map,art}=plugin;
 if(typeof map.MAP_ID!=='string')throw Error('BOARD map identity missing');
 for(const [name,fn] of Object.entries(legacy.map))
  if(typeof fn==='function'&&typeof map[name]!=='function')throw Error('BOARD map missing '+name);
 for(const [name,fn] of Object.entries(legacy.art))
  if(typeof fn==='function'&&typeof art[name]!=='function')throw Error('BOARD art missing '+name);
 for(const count of [1,6,7,12]){
  const m=map.create(0,{players:count});
  if(!m||m.id!==map.MAP_ID||m.startId!=='n0'||
     !m.nodes?.n0||!m.nodes?.[m.finishId]||
     !Number.isFinite(m.width)||!Number.isFinite(m.height))
   throw Error('Invalid BOARD graph for '+count+' players');
  map.assertCompatible(m);
  if(map.validate(m)!==true)throw Error('BOARD graph validation failed');
 }
 return plugin;
}
async function activate(id){
 captureDefault();
 if(id===DEFAULT){
  if(!legacy)throw Error('Default BOARD map missing');
  const info=catalog.find(m=>m.id===DEFAULT&&m.enabled);
  // Development/old fixtures have no generated hash in runtime-config.
  // Their already loaded globals are the baseline until a later revision.
  if(!legacyHash&&!INITIAL_LEGACY_HASH&&info?.hash)legacyHash=info.hash;
  if(info?.hash&&legacyHash!==info.hash){
   // Switch immutable map assets only after the running BOARD has ended.
   if(playingBoard())throw Error('Default BOARD update cannot activate mid-game');
   const previous={map:window.BoardMap,art:window.BoardArt,
    design:window.BOARD_DESIGN,scenery:window.BOARD_SCENERY};
   try{
    for(const url of info.legacyUrls)await inject(url.slice(1));
    const map=window.BoardMap,art=window.BoardArt;
    if(map===previous.map||art===previous.art||map?.MAP_ID!==DEFAULT||
       typeof map.create!=='function'||typeof map.validate!=='function'||
       typeof map.assertCompatible!=='function'||typeof art.draw!=='function')
     throw Error('Invalid updated built-in BOARD map');
    for(const count of [1,6,7,12]){
     const instance=map.create(0,{players:count});
     map.assertCompatible(instance);
     if(map.validate(instance)!==true)
      throw Error('Updated built-in BOARD map failed validation');
    }
    legacy={map,art};legacyHash=info.hash;
   }catch(error){
    window.BoardMap=previous.map;window.BoardArt=previous.art;
    window.BOARD_DESIGN=previous.design;window.BOARD_SCENERY=previous.scenery;
    throw error;
   }
  }
  window.BoardMap=legacy.map;window.BoardArt=legacy.art;
  active=id;activeHash=legacyHash||info?.hash||null;return;
 }
 let info=catalog.find(m=>m.id===id&&m.enabled&&m.kind==='module');
 if(!info){await refreshMaps();info=catalog.find(m=>m.id===id&&m.enabled&&m.kind==='module');}
 if(!info)throw Error('Unknown BOARD map '+id);
 const key=id+':'+info.hash;
 let plugin=modules.get(key);
 if(!plugin){
  const url=new URL(info.entryUrl,location.origin);
  if(url.origin!==location.origin||url.pathname!==info.entryUrl)
   throw Error('Unsafe BOARD map URL');
  plugin=checkPlugin((await import(url.href)).default);
  modules.set(key,plugin);
 }
 // A catalog refresh may occur while a BOARD session is running. Never apply
 // its code here: activate() is called only by beginBoard()'s ensure() gate.
 if(chosen()!==id)throw Error('BOARD map selection changed during download');
 window.BoardMap=plugin.map;window.BoardArt=plugin.art;
 active=id;activeHash=info.hash;
}
async function ensure(){
 if(!playingBoard())applyPendingMaps();
 if(ready())return;
 if(pending)return pending;
 pending=(async()=>{
  // Resume after partially loaded scripts; never rerun successful global code.
  if(!globalsReady())for(const file of files)if(!loaded.has(file))await inject(file);
  if(!globalsReady()){loaded.clear();throw Error('BOARD PARTY core is incomplete');}
  captureDefault();
  if(!defaultCatalogChecked)try{await refreshMaps();}
  catch(error){
   // Offline clients retain the bundled default map; retry on the next poll.
   console.warn('BOARD map metadata unavailable; retaining bundled map',error);
   defaultCatalogChecked=true;
  }
  await activate(chosen());
  await prepareSystems();
  if(!ready())throw Error('BOARD map/system activation incomplete');
 })().finally(()=>{pending=null;});
 return pending;
}
function mount(){
 const mode=document.getElementById('sessionMode');
 if(!mode||document.getElementById('boardMapSelector'))return;
 selector=document.createElement('select');
 selector.id='boardMapSelector';
 selector.title='แผนที่ BOARD PARTY';
 selector.setAttribute('aria-label','เลือกแผนที่ BOARD PARTY');
 selector.style.cssText='width:100%;height:35px;min-height:35px;min-width:0;padding:3px 5px;font-size:11px;visibility:hidden';
 mode.append(selector);render();
 for(const btn of mode.querySelectorAll('[data-session-mode]')){
  btn.addEventListener('click',()=>{
   queueMicrotask(render);
   if(btn.dataset.sessionMode==='board')
    void refreshMaps().catch(err=>console.warn('BOARD map catalog unavailable',err));
  });
 }
}
if(typeof document!=='undefined'&&typeof document.getElementById==='function'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 // auto-update.js owns the production 45-second poll. Keep a fallback in
 // local development where the deployment watcher is intentionally disabled.
 setInterval(()=>{
  if(document.hidden||window.GameAutoUpdate)return;
  if(selector&&document.querySelector('[data-session-mode="board"]')?.classList.contains('active'))
   void refreshMaps().catch(()=>{});
  void refreshSystems().catch(()=>{});
 },45000);
}

/* System plug-ins reuse the BOARD route and content-addressed deployment.
 * Discovery is metadata-only; all code changes activate at a NEW board session. */
const systemCache=new Map(),activeSystems=new Map(),systemRejected=new Map();
let systemCatalog=[],systemRevision=0,systemPrepared=!window.GAME_CORE_HASH;
let systemRefreshing=null;
const categories=['items','spaces','events'];
function inspectSystems(value){
 if(!value||value.schema!==1||!Array.isArray(value.systems)||
    !/^[a-f0-9]{20}$/.test(value.coreHash))throw Error('Invalid BOARD system catalog');
 const seen=new Set();
 return value.systems.map(item=>{
  if(!item||!categories.includes(item.category)||
     !/^[a-z][a-z0-9-]*$/.test(item.id)||
     typeof item.name!=='string'||!item.name||
     typeof item.enabled!=='boolean'||item.apiVersion!==1||
     
     !/^[a-f0-9]{24}$/.test(item.hash))
   throw Error('Invalid BOARD system descriptor');
  const key=item.category+':'+item.id;
  if(seen.has(key))throw Error('Duplicate BOARD system: '+key);
  seen.add(key);
  const root='/board-system-assets/'+item.category+'/'+item.id+'/'+item.hash+'/';
  if(typeof item.entryUrl!=='string'||!item.entryUrl.startsWith(root)||
     !/^[a-z0-9][a-z0-9/._-]*\.js$/.test(item.entryUrl.slice(root.length))||
     item.entryUrl.includes('..'))throw Error('Invalid BOARD system URL');
  return Object.freeze({...item});
 });
}
async function refreshSystems(){
 if(systemRefreshing)return systemRefreshing;
 systemRefreshing=(async()=>{
  const url=new URL('./board-system-catalog.json',document.baseURI);
  url.searchParams.set('_',String(Date.now()));
  const response=await fetch(url.href,{cache:'no-store'});
  if(!response.ok){
   // Existing source-only/browser fixtures and older deployments may have no
   // optional system catalog. Preserve the original BOARD session in that case.
   if(response.status===404&&!systemCatalog.length)return false;
   throw Error('BOARD systems unavailable: '+response.status);
  }
  const data=await response.json();
  if(window.GAME_CORE_HASH&&data.coreHash!==window.GAME_CORE_HASH)return false;
  const next=inspectSystems(data);
  if(JSON.stringify(next)===JSON.stringify(systemCatalog))return false;
  systemCatalog=next;systemRevision++;systemPrepared=false;
  return true;
 })().finally(()=>{systemRefreshing=null;});
 return systemRefreshing;
}
function checkSystem(impl,meta){
 if(!impl||typeof impl!=='object'||impl.id!==meta.id||
    impl.category!==meta.category)throw Error('Invalid BOARD system identity: '+meta.id);
 const required=meta.category==='items'?'begin':
   meta.category==='spaces'?'onLand':'onUpdate';
 if(typeof impl[required]!=='function')throw Error('BOARD system missing '+required+': '+meta.id);
 for(const method of ['begin','confirm','update','onLand','onUpdate'])
  if(impl[method]!==undefined&&typeof impl[method]!=='function')
   throw Error('BOARD system lifecycle invalid: '+meta.id);
 return Object.freeze(impl);
}
async function prepareSystems(){
 if(systemPrepared)return;
 await refreshSystems();
 const next=new Map();
 // Download only BOARD systems, never any minigame or unused map modules.
 // Keep the previous active set until EVERY enabled system loads and validates.
 try{
  for(const meta of systemCatalog.filter(item=>item.enabled)){
   const key=meta.category+':'+meta.id+':'+meta.hash;
   let impl=systemCache.get(key);
   if(!impl){
    const url=new URL(meta.entryUrl,location.origin);
    if(url.origin!==location.origin||url.pathname!==meta.entryUrl)
     throw Error('Unsafe BOARD system URL');
    impl=checkSystem((await import(url.href)).default,meta);
    systemCache.set(key,impl);
   }
   next.set(meta.category+':'+meta.id,impl);
  }
 }catch(error){
  // A failed optional system does not replace active implementations.
  systemRejected.set(String(error?.message||error).slice(0,160),Date.now());
  if(activeSystems.size===0&&systemCatalog.some(item=>item.enabled))throw error;
  console.warn('Retaining last stable BOARD systems',error);
  systemPrepared=true;
  return;
 }
 activeSystems.clear();
 for(const [key,impl] of next)activeSystems.set(key,impl);
 window.BoardItems?.registerPlugins?.([...next.values()].filter(m=>m.category==='items'));
 systemPrepared=true;
}
const systemGet=(category,id)=>activeSystems.get(category+':'+id)||null;
window.BoardSystemPlugins=Object.freeze({
 refresh:refreshSystems,prepare:prepareSystems,get:systemGet,
 list:category=>[...activeSystems.entries()].filter(([key])=>key.startsWith(category+':')).map(([,impl])=>impl),
 descriptors:category=>systemCatalog.filter(x=>!category||x.category===category).map(x=>({...x})),
 get revision(){return systemRevision;},
 get pending(){return !systemPrepared;},
 get rejected(){return [...systemRejected.keys()];}
});

async function onLobbyEntered(){
 if(playingBoard())return false;
 if(applyingLobby)return applyingLobby;
 applyingLobby=(async()=>{
  let changed=applyPendingMaps();
  try{changed=await refreshMaps()||changed;}
  catch(error){console.warn('BOARD map refresh on lobby return failed',error);}
  // The previous BOARD session has ended: now it is safe to switch a selected
  // content-addressed map or BOARD system implementation for the next game.
  if(globalsReady()&&!ready())try{await ensure();}
  catch(error){console.warn('BOARD updated map could not be prepared',error);}
  return changed;
 })().finally(()=>{applyingLobby=null;});
 return applyingLobby;
}
window.BoardRuntime=Object.freeze({ready,ensure,refreshMaps,onLobbyEntered,
 maps:()=>catalog.map(m=>({...m})),
 get pendingMapUpdate(){return deferredMaps!==null;},
 get selectedMapId(){return chosen();},
 get activeMapId(){return active;},
 get revision(){return revision;}
});
})();
