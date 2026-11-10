# GAME-FRIENDS — Fast PR, impact-aware QA and fail-closed release policy

**Every future coding AI must read this document and [AGENTS.md](../AGENTS.md) before modifying gameplay, CI, testing, or merging.** The goal is fast feedback for single-game changes as the catalog grows to 30+ games, while retaining complete safety coverage for shared changes and on main.

## Non-negotiable execution order

1. Read the latest main and open PRs; understand the touched paths.
2. Make the smallest coherent code change on a dedicated branch.
3. Run a **small preflight**: syntax for touched JS, the owning game's Node tests (when available), plus targeted smoke or structural checks. Do not run every engine and every Chromium/WebKit browser before opening a PR.
4. **Commit, push, and create a non-draft PR immediately** when the change is ready for review. A PR does NOT require completed GitHub Actions. Do not spend time waiting for CI before creating it. Update the same PR instead of creating duplicates.
5. GitHub Actions classifies the PR and runs its **required gates**. Investigate only failing affected suites. Do not rerun passed unrelated suites manually. Avoid speculative pushes while checks run, because superseded PR runs cancel.
6. Merge only when the *latest PR head* has successful required checks, no conflicts, and applicable review requirements. New code deployed via main is tested with **full regression on main push**; weekly/manual runs additionally cover the entire matrix.

**PR creation is fast; merging is gated.** Never confuse "open PR" with "merge PR."

## Changed-file impact policy

The source of truth is [scripts/ci-impact.cjs](../scripts/ci-impact.cjs), evaluated by the "Browser QA / plan" job. It compares the PR base and head SHAs after a full Git checkout, and returns JSON containing mode, impacted areas, and changed paths.

| Change | PR QA scope | Examples |
|---|---|---|
| One minigame | That game's Node tests, plugin integration and related Chromium/WebKit browser suites | `src/games/pizza-time/**` |
| BOARD-only | BOARD map, camera, runtime, controller-relevant suites | `src/board-party/**` |
| Controller-only | Controller, network, lobby, orientation suites | `app-controller.js` |
| Cache, build catalog | Cache, platform, deployment, startup suites | `sw.js` |
| Pure documentation | Syntax/contract/smoke gate, no Playwright download | `README.md` |
| Shared core, unknown or CI definition | **FULL regression** (fail closed) | `app.js`, `.github/**`, unknown files |
| Push to main, manual, weekly | **FULL regression** regardless of paths | No selective omissions |

**Never silence an unclassified source change**: it must trigger full QA. If the PR has multiple areas, run the union of affected suites. Changing a browser test itself must select that test. Changes to CI routing, registry, tests of the scheduler, or workflow YAML require full coverage. If the Git comparison fails, cannot prove changed paths, or the event is not a normal PR, run full coverage rather than assuming docs-only.

The browser registry [ci/browser-tests.json](../ci/browser-tests.json) includes `areas` ownership for every browser test. The planner selects matching tests, then uses the original **weighted dynamic shard allocation** for the selected subset. New minigames must register their browser suite and relevant `areas` tags; no unknown browser test may disappear from the registry. On main/weekly/manual run all registered Chromium/WebKit tasks, irrespective of areas.

## Always-green *by proving success*, not by bypassing checks

- `validate` must succeed: source-wide JavaScript syntax, CI contract tests, critical structural/static integrity checks, core smoke, and the Node suites applicable to the affected areas. Shared/unknown changes get the full original validation matrix.
- `Browser QA / plan` must prove that the changed-file diff is complete or use full fallback, and that the browser registry and scheduler remain valid.
- Browser shards execute **only selected** tests in parallel. A proven documentation-only PR has a single lightweight `Browser QA / no-browser-impact` job; no Playwright install is needed.
- The `browser-gate` job publishes `Browser QA / required gate` as a **stable required job name** and fails if planning or any selected shard fails. It cannot be bypassed by a missing browser result, missing registration, or manually faked statuses.
- Do not use `continue-on-error`, fake check results, forced merges, silent test deletions, or blanket disabling of required workflow jobs. Unrelated specialty workflows should retain green no-op status and skip their expensive test steps where practical.
- New source-wide features, high-risk physics/platform changes, unknown paths or CI changes run full tests even on PR. Additional targeted/manual checks can be done when code semantics justify them; path routing is the minimum safe coverage, not a claim that static path analysis understands runtime dependencies.
- Retain the pinned Playwright version, Chromium/WebKit compatibility, isolated screenshot artifacts, per-test timeout, and regression data collection. Hardware-level device QA is separate and cannot be claimed from simulated-browser tests.

## CI speed rules for future AIs

- **Do not run full browser QA locally first** when editing one minigame. Use fast Node preflight and open the PR; GitHub will test affected browsers.
- **Do not test unrelated games** to confirm a purely local update, unless a shared dependency was actually modified, an unknown impact exists, or the impacted tests identify a regression.
- **Do not fetch/install Playwright for docs-only or Node-only preflight**. For browser checks, the selected CI shards handle pinned dependencies.
- **Do not run sequentially what can run concurrently**. Validation and browser shards should use the planner and Actions' parallel jobs.
- **Do not wait for unrelated completed checks**. Use actual logs of the failed job. Preserve the successful results unless changes to the commit require a new run.
- **Do not hardcode the number of shards** or add a test to every game. Every new `tests/*-browser.cjs` must be registered with `areas`, browsers and estimated seconds. Shard count remains bounded by `minShards`, `targetSecondsPerShard`, `maxShards`.
- The weekly full run is insurance against unexpected game-to-game interactions. Full tests on a merged main commit also confirm release integrity; a main failure is a release bug, not permission to claim success.

## Useful commands

```sh
# Safe static and CI preflight (no browser download)
node scripts/check-javascript.cjs
node tests/ci-impact.cjs
node tests/ci-browser-scheduler.cjs
node tests/ci-browser-workflow.cjs
node scripts/ci-browser-scheduler.cjs --plan

# Relevant game example; replace with the actual affected tests
node tests/ufo-arena.cjs
node tests/dangerfield.cjs

# After opening a PR, GitHub automatically obtains the base/head diff and selects QA.
# For local impact inspection, use GITHUB_EVENT_NAME=pull_request,
# PR_BASE_SHA and PR_HEAD_SHA pointing to locally available Git commits.
```

Old baseline: serial browser QA took 9m55s ([run 42492490388](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/actions/runs/42492490388)); the existing weighted parallel design cut fixed coverage to about 4m36s ([run 42494415617](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/actions/runs/42494415617)). **Do not claim a new speedup number without measuring this new scoped pipeline.**

## Future maintenance

When a new minigame or browser test is added, update the manifest with ownership tags and regression tests; run the contract tests. If a game relies on other engines or shared files, expand the relevant area mapping deliberately. Do not rely on filename coincidence for hidden dependencies. Keep docs and CI code synchronized. A failed or ambiguous impact classification means full QA by design.

If main changes after the PR was opened, rebase/update and require the latest-head gates again before merge. Check branch protection for `validate` and `Browser QA / required gate`; protection configuration lives in GitHub settings and is not created by updating workflow files.
