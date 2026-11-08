/* GAME-FRIENDS plug-in registry and immutable-version loader.
 * Existing engines remain active until the next round. Only same-core catalogs
 * can activate in a running room; a core release still waits for safe reload. */
(()=>{
'use strict';
const current=new Map(),catalog=new Map(),pending=new Map();
let coreHash='',pendingCore=false,refreshing=null,revision=0;
const emitted=()=>{if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')
 window.dispatchEvent(new CustomEvent('gameplatform:catalog',{detail:{revision}}));};
function validUrl(value){
 if(typeof value!=='string'||!/^\/game-assets\/[a-z][a-z0-9_]*\/[a-f0-9]{24}\//.test(value))throw Error('Invalid versioned game asset');
 const url=new URL(value,location.origin);
 if(url.origin!==location.origin)throw Error('Cross-origin engine blocked');
 return url.href;
}
function inspect(data){
 if(!data||data.schema!==1||!Array.isArray(data.games)||typeof data.coreHash!=='string'||!/^[a-f0-9]{20}$/.test(data.coreHash))throw Error('Invalid game catalog');
 const seen=new Set();
 return data.games.map(g=>{
  if(!g||! /^[a-z][a-z0-9_]*$/.test(g.id)||seen.has(g.id)||g.apiVersion!==1||
   !g.players||g.players.min<1||g.players.max>12||g.players.min>g.players.max||
   typeof g.enabled!=='boolean'||typeof g.name!=='string'||
   !Array.isArray(g.modes)||g.modes.some(m=>!['normal','board'].includes(m))||
   !/^[a-f0-9]{24}$/.test(g.hash))throw Error('Malformed game: '+g?.id);
  seen.add(g.id);
  const marker='/game-assets/'+g.id+'/'+g.hash+'/';
  if(!g.entryUrl.startsWith(marker)||!Array.isArray(g.legacyUrls)||g.legacyUrls.some(x=>!x.startsWith(marker)))throw Error('Mismatched asset revision');
  validUrl(g.entryUrl);g.legacyUrls.forEach(validUrl);
  return Object.freeze({...g});
 });
}
async function refresh(){
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  const url=new URL('./game-catalog.json',location.href);
  url.searchParams.set('_',String(Date.now()));
  const response=await fetch(url.href,{cache:'no-store'});
  if(!response.ok)throw Error('Catalog unavailable: '+response.status);
  const data=await response.json(),next=inspect(data);
  // The initial HTML/JS can outlive a deployment. Never mix incompatible core code.
  const initial=String(window.GAME_CORE_VERSION||'');
  if(initial&&data.coreHash!==initial){pendingCore=true;return false;}
  if(coreHash&&coreHash!==data.coreHash){pendingCore=true;return false;}
  const enabled=next.filter(g=>g.enabled);
  const changed=!coreHash||enabled.length!==catalog.size||enabled.some(g=>{
   const old=catalog.get(g.id);return !old||old.hash!==g.hash||old.name!==g.name||
    old.version!==g.version||old.players.min!==g.players.min||
    old.players.max!==g.players.max||old.modes.join(',')!==g.modes.join(',');
  });
  coreHash=data.coreHash;
  if(changed){
   catalog.clear();
   for(const g of enabled)catalog.set(g.id,g);
   revision++;emitted();
  }
  return changed;
 })().finally(()=>{refreshing=null;});
 return refreshing;
}
function games(mode=null){return [...catalog.values()].filter(g=>!mode||g.modes.includes(mode));}
function descriptor(id){return catalog.get(id)||null;}
function engine(id){return current.get(id)?.engine||null;}
function ready(id){const d=descriptor(id),e=current.get(id);return !!(d&&e&&e.hash===d.hash);}
function addScript(url){
 return new Promise((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.async=false;tag.src=validUrl(url);
  tag.onload=()=>resolve();
  tag.onerror=()=>{tag.remove();reject(Error('Unable to fetch game dependency'));};
  document.head.appendChild(tag);
 });
}
// Serialize the same game ID even when its catalog revision changes mid-download.
const loadQueue=new Map();
async function ensure(id){
 const d=descriptor(id);
 if(!d)throw Error('Unknown/disabled minigame: '+id);
 if(ready(id))return engine(id);
 const key=id+':'+d.hash;
 if(pending.has(key))return pending.get(key);
 const previous=loadQueue.get(id)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{
  if(descriptor(id)?.hash!==d.hash)throw Error('Superseded plug-in version: '+id);
  if(d.legacyUrls.length){
   // Built-time fingerprints prove whether old embedded engines match catalog.
   if(!(d.global&&window[d.global]&&!current.has(id)&&
      (!window.GAME_GAME_HASHES||window.GAME_GAME_HASHES[id]===d.hash))){
    for(const url of d.legacyUrls)await addScript(url);
   }
  }
  const namespace=await import(validUrl(d.entryUrl));
  const plugin=namespace.default;
  if(!plugin||typeof plugin.setup!=='function'||typeof plugin.update!=='function'||
     typeof plugin.draw!=='function'||typeof plugin.hud!=='function'||
     (!d.global&&typeof plugin.getResult!=='function'))
   throw Error('Invalid Game Plugin API: '+id);
  if(descriptor(id)?.hash!==d.hash)throw Error('Superseded plug-in version: '+id);
  current.set(id,{hash:d.hash,engine:plugin});
  return plugin;
 });
 const tracked=task.finally(()=>{
  pending.delete(key);
  if(loadQueue.get(id)===tracked)loadQueue.delete(id);
 });
 pending.set(key,tracked);loadQueue.set(id,tracked);
 return tracked;
}
function adoptLegacy(){
 for(const g of games()){
  if(g.global&&window[g.global]&&!current.has(g.id)&&
     (!window.GAME_GAME_HASHES||window.GAME_GAME_HASHES[g.id]===g.hash)){
   const plugin=window[g.global];
   if(plugin&&typeof plugin.setup==='function'&&typeof plugin.update==='function'&&typeof plugin.draw==='function')
    current.set(g.id,{hash:g.hash,engine:plugin});
  }
 }
}
async function initialize(){try{await refresh();adoptLegacy();}catch(e){console.warn('Game catalog unavailable; retaining legacy engines',e);}}
window.GamePlatform=Object.freeze({initialize,refresh,games,descriptor,engine,ready,ensure,adoptLegacy,
 get pendingCoreUpdate(){return pendingCore;},get revision(){return revision;}});
if(typeof window.addEventListener==='function'){
 window.addEventListener('focus',()=>{void refresh().catch(()=>{});});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh().catch(()=>{});});
 setInterval(()=>{if(!document.hidden)void refresh().catch(()=>{});},45000);
}
// Service worker never reloads a room; it caches only hashed assets.
if(typeof navigator!=='undefined'&&navigator.serviceWorker&&location.protocol==='https:'){
 void navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
}
void initialize();
})();