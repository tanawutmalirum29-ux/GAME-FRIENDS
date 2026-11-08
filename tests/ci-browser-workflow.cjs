'use strict';
// Cheap guardrail for AI agents editing .github/workflows/verify.yml.
// Each required browser check must run exactly once, including WebKit.
// Execute with: node tests/ci-browser-workflow.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('.github/workflows/verify.yml','utf8');
const docs=fs.readFileSync('AGENTS.md','utf8');
assert.match(docs,/docs\/CI_TESTING\.md/, 'AGENTS.md must point future AI agents at the CI performance policy');
assert.match(source,/^  browser-qa:\s*$/m, 'browser QA must be a dedicated parallel matrix job');
assert.match(source,/^      fail-fast: false\s*$/m,
 'failure in one shard must not hide diagnostics from the other browser shards');
assert.match(source,/^        suite: \[board-controller, farm-ghost, pizza-arenas, map-scale\]\s*$/m,
 'keep four independent browser shards; update this contract when redistributing tests');
assert.match(source,/^  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\s*$/m,
 'superseded PR jobs must share a concurrency key without conflating distinct workflows');
assert.match(source,/^  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\s*$/m,
 'only PR runs can cancel superseded runs; main branch results must not be cancelled');
assert.match(source,/uses: actions\/cache@v4/,
 'cache the pinned browser binaries across runs');
assert.match(source,/key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-v1\.62\.1/,
 'cache key must include the exact pinned Playwright version');
assert.match(source,/npm install --prefix \/tmp\/board-browser --no-audit --no-fund playwright@1\.62\.1/,
 'installation and browser cache must target the same version');
assert.match(source,/playwright install --with-deps chromium webkit/,
 'keep the complete set of browsers and native dependencies');
assert.doesNotMatch(source,/continue-on-error:\s*true/,
 'CI must never treat a failed browser or game check as success');
const required={
 'board-controller':[
  'node tests/board-browser.cjs',
  'node tests/mobile-host-lobby-browser.cjs',
  'node tests/lobby-stability-browser.cjs',
  'BOARD_BROWSER=webkit node tests/mobile-host-lobby-browser.cjs',
  'BOARD_BROWSER=webkit node tests/lobby-stability-browser.cjs',
  'node tests/board-startup.cjs',
  'BOARD_BROWSER=webkit node tests/board-startup.cjs'
 ],
 'farm-ghost':[
  'node tests/farm-ice-browser.cjs',
  'BOARD_BROWSER=webkit node tests/farm-ice-browser.cjs',
  'node tests/ghost-courtyards-browser.cjs',
  'BOARD_BROWSER=webkit node tests/ghost-courtyards-browser.cjs'
 ],
 'pizza-arenas':[
  'node tests/pizza-kitchen-browser.cjs',
  'BOARD_BROWSER=webkit node tests/pizza-kitchen-browser.cjs',
  'node tests/party-arenas-browser.cjs',
  'BOARD_BROWSER=webkit node tests/party-arenas-browser.cjs'
 ],
 'map-scale':[
  'node tests/map-scale-browser.cjs',
  'BOARD_BROWSER=webkit node tests/map-scale-browser.cjs'
 ]
};
const suites=Object.keys(required);
const lines=source.split(/\r?\n/).map(s=>s.trim());
for(const suite of suites){
 const start=source.indexOf("if: matrix.suite == '"+suite+"'");
 assert.ok(start>=0,'missing browser QA suite '+suite);
 const until=source.indexOf("\n      - name:",start);
 const segment=source.slice(start,until<0?undefined:until);
 for(const command of required[suite])
  assert.ok(segment.split('\n').some(l=>l.trim()===command),
   suite+' must include browser check: '+command);
}
const cmds=Object.values(required).flat();
assert.equal(cmds.length,17);
for(const command of cmds){
 assert.equal(lines.filter(s=>s===command).length,1,
  'duplicate or omitted browser invocation: '+command);
}
assert.match(source,/name: board-expedition-screenshots-\$\{\{ matrix\.suite \}\}/,
 'all shards need unique screenshot artifact names');
assert.match(source,/run: node tests\/ci-browser-workflow\.cjs/,
 'the workflow must execute this contract to protect itself');
console.log('BROWSER CI MATRIX PASS: four independently executed shards; all 17 commands preserved; cache + PR cancellation + artifact isolation enabled.');
