# GAME-FRIENDS — Global Map Scale Audit

**Baseline inspected:** `main` at `513f89664537afe4e3d25c37baeab40c1e3a900c` (2026-11-08).  
**Working branch:** `refactor/global-map-scale-20261108`.  
**Viewport:** 960×540 host design coordinates, scaled to device DPR. Size numbers below are **world units** unless explicitly labeled **screen**.

**How to interpret a non-change:** Some modes deliberately shrink actors on screen as the whole world grows, while keeping collision and art in the same world coordinate frame. This is NOT automatically a bug. A test of every supported count, on-screen readability and route accessibility still applies.

### COUNTDOWN DROP, COWBOY, CANNON and SHOCKWAVE HUD/controls audit (2026-11-12)

The 960×540 logical Host viewport, DPR scaling, all arena tier dimensions, collision/hitbox footprints, tile geometry and rendering quality are unchanged. COUNTDOWN DROP retains its 4×3 (1–6 players), 5×4 (7–12 players) floor and 45 s solo clock; multiplayer has no clock and now sets `round.remaining=null` to select the existing shared Host survivor-count badge. No UI duplication.

COWBOY CROSSFIRE and CANNON CHAOS preserve existing world sizes, projectiles, turn rates, cooldowns, knockback, physics and hitboxes; directional joystick/D-pad input is an additional edge-triggered fire action (A/B/C retained). SHOCKWAVE stays 5×5 with 78-unit cells, avatar radius 29, body radius 13, human speed 177 and unchanged 1–12-player bounds. Bot warning reaction is shortened from about 0.18–1.88 s to 0.04–0.14 s, movement multiplier improves from .88 to .95 (relative to 177 units/s), its safe-target selection excludes exploding/warning tiles, and the last blast ignition occurs 0.28–0.30 s instead of 0.40–0.42 s (plus 0.08 s afterglow). All warning-route safety and original tile counts are retained.

### SHOCKWAVE free-roaming bots and restored reaction (2026-11-12)

Previous behavior: bots returned zero movement outside warning/explosion and moved only when visibly threatened, making them stand still throughout the countdown, between waves and while safe. The previous patch also shortened hazard reaction to 0.04–0.14 seconds.

New behavior: each bot walks toward seeded, nearby tile waypoints continuously, including during countdown, PREPARE, NEXT_WAVE and nonthreatened WARNING/EXPLOSION phases. Upon actual danger contact, bot **reaction time is restored exactly** to `0.18 + random * min(1.7, warningDuration * 0.83)` seconds; it continues regular roaming during that reaction delay, then seeks safe ground. Already-reacted bots avoid targeting warned tiles. Existing 0.28–0.30-second ignition cascade and 0.08-second afterglow remain unchanged.

MAP checks: the 5×5 arena, tile size 78 world units, board 390×390 at (285,116), Host viewport 960×540, avatar boundary radius 29, collision radius 13, human walk speed 177, bot walk speed multiplier 0.95, attack/hazard contacts, and the 1–12-player limits remain unchanged. Bot waypoints are virtual steering positions; no change to physics coordinates, grid resolution, DPR, SVG assets or camera. Node regressions now cover free wandering without hazard, reaction-delay behavior, map bounds, warning and explosion timing. Required CI and browser checks gate merge.

## Findings and changes

### Shared avatar mounts (2026-11-12)

Branch: `art/rope-hat-svg-2077-2078`; main source baseline: `34a22766949bb4f696be88062ad0a6294a5148eb`.

**Source dimensions only, not runtime measurements. No QA, tests, syntax checks, build, browser or CI were run for this change, as explicitly requested by the user.** The next AI owns visual/physics verification and merge. Earlier evidence elsewhere in this document does not validate this branch revision. See [handoff](SHARED_AVATAR_HANDOFF.md).

