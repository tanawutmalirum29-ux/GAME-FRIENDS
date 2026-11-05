'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let surfaces=0,paints=0;
const brush=new Proxy({},{get(_target,key){
 if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
 return ()=>{paints++;};
},set(){return true;}});
class Surface {
 constructor(w,h){this.width=w;this.height=h;surfaces++;}
 getContext(){return brush;}
}
const math=Object.create(Math);math.random=()=>{throw Error('Painting must not advance gameplay RNG');};
const context=vm.createContext({window:{},OffscreenCanvas:Surface,Math:math});
vm.runInContext(fs.readFileSync('arena-art.js','utf8'),context);
const art=context.window.PartyArenaArt;
let ratio=1,blits=[];
const screen={getTransform:()=>({a:ratio,b:0,c:0,d:ratio}),drawImage:(...args)=>blits.push(args)};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
for(const theme of ['farm','orchard','lava','graveyard','egypt']){
 const state=freeze({radius:197,center:{x:480,y:270},pens:[{angle:0,gateWidth:74}],
  board:{x:285,y:116,w:390,h:390}});
 const before=JSON.stringify(state),count=surfaces;
 art.draw(screen,theme,state);
 assert.equal(surfaces,count+1);
 const work=paints,first=blits.at(-1)[0];
 for(let i=0;i<60;i++)art.draw(screen,theme,state);
 assert.equal(paints,work,'steady-state frames only blit cached '+theme+' scenery');
 assert.equal(blits.at(-1)[0],first);
 assert.deepEqual(blits.at(-1).slice(1),[0,0,960,540]);
 assert.equal(JSON.stringify(state),before,'art leaves gameplay state untouched');
 ratio=2;art.draw(screen,theme,state);
 assert.equal(blits.at(-1)[0].width,1920,'Retina cache has real high-resolution pixels');
 assert.notEqual(blits.at(-1)[0],first,'rebuild for a sharper host canvas');
 ratio=1;
}
const state={board:{x:70,y:110,w:820,h:390}};
art.draw(screen,'orchard',state);const first=blits.at(-1)[0];
state.board.w=840;art.draw(screen,'orchard',state);
assert.notEqual(blits.at(-1)[0],first,'changed board geometry invalidates cache');
art.draw(screen,'egypt',state);assert.notEqual(blits.at(-1)[0],first);
console.log('ARENA ART PASS: immutable game state, no gameplay RNG, cached frames, geometry/theme/DPR invalidation');
