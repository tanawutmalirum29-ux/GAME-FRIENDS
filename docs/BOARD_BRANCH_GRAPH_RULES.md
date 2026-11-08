# BOARD PARTY — V9 Graph, Directional Arrows & Branch Identity

## Source of truth

The playable BOARD PARTY map is an **authoritative directed graph**:
`BoardMap.create().nodes`, `nextNodes`, `previousNodes`, `bridgeRoutes`,
`territories` and tile positions control walking, dice, bots, camera and
items. Arrowheads project that graph visually; they **do not limit movement**.
No new nodes, islands or edges were added by this migration.

## Implemented V9 migration (8 November 2026)

| Metric | V8 | V9 |
|---|---:|---:|
| Nodes | 359 | 310 |
| Directed edges | 398 | 331 |
| V7-added surviving bridges | 20 | 15 |
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

Two old court members are deleted, so the same two V8 sword territories
are repositioned onto **already existing, adjacent** tiles:
- Harbor Watch: `h0 / hs30_0` → `h2 / h3`.
- Ginger Watch: `g0 / g1` → `g4 / g5`.

No replacement edge or new tile was created. Both courts still occupy
linked pairs, keeping the number of V8 courts at four and all historical
base-map territories intact.

## Arrow rendering

Every arrow is computed from a real, surviving `nextNodes` edge. Edges
with three-way or multiway junctions use one arrow **per leg**; incoming
legs may reverse their *graphic* orientation so the tails meet at the
fork while each head points outward. A pair of neighbouring forks shares
one marker on their connecting edge to avoid opposing arrowheads.
Curved `n3` junctions use the authored quadratic Bezier position and
tangent, including a sampled curved arrow shaft. Short edges shrink their
arrows to stay clear of tile disks; broad/zoomed-out views still display
recognizable heads. All bridge styles receive arrows.

Visual directions can later be configured independently via:
`map.pathArrowOverrides['source>destination'] = 'forward' | 'reverse'`.
This optional rendering setting does not alter game graph traversal.

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
node scripts/build-board-v7.cjs
node scripts/export-board-id-mapping.cjs --json
node scripts/export-board-id-mapping.cjs > board-id-mapping.csv
```

## Structural/Visual/Gameplay QA

```sh
node scripts/build-board-v7.cjs
node tests/board-branch-naming.cjs
node tests/board-graph-migration.cjs
node scripts/audit-board-graph.cjs --strict
node tests/board-v7.cjs
node tests/board-v8-layout.cjs
```

The strict audit blocks missing/ghost visual segments, deleted references,
broken edges, unreachable nodes, dead ends, incorrect sword adjacency, and
missing name mappings. Playwright Chromium/WebKit host/controller tests,
BOARD walking/dice/item/camera tests, and other GitHub Actions checks
must pass on the **latest** PR SHA before merge. NORMAL PARTY is unchanged.

To modify the board in the future, read this document and
`AGENTS.md`, recompute graph reachability, regenerate mapping and
keep renderer, bridge metadata and gameplay in sync.
