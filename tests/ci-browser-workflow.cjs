'use strict';
// Protect all previously required browser coverage while allowing new games
// and the matrix shard count to grow without editing the workflow YAML.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {readManifest,validateManifest,expandTasks,createPlan,matrix}=
 require('../scripts/ci-browser-scheduler.cjs');
const yaml=fs.readFileSync('.github/workflows/verify.yml','utf8');
const agents=fs.readFileSync('AGENTS.md','utf8');
const docs=fs.readFileSync('docs/CI_TESTING.md','utf8');
const manifest=validateManifest(readManifest());
const tasks=expandTasks(manifest);
const ids=new Set(tasks.map(t=>t.id));
const previousCritical=[
 'board-browser.cjs@chromium',
 'mobile-host-lobby-browser.cjs@chromium',
 'lobby-stability-browser.cjs@chromium',
 'mobile-host-lobby-browser.cjs@webkit',
 'lobby-stability-browser.cjs@webkit',
 'board-startup.cjs@chromium',
 'board-startup.cjs@webkit',
 'farm-ice-browser.cjs@chromium',
 'farm-ice-browser.cjs@webkit',
 'ghost-courtyards-browser.cjs@chromium',
 'ghost-courtyards-browser.cjs@webkit',
 'pizza-kitchen-browser.cjs@chromium',
 'pizza-kitchen-browser.cjs@webkit',
 'party-arenas-browser.cjs@chromium',
 'party-arenas-browser.cjs@webkit',
 'map-scale-browser.cjs@chromium',
 'map-scale-browser.cjs@webkit'
].map(s=>'tests/'+s);
for(const id of previousCritical)
 assert.ok(ids.has(id),'A previously mandatory browser test has been removed: '+id);
assert.ok(ids.has('tests/avatar-browser.cjs@chromium'),
 'Standalone avatar rasterization must be included in automatic discovery');
const plan=createPlan(manifest),flat=plan.flatMap(b=>b.tasks);
assert.equal(flat.length,tasks.length,'all browser checks scheduled');
assert.equal(new Set(flat.map(t=>t.id)).size,tasks.length,
 'no browser check can be omitted or scheduled twice');
assert.deepEqual(matrix(manifest).include.map(x=>x.shard),plan.map(x=>x.shard));
assert.ok(plan.length>=manifest.minShards&&plan.length<=manifest.maxShards);
assert.match(yaml,/pull_request:\s*\n\s*branches:\s*\[main\]/);
assert.match(yaml,/^  browser-plan:\s*$/m);
assert.match(yaml,/^      matrix: \$\{\{ fromJSON\(needs\.browser-plan\.outputs\.matrix\) \}\}\s*$/m);
assert.match(yaml,/^    needs: \[browser-plan\]\s*$/m);
assert.match(yaml,/^  browser-gate:\s*$/m);
assert.match(yaml,/^    name: Browser QA \/ required gate\s*$/m,
 'stable required check is needed when shard counts change');
assert.match(yaml,/^    if: always\(\)\s*$/m);
assert.match(yaml,/^    needs: \[browser-plan, browser-qa\]\s*$/m);
assert.match(yaml,/test "\$PLAN_RESULT" = success/);
assert.match(yaml,/test "\$SHARDS_RESULT" = success/);
assert.match(yaml,/^      fail-fast: false\s*$/m);
assert.match(yaml,/node scripts\/ci-browser-scheduler\.cjs --matrix >> "\$GITHUB_OUTPUT"/);
assert.match(yaml,/node scripts\/ci-browser-scheduler\.cjs --run "\$\{\{ matrix\.shard \}\}"/);
assert.match(yaml,/node tests\/ci-browser-scheduler\.cjs/);
assert.match(yaml,/node tests\/ci-browser-workflow\.cjs/);
assert.match(yaml,/run: node scripts\/check-javascript\.cjs/);
assert.match(yaml,/run: node tests\/map-scale-regression\.cjs/);
assert.match(yaml,/uses: actions\/cache@v4/);
assert.match(yaml,/key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-v1\.62\.1/);
assert.match(yaml,/npm install --prefix \/tmp\/board-browser --no-audit --no-fund playwright@1\.62\.1/);
assert.match(yaml,/playwright install --with-deps chromium webkit/);
assert.match(yaml,/NODE_PATH: \/tmp\/board-browser\/node_modules/);
assert.match(yaml,/name: browser-qa-\$\{\{ matrix\.shard \}\}/);
assert.match(yaml,/^  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\s*$/m);
assert.match(yaml,/^  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\s*$/m);
assert.doesNotMatch(yaml,/continue-on-error:\s*true/);
for(const file of ['docs/CI_TESTING.md','ci/browser-tests.json','scripts/ci-browser-scheduler.cjs']){
 assert.ok(agents.includes(file),'Future AI instructions must point at '+file);
}
assert.match(docs,/browser-gate/);
assert.match(docs,/maxShards/);
console.log('SCALABLE QA CONTRACT PASS: '+manifest.tests.length+' registered suites, '+
 tasks.length+' browser checks, '+plan.length+' deterministic shards, all legacy tests retained, stable fail-closed gate.');
