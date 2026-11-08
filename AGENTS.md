# GAME-FRIENDS repository instructions for coding agents

All changes to any minigame arena, character SVG size, world dimensions, grid, physics hitbox, pathing, pickup, camera or controller must follow **[docs/MAP_SCALE_RULES.md](docs/MAP_SCALE_RULES.md)** (MAP-001…MAP-007).

Before editing: inspect the current `main` HEAD, the engine's specific tiers, `arena-scale.js`, existing shared character/physics code, and the engine's tests. Reuse existing functions; do not force all engines into the same world dimensions.

Before merging: update **[docs/MAP_SCALE_AUDIT.md](docs/MAP_SCALE_AUDIT.md)** with before/after measurements and rationale; run `node tests/map-scale-regression.cjs` for 1–12 counts, affected engine tests, smoke, and real host/controller Chromium/WebKit tests. Respect BOARD PARTY's independent camera/world. Do not change gameplay scoring, velocities, timers or bot behavior merely to make visuals appear uniform.

A PR must not merge on syntax-only evidence, missing CI checks or failed regressions. Preserve visual/physics consistency and mobile/iPad readability.

## Mandatory, scalable QA policy (ALL future AI agents)

Read **[docs/CI_TESTING.md](docs/CI_TESTING.md)** before coding a new mode, changing CI, running QA, or merging. The `Verify static game` workflow has a **dynamic weighted Chromium/WebKit matrix**, with its source of truth in **[ci/browser-tests.json](ci/browser-tests.json)** and a stable required check named **Browser QA / required gate**. Do NOT assume it always has exactly four browser jobs. The number of shards grows automatically with estimated workload, bounded by `minShards`, `targetSecondsPerShard` and `maxShards`. Never omit or skip slow tests to reduce elapsed time.

**When adding a minigame or browser test:** add its engine Node regressions; update `tests/map-scale-regression.cjs` and `tests/map-scale-browser.cjs` where appropriate; create `tests/<name>-browser.cjs` and register its supported browsers and estimated seconds in `ci/browser-tests.json`. Unregistered `*-browser.cjs` files cause CI to fail, making the policy enforceable even if an AI does not read this paragraph. Prefer both Chromium and WebKit; explain intentional Chromium-only legacy exceptions in the registry. All new JS/CJS/MJS files are syntax-checked automatically.

**Before PR/Merge:** run `node tests/ci-browser-scheduler.cjs`, `node tests/ci-browser-workflow.cjs`, `node scripts/ci-browser-scheduler.cjs --plan`, relevant gameplay regressions, and `node tests/map-scale-regression.cjs` for map or character changes. Merge only after `validate`, every generated `Browser QA / shard-NN` job, the **Browser QA / required gate**, and every other required GitHub workflow pass for the **latest PR head**. No fake statuses, path-based bypass, `continue-on-error`, or cancellation of main checks. Read real job logs and per-test `ci-metrics` artifacts for bottlenecks.

## BOARD PARTY graph migration policy

Read [docs/BOARD_BRANCH_GRAPH_RULES.md](docs/BOARD_BRANCH_GRAPH_RULES.md) before changing BOARD PARTY nodes, edges, arrows or display IDs. Run the deletion preflight and reject proposed deletes that strand any node/bridge/sword territory. Keep internal IDs stable independently of display names, validate collisions, and do not merge partial graph migrations.