| Engine | Before | Authored replacement and retained geometry |
|---|---|---|
| LAWN MOWER | SVG driver head diameter 24; fallback had an independent skin-tone head | Shared 52-unit avatar × `.9` = 46.8-unit padded sprite at local seat `(0,12)`; 46.8 / 35.1 logical screen pixels in the 960 / 1280 worlds. Open rear seat and shorter engine hood stay inside the existing 44×62 chassis; radius 17, blade half-width 15 and front range 16–28, speed 50.75, grass/nav detail and both tiers unchanged. |
| COLOR CLAIM | Baked driver head diameter `18 × 2r/44`; image-loading path used a different full actor scale | Shared sprite `52 × 2r/44` at car-local `(-4,0)`; r = `13 × world.w/960`, giving approximately 30.73 logical screen pixels in either tier. Padded vehicle SVG remains 64×64, physical bumper diameter `26 × unit`; capture cells, movement and hit geometry unchanged. |
| ICE RACE | Baked driver head diameter 24; fallback drew its own skin-tone face | Shared 52 × `.72` = 37.44-unit sprite at sled-local `(-4,0)`, projected to 37.44 / 29.952 / 24.96 screen pixels for the 960 / 1200 / 1440 worlds. Existing 48×36 hull, radius 14, road half-widths 54 / 62 / 74, 1–4 / 5–8 / 9–12 tiers, fall/spin/fade and respawn physics retained. |
| UFO ARENA | Opaque 14.4 × unit dome with an unrelated face | Shared 52 × `.6 × unit` = 31.2 logical screen pixel pilot in an open cockpit, inside the original bob/alpha transform. Saucer, bumper balls, radius `17 × unit`, world dimensions, collisions and thrust unchanged. |
| GHOST ATTACK | Converted players and NPCs both used a 54 × 1.26 sprite independent of the shared avatar | Converted players use shared 52 × 1.26 = 65.52-unit padded art plus a separate translucent robe/halo; NPC sprites remain 54 × 1.26. Shared player identity and headwear are retained, with ghost scale factor 1.26 and red name. Player collision radius 16, infection/attack logic, courtyard worlds and navigation unchanged. |
| COWBOY CROSSFIRE / SCOOP RUSH | Shared character plus an unconditional cowboy hat / temporary mutation of rider `p.y` | Cowboy shared 52-unit art remains, with no forced hat overlay. Scoop shared 41.6-unit rider and −8 saddle offset remain; only Canvas is translated. Gun, bear, physics, movement and scoring unchanged. |

The shared avatar accepts an optional local `heading` in radians and `shadow:false` for mounts. Defaults, canonical SVG dimensions and image-loading fallback geometry are unchanged. All driver render paths forward the complete player object. Equipment is painted beneath the avatar without a head/cockpit clipping mask; cosmetic padding is never a collider. Keep 960×540 logical rendering, native DPR and each map's existing world transform. All screen dimensions above are arithmetic from source constants and require the next AI's latest-head browser evidence before merge.

### SCOOP RUSH overhead polar bear (2026-11-12)

