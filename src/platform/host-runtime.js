/* Production route-specific host dependencies. A phone controller never needs
 * host-authoritative collision, arena drawing or cemetery scenery at startup.
 * Only load these before evaluating the shared app runtime on host routes. */
(()=>{
'use strict';
const files=[
  {
    "file": "arena-scale.js",
    "api": "PartyArenaScale"
  },
  {
    "file": "arena-art.js",
    "api": "PartyArenaArt"
  },
  {
    "file": "graveyard-art.js",
    "api": "GhostCemeteryArt"
  },
  {
    "file": "combat-motion.js",
    "api": "PartyCombatMotion"
  },
  {
    "file": "character-system.js",
    "api": "PartyCharacters"
  }
];
let pending=null;
function ready(){return files.every(({api})=>Boolean(window[api]));}
function inject(file,api){
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.async=false;
  const url=new URL('./'+file,document.baseURI);
  const version=String(window.GAME_BUILD_VERSION||'');
  if(version)url.searchParams.set('v',version);
  script.src=url.href;
  script.onload=()=>window[api]?resolve():reject(Error('Host dependency missing API: '+api));
  script.onerror=()=>{script.remove();reject(Error('Host dependency unavailable: '+file));};
  document.head.append(script);
 });
}
function ensure(){
 if(ready())return Promise.resolve();
 if(pending)return pending;
 pending=(async()=>{
  // Reuse already initialized globals. In particular, a partially failed
  // load must never execute successful earlier scripts twice on retry.
  for(const {file,api} of files)if(!window[api])await inject(file,api);
  if(!ready())throw Error('Host runtime incomplete');
 })().finally(()=>{pending=null;});
 return pending;
}
window.GameHostRuntime=Object.freeze({ready,ensure});
})();
