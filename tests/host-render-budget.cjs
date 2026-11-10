'use strict';
// Uncapped presentation: browser requestAnimationFrame controls the cadence,
// not a 30/60fps limiter in the application.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const render=fs.readFileSync('src/app/rounds/render.js','utf8');
const runtime=fs.readFileSync('src/app/core/runtime.js','utf8');
assert.doesNotMatch(render,/shouldPaintBoardFrame|shouldPaintNormalFrame|lastBoardPaintAt|lastNormalPaintAt/,
 'No BOARD or normal mini-game paint quotas may remain');
assert.doesNotMatch(render,/const shouldDraw=|if\(shouldDraw\)/,
 'Host must draw every eligible animation frame');
const start=render.indexOf('function animate(ts)');
const update=render.indexOf("updateRound(round.mode==='board'?boardDt:dt);",start);
const draw=render.indexOf('drawGame(graphicsClock);',update);
const video=render.indexOf('renderHostVideoFrames();',draw);
assert.ok(start>=0&&update>start&&draw>update&&video>draw,
 'Physics/input must update first, then renderer + phone video on every RAF');
assert.match(render.slice(update,draw),/if\(round&&!gameSelection\)/,
 'BOARD-to-minigame roulette must never draw an unloaded engine');
assert.match(render,/if\(onBoard\)updateAdaptiveBoardDetail\(elapsed\)/,
 'Auto quality can reduce excessive work without limiting FPS');
assert.match(runtime,/if\(!arenaResolutionDirty&&arenaLastDpr===dpr&&arenaLastModeKey===modeKey\)return;/,
 'Unchanged canvas frames must avoid forcing DOM layout');
const board=fs.readFileSync('src/board-party/runtime/board-art.js','utf8');
assert.doesNotMatch(board,/sceneryApi\.createEffects|__sceneryFx\.draw\(/,
 'Animated terrain/scenery effects must be removed');
assert.doesNotMatch(board,/for\(let i=0;i<\(c\.lowDetail\?0:35\);i\+\+\)/,
 'Moving snow overlay must be removed');
assert.match(board,/ground\(g,s\);/,
 'Static cached BOARD terrain is still drawn');
assert.match(board,/nodes\(g,s\);actors\(g,s,t\);effects\(g,s,t\)/,
 'Important hazards and items must remain clearly visible');
console.log('UNCAPPED HOST RENDER PASS: no frame quota, physics-first RAF, cached terrain, no cosmetic FX');
