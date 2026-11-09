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

Read [docs/BOARD_BRANCH_GRAPH_RULES.md](docs/BOARD_BRANCH_GRAPH_RULES.md) before changing BOARD PARTY nodes, edges, arrows or display IDs. Run the V9 strict graph audit after any deletion; any stranded node, bridge or sword pair must be resolved without inventing edges, and every explicit or necessary cleanup deletion must be documented. Keep internal IDs stable independently of display names, validate collisions, and do not merge partial graph migrations.

## Zero-touch game folder discovery

Read **[docs/ADDING_MINIGAMES.md](docs/ADDING_MINIGAMES.md)** before adding or changing a minigame. Register games ONLY by adding their own `src/games/<slug>/manifest.json` and `game.js`. NEVER add per-game `<script>` tags to HTML, game filenames to `scripts/build-static.cjs`, or switch/case IDs to Core/BOARD/Controller for game discovery. Host, Normal Party, Board Party and controllers consume the generated `game-catalog.json`. Keep Core hashes stable for native game-only updates. Run `node tests/static-build-integrity.cjs` (includes a simulated unknown game directory) before PR/Merge.

## Minigame live roster ownership

Read [docs/PLUGIN_ROSTER_API.md](docs/PLUGIN_ROSTER_API.md) before adding a game or changing live scoreboards. All original 15 games own their custom `renderRoster` hooks, and new game IDs use the generic `getRoster` fallback without Core branches. Run `node tests/plugin-roster-ownership.cjs` before PR/Merge. Never change scoring or SVG layouts while moving roster code.

## BOARD PARTY map plug-in discovery

Read [docs/ADDING_BOARD_MAPS.md](docs/ADDING_BOARD_MAPS.md) before adding or editing a BOARD map. A new map is registered exclusively in `src/board-party/maps/<slug>/` with its manifest, both tier graphs and runtime entry. Never add per-map imports to HTML, `app.js` or `src/platform/board-runtime.js`. Keep the 302-node V10 map as the default; never replace it with the authored V6 base. Run `node tests/board-map-discovery.cjs` and BOARD regressions. Map hot-updates are metadata-only until the next BOARD session; never replace live BoardMap/BoardArt objects mid-session.