Follow-up on `art/rope-hat-svg-2077-2078`, after syncing the previously integrated work from main `9295057dbbcc6fa502fcaad1ad4cf368dc4b01d7` (PR #264). This supersedes the SCOOP RUSH seat/projection entry above; it does not change other mounts.

**Authored source dimensions, not a visual test or runtime measurement. No game, browser, build, syntax check, QA or tests were run for this follow-up.** The next AI owns validation and merge; prior integration evidence is not evidence for this bear revision.

| Item | Before | New authored projection |
|---|---|---|
| Bear camera | Side profile, horizontal left/right mirror from `p.face`; all legs below the body | True overhead back/spine, paired ears and tapered forward muzzle, four paws beside the shoulders/hips; −Y is forward, rotated with the full `p.dir` vector |
| Bear art envelope | Horizontal body ellipse 33×21, head displaced +14 on X, feet in one screen-bottom row | Artwork contained in an approximately 46×60 world-unit local envelope `x: −23…23`, `y: −32…28`, including stroke/foot motion allowance before rotation; approximately 46×60 / 34.5×45 logical screen pixels across the two tiers |
| Saddle/rider | Fixed screen-space offset `(0,−8)`, unrelated to bear facing | Mount-local `(0,6)` using `BEAR_MOUNT.seatY`; the bear and shared rider use one Canvas rotation, with rider `heading:0` to prevent double rotation |
| Rider size | Shared 52 × `.8` = 41.6 world-unit padded sprite | Same 41.6 world units: 41.6 / 31.2 logical screen pixels. Holding pose, original player identity, and shared cosmetic path; no bear-head or cockpit clipping mask |
| Locomotion/ground | Side-profile body bob and vertical line of legs; screen-bottom shadow | Opposite diagonal paw pairs move ±1.6 in local Y; fixed dorsal saddle and a broad shadow under the body. Depth sorting uses ground anchor `p.y` |

The longer forward/back silhouette is decorative mount overhang needed for an overhead animal, not a larger collider or push range. Player radius **15**, maximum speed **165**, scoop base radius **22**, five initial scoops per player, collision/merging/bot rules and 50/70-second timers remain as authored. World tiers stay **960×540 (1–6)** and **1280×720 (7–12)**; rink bounds, host DPR, full Canvas quality and shared avatar dimensions are unchanged. No rendering-side writes to `p.x`, `p.y` or `p.dir`. Next-AI checks should include eight directions, idle/walk transitions, all hats, pushing near scoops/edges, layer order and 6→7 readability before merge.

### Previous map scale decisions

| Engine | Before | After / decision | Underlying reason / invariant |
|---|---|---|---|
| **FRUIT MEMORY** | 4×4 and 5×5 both 400×400; cells 100 vs 80; board origin (280,104) in both | **Fixed:** 4×4 = 320×320, (320,110); 5×5 = 400×400, (280,70); both tile=80, hit radius=13 | Prior 4×4 tile/actor ratio drift. Spawn, feet, bots all already derive from board. Panels are visible through prestart; countdown movement exists already. |
| **COLOR SWITCH** | 11×9 ×44 = 484×396; 13×11 ×41 = 533×451 | **Fixed:** 11×9 ×44 = 484×396; 13×11 ×44 = 572×484, x194/y28; actor hit radius 14 | Previous 7+ tier shrank every cell. Territory drawing, swept pickup and bot tile lookup share `s.size`. |
| **CHICKENS** | 960×540, 1200×675, 1440×810; player hit radius 15 and free bird hit radius 8.3 *world* in all tiers; 15/12/10 screen px player | **Fixed:** same worlds and 4/8-player tier thresholds; `unit` 1/1.25/1.5; player radius 15/18.75/22.5 world = **15 screen px**; chicken radius 8.3/10.375/12.45 world = **8.3 screen px** | Existing transform shrank actors/interaction zones for crowds. Draw sprites and carried chicken, movement speed, pickup, collision, threat ranges, and clearance with the same tier unit. Chicken total, pen ownership and match times unchanged. |
| **COLOR CLAIM** | 960×540 /1280×720; movement and physical radius scaled by 4/3, but SVG and pickup/trail hit radius were not | **Fixed:** sprite `scale: s.w/960`; trail collision 5→6.67 world in large, pickup 27→36 world, art width/shadow scaled. Physical player radius 13→17.33 world for large as already coded | Before, large-world physics player radius projected to 13px but artwork shrank to 75%; trail and freeze interaction ranges also shrank. Capture grid and scoring remain world-authoritative. |
| **SNOW BRAWL** | Five island radii **188,216,244,276,312**, according to 1–2/3–4/5–6/7–9/10–12; body radius 19.2 world, snowballs 12–44 world | **Retained:** intentional tier-dependent island view zoom `min(1.2,226/baseRadius)`; 10%-inset spawns, snowball hit geometry, shrink and sudden death unchanged | A changing view of a single island is gameplay design; blanket `unit` would alter snowball/push physics. Existing dedicated tests verify ball impacts, spawn and death. |
| **KNIGHT MATCH** | 960×540 /1100×619 /1250×703 /1440×810 /1600×900; rider scale 0.7, lance-tip radius 5.6 world | **Retained:** authored 5 tiers and swept silver lance-tip hitbox, balloon radius/score untouched | Entire rider, lance collision and balloons share world-to-host transform. A global resize would break exact tip-vs-balloon contact. |
| **LAWN MOWER** | 960×540 /1280×720, chassis 44×62 world, radius 17 world, cut half-width 22 world | **Retained:** lawn and tracks use world geometry and renderer scales the whole world | Chassis and physical cutting swath agree. Wider area in crowded tier is deliberate; changing only art would decouple mowing path. |
| **WITCHING SNAKE** | 960×540 /1280×720, playable radii 292×222 /490×300, body radius 12 world, trail radius 3.4 | **Retained:** different trail-length caps **520 / 760** and arena dimensions by design | Broom, lethal trail and boundary in world units; world-to-screen transform shared. A forced screen-size hitbox would change tail-cut gameplay. |
| **GHOST ATTACK** | 1080×608 /1280×720, custom authored collision courtyards | **Retained:** authored rectangles and bot obstacle navigation are used together | Existing 1–12 bot/path and browser suites check actual courtyard geometry. Do not independently scale obstacles without navmesh. |
| **ICE RACE** | 960×540 /1280×720, road half-width **45 / 82** world, sled collision radius 14 | **Retained:** large tier projects to 61.5px road half-width vs 45px small, intentionally wider for more overtaking | Two tiers keep same sled body drawing/collision transform; drift speed and rebound physics left unchanged. |
| **SHOCKWAVE** | 5×5, tile 78, board 390×390 at (285,116), foot radius 11 and explosion avatar reach 29 | **Retained:** authored 5×5 fixed arena and physically assessed explosion overlap | No 7+ alternative map. Safe tile counts and death timing are handled by dedicated tests. |
| **BOULDER BASH** | 960×540 single world, physical body radius 15; horizontal rock spawn/despawn uses screen bounds | **Retained:** full-width single-world runway, no tier mismatch | Game intentionally has fixed visibility/boundary; separate test covers rock generation and offscreen disappearance. |
| **SHOPPING TIME** | 960×540 /1280×720, `unit` 1 /4/3; four conveyors, player radius 15×unit, cart radius 17×unit, `actorScale=1.08×unit` | **Retained:** screen-projected collision and visuals already scale together | Four lanes regardless of count; large world extends walkable sides and checkout space. |
| **PIZZA TIME** | 960×540 /1200×675 /1440×810 /1600×900, `unit` 1/1.25/1.5/1.667; radius 17.5×unit, actorScale 1.12×unit | **Retained:** world-scaled chefs, surfaces and collision aisles already consistent | World geometry, ingredient stations and A* walkability share unit; no reason to risk order gameplay. |
| **GLADIATORS** | 960×540 /1280×720, physical ball radius 21 and chain 114 world | **Retained pending targeted gameplay review:** no grid and authored chain space scales as one world | Preserve chain physics and ball collisions; do not resize decorative chain links independently of the physics solver. |
| **BOARD PARTY** | Separate large expedition map; nodes and roads/bridges drawn with local camera zoom | **Retained:** independent topology/camera; no NORMAL PARTY tier applied | Board node paths, 88-world-unit road/pads, turn lanes and phone camera have independent test suites. |

## Regression and release evidence

- Geometry code: `arena-scale.js` (pure forward/inverse transforms, tier selection, centered grid and ratio diagnostics).
- Automated contracts: `tests/map-scale-regression.cjs` covers **15 engines × 12 player counts** plus **BOARD PARTY × 12 counts**; exact fruit, switch, chicken, claim, shopping, pizza, snow and shock invariants. All existing tests still required.
- Delivery: `index.html` loads shared math first; `scripts/build-static.cjs` includes it in Amplify static build.
- Existing browser QA: `tests/party-arenas-browser.cjs`, `tests/farm-ice-browser.cjs`, `tests/board-browser.cjs`, `tests/mobile-host-lobby-browser.cjs`, `tests/ghost-courtyards-browser.cjs` and WebKit variants.
- **Verified pre-integration GitHub Actions:** [Verify static game run 42490735186](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/actions/runs/42490735186) completed successfully on PR head `4ceb355338875d3990dc4cf5be38c2d5f7928867`. Both `validate` and `board-browser` jobs passed. The dedicated COLOR SWITCH, Fruit Memory / Shockwave, HUD, and GLADIATORS workflows passed on this same head.
- **Node tests:** the verified `validate` job passed `tests/map-scale-regression.cjs` on 15 engines × 12 counts and BOARD PARTY × 12 counts (192 setups), plus the existing combat, physics, bot, scoring, avatar, farm/ice, fruit, switch, ghost, board, controller and build smoke suites.
- **Real browser tests:** the verified `board-browser` log contains `MAP SCALE BROWSER PASS: chromium 192 live HOST draws` and `MAP SCALE BROWSER PASS: webkit 192 live HOST draws`; includes mobile viewport spot checks at 844×390. Other browser suites cover farm/ice pickups, knight piercing, ghost routing, pizza serving, BOARD PARTY zoom and host/controller UI on both engines.
- **Current integration:** the PR branch merges `main` at `1ba1d3de489a56a8dd12293435ba293a3a2da197` (GLADIATORS articulated-link changes). Require a new all-green set of PR checks **on the integration head itself** before merging. Results on the earlier head are not sufficient evidence for the merged revision. Live state: [PR #183 checks](https://github.com/tanawutmalirum29-ux/GAME-FRIENDS/pull/183/checks).
- **Limits:** A geometry test alone cannot prove visuals on every physical iPad/phone. Report Chromium/WebKit separately and leave any unverified device-specific observation explicit.

## Mandatory gate

Do not merge until `verify.yml` tests and browser checks finish without failures. If any engine remains visibly too small, reports inaccessible gaps, or colliders misregister, add exact measured before/after metrics and update this audit before merging.


### BOARD PARTY canonical island tour audit (2026-11-09)

- Board physical road and bridge deck: 88 world units before and after.
  Walkable half-width: 44, with 10-unit avatar clearance, unchanged.
- 17 distinct islands remain; source playable checkpoints 302 (unchanged).
  Directed edges: 321 → 318; removed the three loops returning to the
  same tile while preserving other alternate routes and all territory pairs.
- Meadow n51→n108 bypass cut: replaced with a n51→Meadow ring→n56
  forward loop; no 46-checkpoint skip. Workshop and Iceberg receive one-way
  entry and exit routing instead of using same-tile circulation.
- Two additional raised-bridge crossing markers identify geometry where
  the Workshop viaduct crosses inbound/outbound Meadow connections; other
  original two markers remain. The crossings do not connect in graph physics.
- Harbor/Gingerbread footprints shrink to match three/two surviving nodes;
  all other original node sizes and walking collision radii remain unchanged.
- Static browser simulations for 1–12 players, WebKit and Chromium required
  on final PR head. Mobile/iPad physical device behavior is not certified by CI.

- canonical finishing art pass: two landmark positions are immutable (Harbor lighthouse 2800,5260; Gingerbread cottage 6220,5490); bridge drawing now prioritizes elevated arched decks over the lower lanes, still 88 units wide. Every board fork receives a sign with measured shortest node count and upcoming hazard/healing/lucky tile presence computed from the actual converging routes. Bot branch choices use cached whole-route cost by HP bracket rather than the first tile alone.


### Fidelity-preserving DINO PANIC / DANGERFIELD / UFO ARENA repair (2026-11-11)

- **Project-wide:** unchanged host 960×540 logical viewport, DPR-sharp backing Canvas and SVG quality. No cross-game image resolution downgrade, no global world-size overrides; see top of README and AGENTS.
- **DINO PANIC:** original navigation grid **10 → 16 (previous lag workaround) → 10** restored; obstacle/map validation grid stays **8**. Runner radius **15**, speed **130**, both tier world corridors and obstacle dimensions unchanged. Algorithmic performance fix: a bounded, short-lived local Dijkstra field is shared among bots within each corridor section, rather than recalculating the full route individually. The engine no longer runs the separate duplicate player-pair collision solver after its shared PartyCharacters solver. SVG art and Canvas resolution unchanged.
- **DANGERFIELD:** grid cell **12**, mine art radius **20.8**, hazard radius **33.8**, original small/large field geometry and time limits unchanged. Replace the long straight lane with a single nonbranching hairpin spine crossing the full arena height repeatedly; place decorative crates off the path so the road stays reachable. Route-turn and maximum-straight-run regressions cover both sizes. Bomb sizes unchanged.
- **UFO ARENA:** world tiers **960×540 / 1280×720**, ship radius **17×world unit**, bumper geometry and SVG unchanged. Restored ship restitution (**0.4 → 0.82**) and wall restitution (**0.38 → 0.7**), retained stronger static corner/center bumpers, removed multiplier from ship-to-ship impulses to avoid creating energy in cascades, bounded collision speed to **600×unit**, and preserved short-lived rebound momentum. No image-quality reductions.
- **Verification requirement:** game-level regression and required PR Chromium/WebKit gates on the latest PR head before merging. Node tests are not substitutes for physical iPad visual FPS measurements.

## Punch-v2 / DINO PANIC integration audit (2026-11-11)

| Component | Before | After | Geometry / fidelity contract |
|---|---|---|---|
| Shared overhead punch | Canonical 64×64 SVG drawn at 52×52 world units, plus separate strike line | Sixteen hand-authored padded 96×112 SVG atlas cells drawn into rect (−39,−52,78,91) around the SAME player origin with 52/64 = 0.8125 world units per SVG unit; frame sampled over 480 ms | Padding is transparent accommodation for hand extension, NOT an enlarged character or collision hitbox. Shadow, label, facing-lock and physical body radius remain unchanged |
| Punch collision timing | Windup .18 s, active .10 s, recovery .20 s; cooldown 1.05 s; normal stun .8 s | Unchanged; sprite samples authoritative attackRemaining without new clock or hit events | No second legacy strike line when SVG avatar is drawn |
| DINO PANIC 1–6 / 7–12 | Host world projected into 960×540 logical Canvas; world actor radius 15, speed 130; 8-unit track validation and 10-unit bot path grid | Unchanged gameplay dimensions and collision scale; revised spatial and bot buffers, cached SVG rasterization, interpolated camera/obstacle positions | Neither logical host resolution, DPR, bot navigation grid, validation grid, nor atlas detail is reduced for FPS |

**Verification boundary:** On the integration branch the attached DINO PANIC package was byte-for-byte checked against uploaded ZIP blobs before each remote update. ZIP-local 1/2/6/7/12 runner simulation smoke passed with original 8/10 world-unit grids (measured 300 updates each). Full repository CI/browser checks remain the authoritative requirement before merging, and physical iPad hardware QA is separate. Do not infer a physical-device FPS improvement from these Node checks.

## DINO PANIC shadow plate removal / five-game punch audit (2026-11-11)

**Reported visual defect:** giant translucent dark areas appeared as a left-side plate near the dinosaur and continuous strips next to the upper/lower jungle edges. These were NOT occlusion or gameplay mechanics. They were the renderer's deliberately painted 360×200 elliptical dinosaur shadow, 90×400 snout-gradient rectangle, two full-width 16-unit corridor edge overlays, and a repeated 18-unit-wide dark strip baked into each `forestSVG` tile. All of these continuous dark plates have been removed from `render.js` and `dino-art.js`. Individual obstacle and player ground-contact shadows remain.

**Unchanged:** Both DINO PANIC world tiers; 960×540 logical host, full DPR backing pixels; 130-unit runner/dinosaur speed, 15-unit character radius, 8-unit map-validation grid and 10-unit bot-navigation grid. No physics, path, asset or actor scale was altered.

**Punch audit of all 26 discoverable minigame engines:**

| Classification | Minigames | Rendering decision |
|---|---|---|
| Hand punch (5 games) | CHICKENS, COLOR SWITCH, COUNTDOWN DROP, FRUIT MEMORY, GHOST ATTACK | All use the canonical `PartyPlayerAvatar` punch-v2, 16 SVG frames. CHICKENS, COLOR SWITCH, FRUIT MEMORY and GHOST ATTACK keep the original `PartyCombatMotion` timeline. COUNTDOWN DROP now maps its own windup/active/recovery phases to punch-v2 frames without altering its 0.12/0.10/0.18s hit timeline, 0.65s cooldown, 1.4s stun or immunity/knockback. No legacy `drawFist` call or duplicate arm. |
| Unique weapon/attack (8 games) | CANNON CHAOS, COWBOY CROSSFIRE, GLADIATORS, KNIGHT MATCH, MOLE MAYHEM, PIZZA TIME, SNOW BRAWL, UFO ARENA | Preserve their original weapon/throw/ram mechanics. A hammer in MOLE MAYHEM and a lance in KNIGHT MATCH are not unarmed punches. PIZZA TIME is a carry/serve action, not punch. |
| Movement, capture, survival or other non-punch action (13 games) | BLOCK BREAKERS, BOULDER BASH, CANDY CHAOS, COLOR CLAIM, DANGERFIELD, DINO PANIC, DYNAMITE, ICE RACE, LAWN MOWER, SCOOP RUSH, SHOCKWAVE, SHOPPING TIME, WITCHING SNAKE | No standard hand punch; do not force an irrelevant punch animation. |

**Scale contract:** Both shared and custom-timed punches render around the same physics origin with the original 52/64 = 0.8125 unit-per-SVG pixel scale. The transparent padded atlas remains 96×112 SVG units, with draw destination (−39, −52, 78, 91); no hitbox grows to fit the fist. A COUNTDOWN DROP animation is visual state only; hit tests and gameplay authority remain in that engine.

**Verification:** Dedicated Node contracts in `tests/avatar-topdown.cjs` and `tests/dino-panic.cjs`, plus required latest-head Chromium/WebKit browser and CI gates. Physical-device visual validation remains a separate limitation.


### 2026-11-11 — DINO PANIC obstacle behavior clarification

- **Only rocks are immovable**: solid circular rocks cannot translate, roll, spin, or receive movement impulses, including direct `moveObstacle` and `impulseObstacle` calls.
- Crates and logs retain contact-normal pushing, offset torque, damped inertia, sliding, interpolation and their current collision rules. Fences remain immovable as before.
- Keep existing circular rock collisions and spatial indexing; preserve the 8-unit map-validation grid, 10-unit bot-navigation grid, high-fidelity rock SVG, two world tiers and device-pixel-ratio backing resolution.
- Regression: 48 fixed steps of player pressing against a rock (no displacement or spin), direct impulse/move guards, and an independent crate shove assertion.


## 2026-11-12 — COLOR CLAIM authoritative Polygon territory

- **Before:** 10-world-pixel owner cells supplied the authoritative claim and cut boundaries, so the rendered outline could have staircase edges even when the player trail used floating-point coordinates.
- **After:** the source of truth is `s.terr[slot]`, stored as real polygon rings in world coordinates. Union, difference, intersection, connected-component retention, capture, loss, ownership queries, spawn and area scoring all read the polygons. Vertices snap to a **1/64 world-pixel** robust-predicate lattice; trail simplification tolerance is **0.3 world pixels at 960 width**. The old 10-pixel cell index is a **derived compatibility view**, not an authority for gameplay.
- **Scale unchanged:** small tier (1–6 players): **960×540 world**, 30-unit boundary margin, 900×480 playable rectangle, character radius 13 and trail width 5. Large tier (7–12 players): **1280×720 world**, 30-unit boundary margin, 1220×660 playable rectangle, character radius and physical trail width scale by 1280/960, preserving matched on-screen appearance/hit geometry. Host 960×540 logical Canvas and DPR-backed sharpness are unchanged. No render precision or geometry was reduced for performance.
- **Loading:** `src/games/color-claim/game.js` imports `territory-geometry.js` before `color-claim.js`. Both are inside the game-owned immutable catalog bundle, so this is a single-game versioned patch, not a core-wide cache reset.
- **Focused evidence:** `node tests/color-claim.cjs` includes 13 Polygon checks covering all 1–12-player starts, score/cut union, fractional closed trail, holes, disconnected islands, legacy raster non-authority, freeze, finite bots, drawing, and full 40/60-second bot matches with up to 12 bots. Host Chromium/WebKit visual QA must still be demonstrated by required PR CI; Node preflight alone does not prove browser rendering.

### BOARD PARTY — Tile clearance and uninterrupted manual walking (2026-11-13)

- World geometry, logical 960×540 Host/DPR sharpness, 302 nodes, 318 directed routes, 17 islands, 88-unit road deck, tile radius 44 (53 for a fork accent), walking lane half-width 34 and WALK_SPEED=240 are unchanged. No rendering/grid/sprite quality reduction.
- Previously eight distinct node pairs were under 112 world units apart (minimum 29.2), including two routes merging on top of each other. Nine **existing bridge checkpoints** are moved, retaining all graph IDs/edges and island/bridge roles. The all-pairs minimum after correction is **116.36** units. Art positions, road segments and overpass markers follow their authoritative node coordinates.
- Two previously documented geometric path crossings remain; no new crossing or alternate route was introduced.
- Forced one-way checkpoints now continue in the same game tick when a joystick is still aligned, instead of requiring a fresh 0.16s input hold at every pad. Fork debounce is now 0.08s; world-position projection is carried through sharp turns without clamping negative approach coordinates to zero. Gentle forward steering assist covers near-sideways thumb angles while pure sideways, backward and released inputs remain non-advancing.
- Regression coverage added for **all 302 tile-pair spacings** in `tests/board-map-layout.cjs` and for same-token two-edge walking, no positional snap, exact step consumption and stick-release stopping in `tests/board-party.cjs`. Original camera, node topology, arrow direction, multi-player and map-scale checks remain required.
