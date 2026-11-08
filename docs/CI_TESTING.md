# GAME-FRIENDS — Fast, complete CI for every AI developer

**Required reading:** this file and `AGENTS.md` apply to every code-writing AI, coding agent, and human contributor. Optimizing a workflow must not silently weaken merge gates.

## Why the old QA was slow

The previous `.github/workflows/verify.yml` used one `board-browser` job to run the full Chromium + WebKit suite **sequentially**. On the verified 2026-11-08 run [42492490388](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/actions/runs/42492490388), the overall workflow took 9 minutes 55 seconds, with roughly 8 minutes 57 seconds of browser QA. The Node `validate` job finished much earlier, but CI stayed waiting for the single long browser job.

## Required architecture

Keep `validate` and `browser-qa` independent so Node geometry, physics, bot and scoring tests run in parallel with actual browser rendering. The browser job is a GitHub Actions four-way **matrix** with `fail-fast: false`, keeping every original test:

| Matrix shard | Checks (Chromium + WebKit where supported) |
|---|---|
| `board-controller` | BOARD PARTY host and controller, phone lobby, lobby stability, BOARD PARTY startup and camera |
| `farm-ghost` | CHICKENS / SNOW BRAWL / BOULDER BASH host rendering, GHOST ATTACK routes and world rendering |
| `pizza-arenas` | PIZZA TIME and SHOPPING TIME / KNIGHT MATCH / WITCHING SNAKE host rendering |
| `map-scale` | 15 NORMAL PARTY minigames × 1–12 player counts on both Chromium and WebKit (plus mobile viewport checks) |

The `node tests/ci-browser-workflow.cjs` guard runs **in the normal validation job** and checks that all 17 required browser commands are still present exactly once. When adding a browser test, put it in one shard, update the guard, and ensure it runs on both Chromium and WebKit unless the test is intrinsically single-browser (the dedicated `tests/board-browser.cjs` test is Chromium-only). Do not erase existing checks to meet a runtime target.

## Reusable browser setup

- Keep Node 22 and a **pinned** Playwright version (`1.62.1`) for repeatable browser behavior.
- Use `actions/cache@v4` for `~/.cache/ms-playwright`, with OS, architecture and Playwright version in the key.
- Keep `playwright install --with-deps chromium webkit`: a cached download alone does **not** guarantee OS libraries are installed.
- Set `NODE_PATH=/tmp/board-browser/node_modules`; derive `CHROME_PATH` from the installed Playwright executable in each browser step.
- Screenshot artifacts must include `${{ matrix.suite }}` in their names to avoid parallel artifact upload collisions.
- If Playwright version changes, change the install command, cache key and CI matrix regression guard **in the same PR**.

## Cancelling superseded work without losing main checks

The workflow uses:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

This cancels **old PR runs of the same workflow** when a new commit is pushed to that PR. **It never cancels main push verification.** A developer should push a coherent set of changes, not a stream of tiny commits that repeatedly restart the expensive browser jobs. Other workflows may add their own concurrency control, but must use a workflow-qualified key and protect `main` runs.

## How AI agents should work efficiently

1. Read the latest `main`, `AGENTS.md`, `docs/MAP_SCALE_RULES.md` and this guide before editing physics, sprites or QA.
2. Run fast local Node tests and syntax checks for the directly changed game before pushing. For world scale changes, always run `node tests/map-scale-regression.cjs`. For CI changes, run `node tests/ci-browser-workflow.cjs`.
3. Commit related changes together and open **one PR**. Do not push speculative fixes into `main`.
4. Inspect each matrix shard result, not just `validate` (a green Node suite does not certify the browser).
5. If a shard fails, read its actual job log and fix the underlying regression. Do not add `continue-on-error`, skip the test, blanket-skip WebKit, or fake CI status.
6. Wait for `validate` **and all four browser shards**, alongside other repository workflows, to finish green before merging.
7. If the base branch changes, integrate the latest `main`, rerun the resulting PR head and merge only with successful, up-to-date checks.

**Expected improvement:** parallel shards should reduce wall-clock waiting versus the old 9m55s serial browser job, but no particular runtime is guaranteed. Benchmark using real GitHub Actions elapsed time for the PR and update this file if the bottleneck changes. Job parallelism can increase total billed runner-minutes; the goal is faster feedback **without reducing coverage**.

## Permanent protections

- Keep CI on all PRs targeting `main`. Do not add blanket path filters that allow physics, art, game rules or shared JS changes to evade browser QA.
- Do not delete `tests/map-scale-regression.cjs` or `tests/map-scale-browser.cjs`.
- Keep 1–12-player coverage and the independent BOARD PARTY camera checks.
- Preserve existing game-specific tests for collisions, scores, elimination and bot behavior.
- When a new mode is added, extend both `tests/map-scale-regression.cjs` and `tests/map-scale-browser.cjs`, add its own engine regression tests, and document any new browser command in the matrix guard.
