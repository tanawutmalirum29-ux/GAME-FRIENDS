# BOARD PARTY — Directional graph, hierarchical branch IDs, deletion gates

## Source of truth

`BoardMap.create().nodes`, `nextNodes`, `previousNodes`, island membership,
bridge routes, and `territories` define the playable board. A vector stroke
must never create a walking edge. Camera, dice, bots, items and players must
continue to resolve stable internal node IDs. Never add a route or vertex
automatically to repair deletions.

**Current stage:** Direction arrows and a reusable naming library are staged.
The requested node deletions and playable-ID rekey are **NOT** in effect:
the non-destructive audit identifies disconnections. Do not claim the graph
refactor or ID migration is complete or merge it without a safe graph.

## Directions: graphical only

Every directional marker is projected directly from an authoritative directed
edge; `board-art.js` places a shaft and a triangular head. On authored
quadratic curves, the marker position uses the Bezier curve and its tangent.
The glyph is bounded by the two node disks; short edges use smaller heads.
All outgoing branches at multiway junctions receive glyphs. Incoming
branches at a junction may reverse **their visual glyph only**, creating
tail-to-tail markings. One marker per edge avoids adjacent opposed heads.
Bridges use the same algorithm.

Optional `map.pathArrowOverrides['from>to']` may be `'forward'` or
`'reverse'`. No part of movement, dice rolling, path selection or physics
reads that graphic override. Until instructed otherwise, preserve existing
allowed directions separately from the arrow artwork.

## Naming specification

Keep **Internal Identity** (unchanging, unique) separate from the
**Display/Path ID** (which may collide). A name collision is reported, never
silently resolved by attaching random letters/numbers or merging nodes.

1. Root/main line: follow `n0 → n1 → … → n152` by graph traversal, not
   creation-array order or screen coordinates. Root `n` is not a branch.
2. Root forks in encounter order: `a,b,c,…z`, with deterministic extension
   `aa,ab,…` if more than 26 sibling branches exist.
3. Root fork returning to `n`: `a_0,a_1,a_2`. Never append `n`.
4. Root fork `a` ending at a different named branch `b`:
   `ab_0,ab_1,ab_2`.
5. The first, second and third children of branch `a` are `aa,ab,ac`.
   Naming recurses indefinitely: `aaa,aab,aba,abb`, etc.
6. A descendant rejoining root `n` **or its own immediate parent**
   omits that destination suffix. Thus `aa` rejoining `a` is `aa_0`.
7. A descendant `aa` joining `b`: `aab_0`; `ab` joining `b`:
   `abb_0`. The same destination rule applies at arbitrary depth.
8. Number node positions from the branch's actual source-to-terminal traversal
   as `_0,_1,_2`, not display, RNG or insertion order.
9. The spelling `ab_0` is ambiguous: it may mean a route from `a`
   to `b` OR the first node of child `ab`. Detect and report each collision,
   preserve distinct immutable internal identities, never overwrite.
10. When two forks occur at the same parent-node encounter order, resolve
    only by a grounded geometric fork angle; without unambiguous geometry,
    fail closed rather than infer ordering.

`board-branch-naming.js` implements deterministic labeling from
already-extracted branch descriptors. Each descriptor needs unique
`internalId`, `parentId`, physical `sourceOrder` (and optional
`sourceAngle`), `terminalBranchId`, and ordered `nodeIds`.
It returns `mapping` and explicit `collisions`. The next migration
must **extract descriptors from the authoritative graph**, ensure
connectivity, calculate migration mappings, review collisions, rekey
all consumers atomically, and bump map version. Do not just repaint labels.

## Requested deletion preflight

After restoring design assets, run:

```bash
node scripts/build-board-v7.cjs
node scripts/audit-board-graph.cjs
node scripts/audit-board-graph.cjs --strict
node tests/board-branch-naming.cjs
```

Audit exact `ms19_0`, `ms18_0`, `ms18_1`, and the literal prefixes
`xbc`, `ss`, `hs`, `xhb`, `xgb`, `gs`, `wsxmout`, `xab`.
The current design contains **no** `wsxmout` prefix; that token must not
silently be interpreted as two separate deletion commands (`ws` plus
`xmout`). The audit also removes *only in its in-memory proposal* the
existing direct `m2→m3` connection while retaining
`m2→ms20_0→m3`. It reports original/planned node and directed-edge
counts, candidates, missing prefixes, dead ends, unreachable nodes,
finish-disconnected nodes, broken bridge routes, and broken sword pairs.
`--strict` returns failure while blockers persist.

## QA and migration gate

Before applying a deletion or mapping:

- Record `oldInternalId → newInternalId → displayId` for every changed
  node; include positions, adjacency, roads, bridges, island membership,
  territory/sword, items, bot references, debug inspector and game state.
- Assert each surviving graph edge exists at both ends; no dangling refs,
  duplicate internal ID, unauthorized edge or change to the 152-node main
  route. No accidental dead ends or unreachable islands.
- Validate every drawn arrow against a **surviving physical edge**, at
  overview and zoomed camera ranges, including curved and 3–4-way forks.
- Walk every branch with player and bot, test dice steps, collisions,
  items, saved-room/rejoin behavior and NORMAL PARTY isolation.
- Require affected Node tests, the real Chromium/WebKit browser matrix,
  full `validate`, and latest-commit required gate to pass before merging.
