# GAME-FRIENDS — Global Map Scale Audit

**Baseline inspected:** `main` at `513f89664537afe4e3d25c37baeab40c1e3a900c` (2026-11-08).  
**Working branch:** `refactor/global-map-scale-20261108`.  
**Viewport:** 960×540 host design coordinates, scaled to device DPR. Size numbers below are **world units** unless explicitly labeled **screen**.

**How to interpret a non-change:** Some modes deliberately shrink actors on screen as the whole world grows, while keeping collision and art in the same world coordinate frame. This is NOT automatically a bug. A test of every supported count, on-screen readability and route accessibility still applies.

## Findings and changes

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
