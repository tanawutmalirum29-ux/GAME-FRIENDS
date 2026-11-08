# GAME-FRIENDS repository instructions for coding agents

All changes to any minigame arena, character SVG size, world dimensions, grid, physics hitbox, pathing, pickup, camera or controller must follow **[docs/MAP_SCALE_RULES.md](docs/MAP_SCALE_RULES.md)** (MAP-001…MAP-007).

Before editing: inspect the current `main` HEAD, the engine's specific tiers, `arena-scale.js`, existing shared character/physics code, and the engine's tests. Reuse existing functions; do not force all engines into the same world dimensions.

Before merging: update **[docs/MAP_SCALE_AUDIT.md](docs/MAP_SCALE_AUDIT.md)** with before/after measurements and rationale; run `node tests/map-scale-regression.cjs` for 1–12 counts, affected engine tests, smoke, and real host/controller Chromium/WebKit tests. Respect BOARD PARTY's independent camera/world. Do not change gameplay scoring, velocities, timers or bot behavior merely to make visuals appear uniform.

A PR must not merge on syntax-only evidence, missing CI checks or failed regressions. Preserve visual/physics consistency and mobile/iPad readability.
