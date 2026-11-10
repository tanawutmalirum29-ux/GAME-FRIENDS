'use strict';
// Deterministic render cadence tests: physics/input are never frame-capped.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const render=fs.readFileSync('src/app/rounds/render.js','utf8');
const runtime=fs.readFileSync('src/app/core/runtime.js','utf8');
const start=render.indexOf('let lastBoardPaintAt=0;');
const end=render.indexOf('function animate(ts)',start);
assert.ok(start>=0&&end>start,'BOARD paint-budget helper must be present');
const helper=render.slice(start,end)+'\nthis.paint=shouldPaintBoardFrame;\n';
function countPaints(hz,lowDetail,dense){
 const ctx={};
 vm.runInNewContext(helper,ctx);
 let frames=0;
 for(let i=0;i<hz;i++){
  if(ctx.paint(1000+i*1000/hz,lowDetail,dense))frames++;
 }
 return frames;
}
const board120=countPaints(120,false,true);
assert.ok(board120>=29&&board120<=31,
 'dense BOARD on 120 Hz must be near 30 paints/s, got '+board120);
const normal120=countPaints(120,false,false);
assert.ok(normal120>=59&&normal120<=61,
 'small BOARD on 120 Hz must be near 60 paints/s, got '+normal120);
const board60=countPaints(60,false,true);
assert.ok(board60>=29&&board60<=31,
 'dense BOARD on 60 Hz must remain near 30 paints/s, got '+board60);
const low120=countPaints(120,true,false);
assert.ok(low120>=29&&low120<=31,
 'adaptive low-detail BOARD must conserve GPU with 30 paints/s, got '+low120);
const update=render.indexOf("updateRound(round.mode==='board'?boardDt:dt);");
const paint=render.indexOf('const shouldDraw=',update);
assert.ok(update>=0&&paint>update,
 'simulation must update on every animation frame before optional drawing');
assert.match(render.slice(update,paint),/if\(round&&!gameSelection\)/,
 'BOARD-to-minigame roulette must never draw an unloaded engine');
assert.match(render,/if\(onBoard\)updateAdaptiveBoardDetail\(elapsed\)/,
 'adaptive quality must actually be called by the host animation loop');
assert.match(runtime,/if\(!arenaResolutionDirty&&arenaLastDpr===dpr&&arenaLastModeKey===modeKey\)return;/,
 'unchanged canvas frames must not synchronously force DOM layout');
console.log('HOST RENDER BUDGET PASS: 120/60Hz paint quotas, input physics isolation, roulette safety and layout cache');
