# GAME-FRIENDS repository instructions for coding agents

## FAST PR-FIRST WORKFLOW — mandatory for every future AI

**Never run the entire QA matrix before opening a Pull Request.** Check the latest `main` and existing PRs, implement the smallest scoped change, run syntax and a relevant game-level preflight, then **commit, push, and OPEN a non-draft PR immediately**. Creating a PR does not require completed CI checks. Let GitHub Actions test while the PR is open; merge only after all applicable required checks pass on the latest head and there are no conflicts.

**Do not spend time testing unrelated minigames on a single-game update.** PR QA automatically computes changed paths with `scripts/ci-impact.cjs`, chooses relevant Node and Chromium/WebKit suites from `ci/browser-tests.json`, and uses the weighted parallel shards in `scripts/ci-browser-scheduler.cjs`. Unknown/shared/core changes or uncertain diffs trigger **full** QA. Full coverage still runs on `main` pushes, weekly runs and manual dispatch. A docs-only PR skips Playwright installation, but retains stable success/failure checks. New tests must declare their impacted areas; never remove tests just to accelerate CI.

**Always read [docs/CI_TESTING.md](docs/CI_TESTING.md) before QA/PR/merge operations.** Run `node tests/ci-impact.cjs` and `node tests/ci-browser-workflow.cjs` for CI changes. Prioritize real failures, avoid repeated pushes that restart in-progress jobs, and never fake statuses, force-merge, or use `continue-on-error`.


All changes to any minigame arena, character SVG size, world dimensions, grid, physics hitbox, pathing, pickup, camera or controller must follow **[docs/MAP_SCALE_RULES.md](docs/MAP_SCALE_RULES.md)** (MAP-001…MAP-007).

Before editing: inspect the current `main` HEAD, the engine's specific tiers, `arena-scale.js`, existing shared character/physics code, and the engine's tests. Reuse existing functions; do not force all engines into the same world dimensions.

Before merging: update **[docs/MAP_SCALE_AUDIT.md](docs/MAP_SCALE_AUDIT.md)** with before/after measurements and rationale; run `node tests/map-scale-regression.cjs` for 1–12 counts, affected engine tests, smoke, and real host/controller Chromium/WebKit tests. Respect BOARD PARTY's independent camera/world. Do not change gameplay scoring, velocities, timers or bot behavior merely to make visuals appear uniform.

A PR must not merge on syntax-only evidence, missing CI checks or failed regressions. Preserve visual/physics consistency and mobile/iPad readability.

## Mandatory, scalable QA policy (ALL future AI agents)

Read **[docs/CI_TESTING.md](docs/CI_TESTING.md)** before coding a new mode, changing CI, running QA, or merging. The `Verify static game` workflow uses an **impact-selected weighted Chromium/WebKit matrix**, with its source of truth in **[ci/browser-tests.json](ci/browser-tests.json)** and a stable required check named **Browser QA / required gate**. Do NOT assume any fixed shard count. The number of shards adapts to **selected relevant tests** with `minShards`, `targetSecondsPerShard`, and `maxShards`. Keep every test registered; full coverage is mandatory for uncertain impact and on main/weekly/manual runs.

**When adding a minigame or browser test:** add its engine Node regressions; update `tests/map-scale-regression.cjs` and `tests/map-scale-browser.cjs` where appropriate; create `tests/<name>-browser.cjs` and register its supported browsers, **impacted `areas` tags**, and estimated seconds in `ci/browser-tests.json`. Unregistered `*-browser.cjs` files cause CI to fail, making the policy enforceable even if an AI does not read this paragraph. Prefer both Chromium and WebKit; explain intentional Chromium-only legacy exceptions in the registry. All new JS/CJS/MJS files are syntax-checked automatically.

**Before opening a PR:** only a quick syntax + relevant owned-game preflight is required; open the PR as soon as the branch is ready. **For CI changes:** run `node tests/ci-impact.cjs`, `node tests/ci-browser-scheduler.cjs`, `node tests/ci-browser-workflow.cjs`, and `node scripts/ci-browser-scheduler.cjs --plan`. **Before merge:** require `validate`, all selected `Browser QA / shard-NN` jobs (or validated no-browser-impact), the **Browser QA / required gate**, and other required GitHub workflows to pass for the **latest PR head**. No fake statuses, unknown-path bypass, `continue-on-error`, or cancellation of main checks. Use failing job logs and `ci-metrics` artifacts for bottlenecks.

