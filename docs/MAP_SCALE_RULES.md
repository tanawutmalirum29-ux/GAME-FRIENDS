# GAME-FRIENDS — Map Scale Rules (MAP-001–MAP-007)

**Mandatory for every existing/new NORMAL PARTY minigame, BOARD PARTY adapter, and changes to an arena.** Source of truth for geometry is world-space physics, not Canvas pixels. Do not replace a game's authored tiers with an arbitrary 1280×720 arena.

## Vocabulary and canonical transforms

- **World**: authoritative coordinates used by movement, contact, projectiles, pickup, scoring and bot paths.
- **Design viewport**: the game's 960×540 logical host canvas. The backing bitmap uses the host device pixel ratio; its resolution is NOT a gameplay dimension.
- **Render scale**: `scaleX = 960 / world.w`, `scaleY = 540 / world.h`. For world point `(x,y)`, screen point = `(x × scaleX, y × scaleY)`; inverse uses division.
- **Visual size**: avatar and object drawing radius in world units (some costumes have transparent padding).
- **Collision size**: physical radius, foot support, hit shape, swept path, and clearance; must be checked independently of visible padding.
- **Grid**: tile size in WORLD units, shared by drawing, movement, foot contact, bot paths and all tile lookups.
- **Bounds**: the actual navigable polygon/rectangle/circle, not necessarily the whole Canvas.
- **Camera**: viewport transform and camera offsets, especially separate BOARD PARTY camera/Controller zoom.

Shared math is `arena-scale.js` / `window.PartyArenaScale`, with `viewport`, `centeredGrid`, `tier`, `proportions`. **It does not choose gameplay tiers for an engine.** Engines with local world-dependent physics must explicitly scale their *matching* render and collision metrics (e.g., `state.unit = world.w / 960`). Keep all host HUD coordinates independent.

## Mandatory rules

### MAP-001 — Stable proportions
- Compare actor visual radius, hit radius, object size, playable area and tile size for *every* supported tier.
- A larger world drawn at 960×540 makes unscaled world sprites smaller on screen. If an actor's physical footprint is kept the same apparent size, scale both its drawing and hit geometry by `world.w / 960` in 16:9 worlds.
- If an arena is intentionally denser, show why in the audit and retain readable objects. NEVER expand a hitbox to include SVG alpha padding, weapons, glow or decorations.

### MAP-002 — Real capacity for 1–12 players
- Use an engine's own tier thresholds, geometry and density targets. Inspect every count from 1 to 12, notably 6 → 7, 4 → 5, 8 → 9.
- Confirm spawn positions do not overlap hitboxes, paths stay passable, players are not rendered off-stage, bots can reach objectives and pickups remain accessible.
- Large arenas should add useful play space without a blanket scale applied to unrelated games. Legitimate congestion is allowed in contact/territory games.

### MAP-003 — Tile-to-character ratio
- In gridded games, one tile's world geometry is the **single source** for its art, physical tile lookup, foot support, target selection, knockdown and bot navigation.
- FRUIT MEMORY: 4×4 / 5×5, **80 world units per tile**; boards 320×320 / 400×400, centered in 960×540; 13-unit player collision radius remains unchanged.
- COLOR SWITCH: 11×9 / 13×11, **44 world units per tile**, same 14-unit collision radius.
- SHOCKWAVE: separate authored 5×5, 78-unit tiles. Do not transplant Fruit Memory geometry.

### MAP-004 — Visual and physics move together
- Track `visualRadius / collisionRadius` and screen-projected dimensions at each tier. Physics uses world units. Any intentional visual overhang or swept lance/chain hit area must have a documented rule.
- When changing sprite size review movement bounds, collision radius, passability, punch/lance reach, projectiles, knockback, pickup radius, spawn separation and bot threat sensing; preserve time constants and intended on-screen speed.
- For COLOR CLAIM, trail stroke width and trail cut radius must share the same world scale. Map ownership MUST NOT depend on display zoom.
- For CHICKENS, chickens, players, carry geometry, pickups and physical radii must be scaled together; four conveyors in SHOPPING TIME are unrelated and remain unchanged.

### MAP-005 — Camera, renderer and HUD isolation
- Keep host logical field 960×540 (16:9) with DPR-sharp Canvas. Use `ctx.save/restore` around transforms; screen-to-world hit handling must use inverse transforms.
- On iPad, phone landscape, and the phone/controller camera, avoid crop/letterboxing of playable actors and objects, HUD displacement, unexpected tile-edge rounding, distorted circles, and rescaling that affects physics elapsed time.
- FRUIT MEMORY side-screen housings must be visible from the start. During the shared 3s prestart countdown, both screens stay blank orange while humans/bots can move. Memorization begins only after the host countdown.
- BOARD PARTY is separate: roads, pads, bridges, turning allowances and camera transforms follow its own gameplay world, not NORMAL PARTY map tiers.

### MAP-006 — Reuse shared geometry without flattening gameplay
- Extend `PartyArenaScale` for pure geometry operations only. Keep per-game `world`, `unit`, grid size, collision radius and camera settings in their own engines.
- No global CSS scale, no common 1280×720 world, and no duplicate incompatible transform utility.
- Loading changes must cover `index.html` and `scripts/build-static.cjs` so Amplify versioning and offline updates load the same code.

### MAP-007 — CI and regression protection
- Run `node tests/map-scale-regression.cjs` and each affected engine's existing tests, plus `node tests/smoke.cjs`.
- All **15** current NORMAL PARTY engines (including GLADIATORS) plus BOARD PARTY must be checked for player counts 1,2,…,12; regression test must assert tier geometry, grid ratios, and bounds/spawn contracts, with game-specific tests owning detailed scores/AI.
- Run real Chromium + WebKit host/controller browser suites and examine mobile/iPad layouts before reporting a full visual pass. A syntax-only pass is insufficient.
- For each changed engine, update `docs/MAP_SCALE_AUDIT.md` with real before/after values, tests, tradeoffs and reasons for non-changes. Do not merge with failing checks, pending required QA, or unexamined physics changes.

## Acceptance checklist for AI developers

Before committing: confirm each existing map tier, world-to-screen scale, SVG dimensions, collision/hit/pickup footprint, traversable bounds, 1–12 spawn positions, bots, game objective and HUD. Test exact 6→7 and other tier boundaries. Record screen-projected sizes, and explicitly justify any remaining density or visual-scale difference. Update `AGENTS.md` references if files or workflow change. Merge only after CI and browser checks succeed.
