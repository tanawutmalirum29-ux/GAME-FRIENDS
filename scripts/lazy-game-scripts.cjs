/* Build-time removal of eagerly loaded game engines from production HTML.
 * A tested, unmodified development index remains compatible with older tools. */
'use strict';
const assert=require('node:assert/strict');
function pruneLegacy(html,catalog){
 assert(typeof html==='string','index source must be a string');
 assert(catalog&&Array.isArray(catalog.games),'validated catalog required');
 const legacy=new Set();
 for(const game of catalog.games){
  for(const url of game.legacyUrls||[]){
   const parts=url.split('/legacy/');
   if(parts.length!==2||!parts[1]||parts[1].includes('..'))
    throw Error('Invalid plug-in dependency path: '+url);
   legacy.add(parts[1]);
  }
 }
 const tag=/^[ \t]*<script\s+defer\s+src="\.\/([^"?]+)(?:\?v=[^"]*)?"\s*><\/script>\s*$/gm;
 // Development HTML may list game-owned scripts, but production must never
 // eagerly load them: immutable per-game modules import those files on demand.
 const owned=/^src\/games\/[a-z0-9-]+\/[a-zA-Z0-9._-]+\.js$/;
 return html.replace(tag,(whole,asset)=>(legacy.has(asset)||owned.test(asset))?'':whole);

}
function pruneGameCover(html){
 assert(typeof html==='string','index source must be a string');
 // Game-owned SVGs replace the 17 KB legacy shared cover renderer in production.
 return html.replace(/^[ \t]*<script\s+defer\s+src="\.\/game-cover-art\.js(?:\?v=[^"]*)?"\s*><\/script>\s*$/gm,'');
}
const BOARD_CORE_SCRIPTS=new Set(["src/board-party/runtime/board-map.js","src/board-party/runtime/board-v7-design.js","src/board-party/runtime/board-v7-art.js","src/board-party/runtime/board-branch-naming.js","src/board-party/runtime/board-v7-adapter.js","src/board-party/runtime/board-dice.js","src/board-party/runtime/board-dice-renderer.js","src/board-party/runtime/board-items.js","src/board-party/runtime/board-bots.js","src/board-party/runtime/board-minigame.js","src/board-party/runtime/board-party.js","src/board-party/runtime/board-art.js"]);
function pruneBoardCore(html){
 assert(typeof html==='string','index source must be a string');
 const tag=/^[ \t]*<script\s+defer\s+src="\.\/([^"?]+)(?:\?v=[^"]*)?"\s*><\/script>\s*$/gm;
 return html.replace(tag,(whole,asset)=>BOARD_CORE_SCRIPTS.has(asset)?'':whole);
}
const CDN_LIBRARIES=new Set([
 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
]);
function pruneExternal(html){
 assert(typeof html==='string','index source must be a string');
 const tag=/^[ \t]*<script\s+defer\s+src="(https:\/\/[^\"]+)"\s*><\/script>\s*$/gm;
 return html.replace(tag,(whole,url)=>CDN_LIBRARIES.has(url)?'':whole);
}
function pruneAppBoot(html){
 assert(typeof html==='string','index source must be a string');
 // Production routes call app.js through main-loader; tests retain source HTML.
 const tag=/^[ \t]*<script\s+defer\s+src="\.\/app\.js(?:\?v=[^"]*)?"\s*><\/script>\s*$/gm;
 return html.replace(tag,'');
}
const HOST_ROUTE_SCRIPTS=new Set(["arena-scale.js","arena-art.js","graveyard-art.js","combat-motion.js","character-system.js"]);
function pruneHostCore(html){
 assert(typeof html==='string','index source must be a string');
 const tag=/^[ \t]*<script\s+defer\s+src="\.\/([^"?]+)(?:\?v=[^"]*)?"\s*><\/script>\s*$/gm;
 return html.replace(tag,(whole,asset)=>HOST_ROUTE_SCRIPTS.has(asset)?'':whole);
}
module.exports={pruneLegacy,pruneBoardCore,pruneExternal,pruneAppBoot,pruneHostCore,pruneGameCover,BOARD_CORE_SCRIPTS,HOST_ROUTE_SCRIPTS,CDN_LIBRARIES};
