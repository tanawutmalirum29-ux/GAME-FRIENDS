'use strict';
// Fail-closed, change-aware QA selection. No third-party dependencies.
// PR: only affected areas. Main, manual, scheduled, or unknown diff: full QA.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const SHA = /^[a-f0-9]{40}$/i;
const knownGames = () => new Set(fs.readdirSync(path.join(root, 'src/games'), {withFileTypes:true})
  .filter(entry => entry.isDirectory()).map(entry => entry.name));
function full(reason, files = []) {
  return {mode:'full', full:true, reason, files, areas:[]};
}
function classify(files, games = knownGames()) {
  if (!Array.isArray(files) || !files.length) return full('missing or empty diff', files || []);
  const areas = new Set();
  const add = (...values) => values.forEach(value => areas.add(value));
  for (const raw of files) {
    const file = String(raw).replace(/\\/g, '/');
    if (!file || file.startsWith('/') || file.includes('../')) return full('invalid changed path', files);
    // Pure documentation must never turn into an empty diff or unverified source change.
    if (file === 'AGENTS.md' || file === 'README.md' || file.startsWith('docs/') && /\.md$/i.test(file)) continue;
    // Changes to the selector, CI wiring and unrecognized shared modules require FULL QA.
    if (file.startsWith('.github/') || file.startsWith('ci/') ||
        /^scripts\/ci-/.test(file) || /^tests\/ci-/.test(file)) return full('CI or QA policy changed', files);
    const game = /^src\/games\/([a-z0-9-]+)\//.exec(file);
    if (game) {
      add('game', 'game:' + game[1], 'platform');
      if (file.endsWith('/manifest.json')) add('deployment');
      continue;
    }
    if (/^tests\/[a-z0-9-]+-browser\.cjs$/.test(file)) {
      // A changed browser test must run even if its owning feature was not edited.
      add('test:' + file);
      continue;
    }
    const candidate = /^tests\/([a-z0-9-]+?)(?:\.test)?\.(?:cjs|js)$/.exec(file);
    if (candidate && games.has(candidate[1])) {
      add('game', 'game:' + candidate[1], 'platform');
      continue;
    }
    if (/^(src\/board-party\/|scripts\/build-board-|scripts\/audit-board-|tests\/board-)/.test(file)) {
      add('board', 'platform');
      continue;
    }
    if (/^(src\/controller\/|app-controller\.js$|host\.html$|tests\/controller-)/.test(file)) {
      add('controller','lobby','orientation','network');
      continue;
    }
    if (/^(sw\.js$|auto-update\.js$|runtime-config\.js$|tests\/auto-update\.cjs$|tests\/cache-worker\.cjs$)/.test(file)) {
      add('loading','deployment','platform');
      continue;
    }
    if (/^(scripts\/build-game-catalog\.cjs$|scripts\/build-static\.cjs$|tests\/game-platform\.cjs$)/.test(file)) {
      add('platform','deployment','loading','game');
      continue;
    }
    // New tests and shared files are never silently treated as docs-only.
    return full('shared or unclassified file: ' + file, files);
  }
  return {mode:areas.size ? 'targeted' : 'docs', full:false, reason:'classified changed paths',
    files, areas:[...areas].sort()};
}
function changedFilesFromGit(env = process.env) {
  const base = env.PR_BASE_SHA, head = env.PR_HEAD_SHA;
  if (!SHA.test(base || '') || !SHA.test(head || '')) throw Error('missing PR base/head SHA');
  const result = cp.spawnSync('git', ['diff','--name-only','--diff-filter=ACDMRT','-z',base,head], {
    cwd:root, encoding:'utf8', timeout:20000, maxBuffer:4*1024*1024
  });
  if (result.error || result.status !== 0) throw Error('git diff failed: '+(result.stderr || result.error));
  return result.stdout.split('\0').filter(Boolean);
}
function fromEnvironment(env = process.env) {
  if (env.GITHUB_EVENT_NAME !== 'pull_request') return full('non-PR run: full regression');
  try {return classify(changedFilesFromGit(env));}
  catch (error) {return full('cannot verify PR diff: ' + error.message);}
}
function main(args = process.argv.slice(2)) {
  const impact = fromEnvironment();
  if (args.length === 1 && args[0] === '--gha') {
    process.stdout.write('impact=' + JSON.stringify(impact) + '\n');
    process.stdout.write('areas=' + JSON.stringify(impact.areas) + '\n');
    process.stdout.write('full=' + String(impact.full) + '\n');
  } else if (args.length === 1 && args[0] === '--json') {
    process.stdout.write(JSON.stringify(impact) + '\n');
  } else {
    throw Error('Usage: node scripts/ci-impact.cjs --gha | --json');
  }
  console.error('QA IMPACT: ' + impact.mode + ' [' + impact.areas.join(', ') + '] ' +
    impact.files.length + ' files; ' + impact.reason);
}
if (require.main === module) {
  try {main();} catch (error) {console.error(error.stack || error);process.exitCode = 1;}
}
module.exports={classify,full,fromEnvironment,changedFilesFromGit};