## BOARD PARTY graph migration policy

Read [docs/BOARD_BRANCH_GRAPH_RULES.md](docs/BOARD_BRANCH_GRAPH_RULES.md) before changing BOARD PARTY nodes, edges, arrows or display IDs. Run the strict graph audit after any deletion; any stranded node, bridge or sword pair must be resolved without inventing edges, and every explicit or necessary cleanup deletion must be documented. Keep internal IDs stable independently of display names, validate collisions, and do not merge partial graph migrations.

## Zero-touch game folder discovery

Read **[docs/ADDING_MINIGAMES.md](docs/ADDING_MINIGAMES.md)** before adding or changing a minigame. Register games ONLY by adding their own `src/games/<slug>/manifest.json` and `game.js`. NEVER add per-game `<script>` tags to HTML, game filenames to `scripts/build-static.cjs`, or switch/case IDs to Core/BOARD/Controller for game discovery. Host, Normal Party, Board Party and controllers consume the generated `game-catalog.json`. Keep Core hashes stable for native game-only updates. Run `node tests/static-build-integrity.cjs` (includes a simulated unknown game directory) before PR/Merge.

## Minigame live roster ownership

Read [docs/PLUGIN_ROSTER_API.md](docs/PLUGIN_ROSTER_API.md) before adding a game or changing live scoreboards. All original 15 games own their custom `renderRoster` hooks, and new game IDs use the generic `getRoster` fallback without Core branches. Run `node tests/plugin-roster-ownership.cjs` before PR/Merge. Never change scoring or SVG layouts while moving roster code.

## BOARD PARTY map plug-in discovery

Read [docs/ADDING_BOARD_MAPS.md](docs/ADDING_BOARD_MAPS.md) before adding or editing a BOARD map. A new map is registered exclusively in `src/board-party/maps/<slug>/` with its manifest, both tier graphs and runtime entry. Never add per-map imports to HTML, `app.js` or `src/platform/board-runtime.js`. Keep the 302-node V10 map as the default; never replace it with the authored V6 base. Run `node tests/board-map-discovery.cjs` and BOARD regressions. Map hot-updates are metadata-only until the next BOARD session; never replace live BoardMap/BoardArt objects mid-session.

## BOARD engine source ownership

`src/board-party/runtime/board-party.js` is a generated lexical compatibility bundle; author changes in `src/board-party/core/`, `systems/` or `ui/` and regenerate with `node scripts/build-board-party.cjs --write`. Never insert named minigames or map-specific imports into BOARD source manifest. `node scripts/build-board-party.cjs --check` and `node tests/board-source-modules.cjs` must pass. This source split preserves the exact gameplay runtime; it is not independent per-feature network chunking. See [docs/BOARD_SOURCE_MODULES.md](docs/BOARD_SOURCE_MODULES.md).

## BOARD systems (items/spaces/events) zero-touch plugin ownership

Read [docs/ADDING_BOARD_SYSTEMS.md](docs/ADDING_BOARD_SYSTEMS.md). New BOARD systems are discovered from `src/board-party/plugins/{items,spaces,events}/<slug>/manifest.json` and loaded only when entering BOARD, not from `index.html` or `app.js`. Built-in item IDs and tile kinds remain reserved. Run `node tests/board-system-discovery.cjs` and complete BOARD regressions. Do not activate plugin updates mid-session.

## PeerJS core compatibility

Read [docs/CONNECTION_COMPAT.md](docs/CONNECTION_COMPAT.md) before changing peer messages. Production Host/Controller must agree on `coreHash` at join/welcome; never disconnect an existing room merely to update. Minigame code is Host-authoritative and pinned until the next round. Run `node tests/version-handshake.cjs` and browser QA.

## Single BOARD runtime location (no legacy root duplicates)

BOARD runtime scripts are owned only at `src/board-party/runtime/` and the canonical compressed BOARD source at `src/board-party/source/`. Do not restore any `board-*.js` to the repository root or add a second compiled bundle. The `src/board-party/core|systems|ui/` sources assemble the **one** runtime `src/board-party/runtime/board-party.js`. Maintain `scripts/build-board-assets.cjs`, `scripts/build-board-party.cjs`, `index.html`, `src/platform/board-runtime.js` and `scripts/lazy-game-scripts.cjs` together. Run `node tests/board-no-root-assets.cjs`, all BOARD tests and Chromium/WebKit Browser QA before merge.
