# GAME-FRIENDS repository instructions for coding agents

All changes to any minigame arena, character SVG size, world dimensions, grid, physics hitbox, pathing, pickup, camera or controller must follow **[docs/MAP_SCALE_RULES.md](docs/MAP_SCALE_RULES.md)** (MAP-001…MAP-007).

Before editing: inspect the current `main` HEAD, the engine's specific tiers, `arena-scale.js`, existing shared character/physics code, and the engine's tests. Reuse existing functions; do not force all engines into the same world dimensions.

Before merging: update **[docs/MAP_SCALE_AUDIT.md](docs/MAP_SCALE_AUDIT.md)** with before/after measurements and rationale; run `node tests/map-scale-regression.cjs` for 1–12 counts, affected engine tests, smoke, and real host/controller Chromium/WebKit tests. Respect BOARD PARTY's independent camera/world. Do not change gameplay scoring, velocities, timers or bot behavior merely to make visuals appear uniform.

A PR must not merge on syntax-only evidence, missing CI checks or failed regressions. Preserve visual/physics consistency and mobile/iPad readability.

## Mandatory fast CI policy for every AI developer

Read **[docs/CI_TESTING.md](docs/CI_TESTING.md)** before creating or changing GitHub Actions jobs, running QA, or merging any PR. The `Verify static game` workflow uses **four parallel Chromium/WebKit browser shards plus Node validation**, shared Playwright binary caching, and cancellation of superseded **PR-only** runs. Keep the 17 required browser invocations and each game’s own physics and bot tests. New tests must be assigned to a shard and added to `tests/ci-browser-workflow.cjs` if they introduce browser commands.

**Mandatory gates:** run `node tests/ci-browser-workflow.cjs` for workflow changes, `node tests/map-scale-regression.cjs` for map/character changes, and check that `validate`, **all four browser-qa matrix jobs**, and every other required workflow are green for the **latest** PR commit. Never merge merely because the fast validation job passed. Do not suppress failures, skip WebKit, disable tests or cancel main-branch verification to make the workflow look faster.
