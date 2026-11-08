/* Defer BOARD PARTY map and bot modules until entering the board. */
(()=>{
'use strict';
const files=[
  "board-map.js",
  "board-v7-design.js",
  "board-v7-art.js",
  "board-branch-naming.js",
  "board-v7-adapter.js",
  "board-dice.js",
  "board-dice-renderer.js",
  "board-items.js",
  "board-bots.js",
  "board-minigame.js",
  "board-party.js",
  "board-art.js"
];
const required=['BoardMap','BoardDice','BoardItems','BoardBots','BoardMinigame','BoardParty','BoardArt'];
let pending=null;
function ready(){return required.every(name=>!!window[name]);}
function inject(file){
 return new Promise((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.async=false;
  const url=new URL('./'+file,document.baseURI);
  const version=String(window.GAME_BUILD_VERSION||'');
  if(version)url.searchParams.set('v',version);
  tag.src=url.href;
  tag.onload=()=>resolve();
  tag.onerror=()=>{tag.remove();reject(Error('BOARD PARTY asset unavailable: '+file));};
  document.head.append(tag);
 });
}
function ensure(){
 if(ready())return Promise.resolve();
 if(pending)return pending;
 pending=(async()=>{
  for(const file of files)await inject(file);
  if(!ready())throw Error('BOARD PARTY core loaded without required engines');
 })().catch(error=>{pending=null;throw error;});
 return pending;
}
window.BoardRuntime=Object.freeze({ready,ensure});
})();
