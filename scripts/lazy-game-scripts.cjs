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
 return html.replace(tag,(whole,asset)=>legacy.has(asset)?'':whole);
}
const BOARD_CORE_SCRIPTS=new Set(["board-map.js","board-v7-design.js","board-v7-art.js","board-branch-naming.js","board-v7-adapter.js","board-dice.js","board-dice-renderer.js","board-items.js","board-bots.js","board-minigame.js","board-party.js","board-art.js"]);
function pruneBoardCore(html){
 assert(typeof html==='string','index source must be a string');
 const tag=/^[ \t]*<script\s+defer\s+src="\.\/([^"?]+)(?:\?v=[^"]*)?"\s*><\/script>\s*$/gm;
 return html.replace(tag,(whole,asset)=>BOARD_CORE_SCRIPTS.has(asset)?'':whole);
}
module.exports={pruneLegacy,pruneBoardCore,BOARD_CORE_SCRIPTS};
