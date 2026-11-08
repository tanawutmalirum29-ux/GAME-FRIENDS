/* GAME-FRIENDS map geometry helpers. All distances supplied here are WORLD
 * units; the 960x540 host design viewport is not a physical pixel count.
 * A minigame owns its map tiers, movement rules and collision geometry. */
(() => {
'use strict';
const HOST=Object.freeze({w:960,h:540});
function positive(value,name){
 if(!Number.isFinite(value)||value<=0)throw Error('Invalid map scale '+name);
 return value;
}
function viewport(world,screen=HOST){
 const w=positive(world.w,'world width'),h=positive(world.h,'world height');
 const sw=positive(screen.w,'screen width'),sh=positive(screen.h,'screen height');
 const x=sw/w,y=sh/h;
 return Object.freeze({
  world:{w,h},screen:{w:sw,h:sh},scaleX:x,scaleY:y,
  worldToScreen(px,py){return {x:px*x,y:py*y};},
  screenToWorld(px,py){return {x:px/x,y:py/y};},
  radiusOnScreen(radius){return positive(radius,'radius')*Math.min(x,y);},
  radiusInWorld(radius){return positive(radius,'radius')/Math.min(x,y);}
 });
}
function centeredGrid(cols,rows,tileSize,screen=HOST){
 if(!Number.isInteger(cols)||cols<1||!Number.isInteger(rows)||rows<1)
  throw Error('Grid dimensions must be positive integers');
 const tile=positive(tileSize,'tile size');
 const w=cols*tile,h=rows*tile;
 if(w>screen.w||h>screen.h)throw Error('Grid exceeds the configured world');
 return {x:(screen.w-w)/2,y:(screen.h-h)/2,w,h};
}
function tier(count,tiers){
 if(!Number.isInteger(count)||count<1||count>12)throw Error('Invalid player count');
 for(const entry of tiers){
  if(count<=entry.maxPlayers)return entry;
 }
 throw Error('No map tier for '+count+' players');
}
function proportions({world,screen=HOST,actorRadius,collisionRadius,tileSize=0,players=1}){
 const view=viewport(world,screen);
 const avatar=view.radiusOnScreen(actorRadius);
 const hit=view.radiusOnScreen(collisionRadius);
 return {
  visualRadiusPx:avatar,collisionRadiusPx:hit,
  visualToCollision:actorRadius/collisionRadius,
  tileToActor:tileSize?tileSize/actorRadius/2:null,
  arenaPerPlayer:world.w*world.h/players,
  ...view
 };
}
const API=Object.freeze({HOST,viewport,centeredGrid,tier,proportions});
if(typeof window!=='undefined')window.PartyArenaScale=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();
