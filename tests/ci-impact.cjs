'use strict';
const assert = require('node:assert/strict');
const {classify,fromEnvironment}=require('../scripts/ci-impact.cjs');
const {readManifest,validateManifest,expandTasks,selectManifest,createPlan,matrix}
  = require('../scripts/ci-browser-scheduler.cjs');
const games = new Set(['ufo-arena','dangerfield','pizza-time','ghost-attack']);
function check(files, mode, expectedAreas=[]) {
  const result=classify(files,games);
  assert.equal(result.mode,mode,JSON.stringify(files));
  for(const area of expectedAreas)assert.ok(result.areas.includes(area),
    'missing '+area+' for '+JSON.stringify(files));
  return result;
}
const docs=check(['README.md','docs/CI_TESTING.md','AGENTS.md'],'docs');
assert.equal(docs.full,false);
const game=check(['src/games/ufo-arena/game.js','tests/dangerfield.cjs'],
  'targeted',['game','game:ufo-arena','game:dangerfield','platform']);
check(['src/games/ufo-arena/manifest.json'],'targeted',['deployment','game:ufo-arena']);
check(['src/board-party/core/engine.js'],'targeted',['board','platform']);
check(['src/board-party/maps/new-map/manifest.json'],'targeted',['board']);
check(['app-controller.js'],'targeted',['controller','network']);
check(['sw.js'],'targeted',['loading','deployment']);
check(['tests/ghost-courtyards-browser.cjs'],'targeted',
  ['test:tests/ghost-courtyards-browser.cjs']);
for(const file of ['app.js','src/games/core/../dangerfield.js','scripts/ci-impact.cjs',
  '.github/workflows/verify.yml','ci/browser-tests.json','tests/smoke.cjs',
  'src/platform/game-loader.js']) {
 assert.equal(classify([file],games).mode,'full',file+' requires full regression');
}
assert.equal(classify([]).full,true,'unknown diff cannot skip QA');
assert.equal(fromEnvironment({GITHUB_EVENT_NAME:'push'}).full,true);
const manifest=validateManifest(readManifest());
assert.ok(manifest.tests.every(test=>test.areas.length),'all browser tests must carry area tags');
assert.equal(expandTasks(selectManifest(manifest,docs)).length,0);
assert.deepEqual(matrix(manifest,docs),{include:[{shard:'no-browser-impact',skip:true}]});
const selected=selectManifest(manifest,game);
const files=new Set(selected.tests.map(t=>t.file));
assert.ok(files.has('tests/game-platform-browser.cjs'));
assert.ok(!files.has('tests/pizza-kitchen-browser.cjs'),
  'unrelated pizza WebKit regression must not run on UFO/DANGERFIELD PR');
const planned=createPlan(manifest,game).flatMap(shard=>shard.tasks);
assert.deepEqual(planned.map(t=>t.id).sort(),expandTasks(selected).map(t=>t.id).sort());
const owned=classify(['src/games/pizza-time/game.js'],games);
assert.ok(selectManifest(manifest,owned).tests.some(t=>t.file==='tests/pizza-kitchen-browser.cjs'));
assert.ok(!selectManifest(manifest,owned).tests.some(t=>t.file==='tests/ghost-courtyards-browser.cjs'));
assert.equal(expandTasks(selectManifest(manifest,{full:true})).length,expandTasks(manifest).length);
assert.deepEqual(createPlan(manifest,{full:true}),createPlan(manifest),
  'main or unknown impact must run full existing browser matrix');
const changedTest=classify(['tests/ghost-courtyards-browser.cjs'],games);
assert.ok(selectManifest(manifest,changedTest).tests.some(t=>t.file==='tests/ghost-courtyards-browser.cjs'));
console.log('IMPACT QA PASS: doc-only/targeted/full, scoped game and browser suites, unknown-change full fallback, no silent omissions');
