# BOARD PARTY — canonical Graph, Directional Arrows & Branch Identity

## Source of truth

The playable BOARD PARTY map is an **authoritative directed graph**:
`BoardMap.create().nodes`, `nextNodes`, `previousNodes`, `bridgeRoutes`,
`territories` and tile positions control walking, dice, bots, camera and
items. Arrowheads project that graph visually; they **do not limit movement**.
No new nodes, islands or edges were added by this migration.

## Directed-route and map-identity rules

| Metric | canonical | canonical |
|---|---:|---:|
| Nodes | 359 | 310 |
| Directed edges | 398 | 331 |
| canonical-added surviving bridges | 20 | 15 |
| Islands | 17 | 17 |

The change deletes the 36 specifically requested MS/prefix nodes and
removes the direct `m2 → m3` edge. The existing physical detour
`m2 → ms20_0 → m3` remains the sole edge sequence for that segment.
All deleted visual road/path segments, bridge metadata and graph references
are filtered from the same surviving edge set.

**Deletion exact IDs:** `ms19_0`, `ms18_0`, `ms18_1`.
**Deletion prefixes:** `xbc`, `ss`, `hs`, `xhb`, `xgb`, `gs`,
`xab`. The literal `wsxmout` prefix was **not present**; unrelated
`ws*` or `xmout*` routes were not guessed/deleted.

Deleting those 36 nodes alone would make other retained checkpoints
unreachable or unable to reach FINISH. To avoid inventing edges, the
graph-pruning pass removes **13 additional disconnected/unfinishable nodes**:
`h0`, `h1`, `h5`, `h6`, `g0`, `g1`, `g2`, `g3`, `g6`,
`g7`, `xcg_1`, `xcg_2`, `xcg_3`.
Those removals are graph-derived and guarded by exact structural counts.
No further pruning occurs if the authored topology changes unexpectedly.

### Sword-pair preservation

Two old court members are deleted, so the same two canonical sword territories
are repositioned onto **already existing, adjacent** tiles:
- Harbor Watch: `h0 / hs30_0` → `h2 / h3`.
- Ginger Watch: `g0 / g1` → `g4 / g5`.

No replacement edge or new tile was created. Both courts still occupy
linked pairs, keeping the number of canonical courts at four and all historical
base-map territories intact.

## Arrow rendering

Every arrow is projected from a real, surviving **directed** `nextNodes`
edge. It MUST point source → destination, even if its destination is
a junction. An incoming branch points INTO the junction and an outgoing
branch points AWAY. Junction symmetry, node degree and visual overrides
must never reverse a legal edge or visually invent a route.

Curved `n3` junctions use the authored quadratic Bezier position and
tangent, including a sampled curved arrow shaft. Short edges shrink their
arrows to stay clear of tile disks; broad/zoomed-out views still display
recognizable heads. All bridge styles receive arrows. The previous tiny
blue double-chevron graphics have been removed, leaving only the large
ivory arrow per directed edge.

To change traffic direction in the future, change and validate the actual
game graph; do not override arrow orientation separately from traversal.

## Hierarchical display/path IDs

Every node keeps an immutable **internal ID** for graph keys and all
gameplay state. `BoardBranchNaming.fromGraph(map)` walks the main route
`n0..n152`, visits root forks in actual main-path encounter order,
and discovers descendant forks from the physical adjacency graph.
Geometric angles break same-source ties deterministically;
array insertion/render order never chooses the branch names.

1. `n` is the main route, not an alphabetic branch.
2. Root forks are `a`, `b`, `c` … `z`, with deterministic
   extension `aa`, `ab` for more than 26 siblings.
3. A root fork returning to `n` is `a_0`, `a_1` …;
   a fork `a` ending at `b` is `ab_0` …
4. Branch `a`'s children in source traversal order are `aa`, `ab`,
   `ac` …; nested children can extend indefinitely: `aaa`,
   `aab`, `aba`, `abb`.
5. A child returning to `n`, its own parent, or its own loop uses
   no redundant destination suffix.
6. A child `aa` terminating at named `b` is `aab_0`; child
   `ab` terminating at `b` is `abb_0`.
7. `_0`, `_1`, `_2` always count actual nodes along the source-to-end
   path, not random, alphabetical sort, or screen placement.
