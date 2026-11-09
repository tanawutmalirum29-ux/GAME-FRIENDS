# BOARD PARTY V8 — 17-island route renovation

## Intent

Make the island board readable at overview and at node zoom without changing the game
mechanics of dice, player input, item effects, camera control, scoring or combat.
Use only graph-authoritative map coordinates to paint the roads and sword courts.

## Baseline audit

- 359 nodes, 398 directed edges, 17 islands.
- Original v7 diagram: 11 path crossings, 10 singleton sword territories.
- Especially tight island node distances: Santa's Workshop 74, Reindeer Meadow 88,
  Peppermint Harbor 52, Gingerbread Isle 86, Glacier Spire 55 world units.
- v6 sword pairs were connected; v7 separately introduced invalid one-tile swords,
  including several in very narrow water routes.

## Island-by-island structure

| Island | Role | Layout change |
|---|---|---|
| Noel Village | Starting hub | Preserve coherent starting route and shore; existing paired courts remain |
| Lantern Forest | Main forest passage | Preserve readable long route and original branches |
| Frostfang Massif | Winter mountain | Preserve canonical route and reward/risk branches |
| Mirrorfrost Lake | Main lake junction | Preserve navigable land loop; classify crossing to elevated viaduct |
| Crown Snow Castle | Finish region | Keep finish anchored at n152, preserve access from multiple routes |
| Bell Hamlet | Short dangerous detour | Retain small route connected back to forest |
| Aurora Outpost | Small reward loop | Preserve readable healing/lucky detour |
| Comet Key | Three-node respite | Leave low-density rest stop |
| Starlight Key | Three-node reward stop | Preserve its small loop-outlet |
| Santa's Workshop | Main loop with risky bypass | Enlarge outlined region, space 16 nodes, reroute crowded shortcut and unify two sword spaces into one court |
| Reindeer Meadow | Scenic loop and optional branch | Spread centre nodes, separate the reward detours from the outer ring and avoid all unmarked crossings |
| Peppermint Harbor | Harbor passage with court branch | Widen usable waterfront, make its side route rejoin further ahead, place the paired sword court on a readable inland bypass |
| Gingerbread Isle | Holiday loop and reward diversion | Give centre nodes more room, move the lucky detour toward the perimeter and add a paired sword court |
| Glacier Spire | Risky shortcut vs healing loop | Separate upper routes and rejoin after the outer ring, make a pair of swords on the main route and keep detours inside the ice silhouette |
| Ice Floe A | Single-node bridge refuge | Preserve transit/reward node |
| Ice Floe B | Single-node bridge refuge | Preserve transit/reward node |
| Ice Floe C | Single-node bridge refuge | Preserve transit/reward node |

## Geometry and gameplay invariants

- All original n0 → n152 canonical main-route edges and start/finish endpoints remain intact.
- Original map-authoritative coordinates of v6 paths are preserved.
- Deterministically spread and reassign v7 route coordinates without changing node IDs or node count.
- Keep all 359 nodes reachable from n0 and with a directed path to n152; no accidental
  terminal branches, missing reverse adjacency, or disconnected water links.
- Retain 398 directed edges and 17 recognizable island silhouettes. Remove accidental
  overlapping paths; the two remaining intersections are explicitly raised viaducts,
  not traversable graph junctions.
- Four new two-tile sword courts are grouped on Workshop, Harbor, Gingerbread, and
  Glacier Spire; all original 11 two-tile sword territories remain connected.
- Every sword territory contains exactly two consecutive sword nodes. Landing on either
  uses the same territory ID for claiming, ownership, safety, attacks and rewards.
- Draw the shared sword platform beneath the tiles with an owner-aware tint, plus a
  subtle readable main-route indicator at useful zoom, without overlaying item symbols.

## Reproducible verification

Run from the project root after restoring the v7 design sources:

```bash
node scripts/build-board-v7.cjs
node tests/board-layout-audit.cjs
node tests/board-v8-layout.cjs
node tests/board-v7.cjs
node tests/board-party.cjs
node tests/board-art.cjs
node tests/board-layout.cjs
node tests/board-expedition.cjs
```

The dedicated GitHub Actions `island-audit` job enforces island spacing,
art/graph position parity, every sword pair, deliberate bridge overpasses and
reachability from all 359 nodes. The full Verify workflow separately runs the
game and real-browser regression suites.

## Compatibility

BOARD PARTY V8 is a new authored map version (`winter-expedition-152-v8`).
Existing V7 snapshots must not silently load on a changed topology; start a new
room/round for the renovated map. NORMAL PARTY and its minigame engines are unchanged.