8. Potential identical display IDs (for example two different meanings
   of `ab_0`) are detected and reported as
   `map.pathIdCollisions`. **Never merge the distinct nodes or invent a
   collision suffix.**
9. Internal keys are preserved, and `map.nodePathIds[oldId]`,
   `node.pathId`, `map.idMigration`, and `map.pathBranchCodes`
   provide the new identity mapping. The bot-only inspector shows
   the display/path ID next to the stable internal ID.
10. Any future graph modification must regenerate the mapping from
    topology and fail if it strands nodes, loses a territory, or adds an
    unauthorized edge.

The complete machine-readable old/internal/new display ID mapping is
generated from the exact runtime graph by:

```sh
node scripts/build-board-assets.cjs
node scripts/export-board-id-mapping.cjs --json
node scripts/export-board-id-mapping.cjs > board-id-mapping.csv
```

## Structural/Visual/Gameplay QA

```sh
node scripts/build-board-assets.cjs
node tests/board-branch-naming.cjs
node tests/board-graph-migration.cjs
node scripts/audit-board-graph.cjs --strict
node tests/board-map-geometry.cjs
node tests/board-map-layout.cjs
```

The strict audit blocks missing/ghost visual segments, deleted references,
broken edges, unreachable nodes, dead ends, incorrect sword adjacency, and
missing name mappings. Playwright Chromium/WebKit host/controller tests,
BOARD walking/dice/item/camera tests, and other GitHub Actions checks
must pass on the **latest** PR SHA before merge. NORMAL PARTY is unchanged.

To modify the board in the future, read this document and
`AGENTS.md`, recompute graph reachability, regenerate mapping and
keep renderer, bridge metadata and gameplay in sync.

## 9 November 2026 — WS waypoint retirement and top HUD fix

- All eight `ws*` nodes were retired: `ws0_0`, `ws1_0`, `ws2_0`,
  `ws5_0`, `ws8_0`, `ws9_0`, `ws9_1`, `ws9_2`.
- The four existing through-roads on Workshop Island were contracted without
  changing their travel permissions: `w0→w1`, `w1→w2`, `w2→w3`, `w5→w6`.
  Each edge replaces the exact former `w→ws→w` path. The optional
  `ws8/ws9` detours were removed instead of drawing long diagonal shortcuts.
- The Workshop sword pair `w6/w7`, all island entry/exit bridges, and
  downstream `fa/fb` routes are retained.
- The authoritative graph has **302 nodes, 321 directed edges**, 17 islands,
  and 15 retained authored new bridges. The migration removes 44 explicit
  checkpoints (36 previously requested + 8 WS) and 13 previously stranded
  nodes. It creates no unrelated new route.
- A host-specific `body.host-playing.board-playing` CSS override removes the
  *external minigame HUD gradient* from BOARD PARTY; BOARD's own Canvas header,
  order/roll text, map tools and interactive pause button remain in place.
- Regression checks assert no remaining WS graph/visual identifiers, complete
  reachability, four contracted routes, all sword pairs, no ghost edges,
  plus transparent zero-height host toolbar for the browser's BOARD view.

## 9 November 2026 — canonical island circulation and branch balance

- The Meadow route from n51 now enters m0 and exits from m7 to n56. This
  eliminates the 46-checkpoint jump to n108 and forces a single forward farm
  circuit; world-space bridge connector waypoints are pinned deterministically.
- Workshop and Iceberg circuits enter the start of their loop and exit from
  the far side instead of returning to the same checkpoint. Internal IDs are
  unchanged, while path/display labels are regenerated from the directed graph.
- Harbor (3 nodes) and Gingerbread (2 nodes) are designated compact scenic
  pauses, with authored small footprints, rather than large empty islands.
- The entire active road/path metadata, including bridge styles, is rebuilt
  from directed edges after graph mutation. canonical replaces canonical for saved-session
  compatibility; canonical snapshots must restart instead of being silently remapped.
- Two crossings where the arched Workshop viaduct passes above the Meadow
  entrance and exit lanes are tagged explicitly: xmw_2→xmw_3 and
  xmw_4→xmw_5. There is no implied footpath between crossing lanes.
- Road, walking lane and decoration clearance share the 88-unit width and
  44-unit radius. The strict reachability, territory, drawing metadata,
  and CI tests are required before merge.
