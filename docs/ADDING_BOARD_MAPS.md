# BOARD PARTY: folder-only map plug-ins

The existing 302-node/17-island winter expedition V10 remains the **legacy
default**. Its generated V7 source, graph adapters, item rules, and scripts are
not migrated or altered by the map registry. The default manifest is
`src/board-party/maps/winter-expedition/manifest.json`.
Do not move the committed/generated V10 sources or substitute the older
213-node V6 base for the active map.

## New map

Place all new files under `src/board-party/maps/<slug>/`:

```text
src/board-party/maps/coast/
  manifest.json
  index.js                 ES module default exporting {map, art}
  small.json               authored directed graph for 1–6 players
  large.json               authored directed graph for 7–12 players
  assets/
```

Manifest example:

```json
{
  "id": "coast",
  "name": "COAST",
  "version": "1.0.0",
  "apiVersion": 1,
  "enabled": true,
  "kind": "module",
  "players": {"min": 1, "max": 12},
  "entry": "./index.js",
  "graphs": {"small": "./small.json", "large": "./large.json"}
}
```

The map `index.js` must export a default object with `map` and
`art` implementations compatible with the existing `BoardMap`
and `BoardArt` APIs. In particular, `map.create(seed,{players})`
must synchronously return a complete session map, `map.validate(map)`
and `map.assertCompatible(map)` must verify the returned version,
and `map.MAP_VERSION` must match that version. The existing
BOARD engine assumes start tile `n0`, consistent end tile,
territory/index metadata, and the properties exercised by existing tests.
The renderer must expose the full same-name runtime API; a draw-only stub
is not playable. Use game-owned assets, never external unreviewed scripts.

The builder validates manifests, the small/large directed graphs, reciprocal
edges, start-to-finish reachability, dead ends, dangling IDs, and immutable
file hashes. Both tiers must define a real reachable start/finish. The graph
files are validation inputs: the module must use matching topology. Runtime
`map.validate` is an independent check before activation.

Run `node scripts/build-board-map-catalog.cjs --check` and
`node tests/board-map-discovery.cjs`. Amplify's
`scripts/build-static.cjs` writes `board-map-catalog.json`
and fingerprinted `board-map-assets/<id>/<hash>/` files.
No per-map additions to HTML, `app.js`, or the BOARD script
array are required. Static browsers cannot enumerate server directories.

## Safe updates and compatibility

Catalog metadata can refresh while BOARD is running. The map implementation
must **never be swapped during an active BOARD session**; activate it only
before creating a new session. Existing sessions remain on their original
map and mini-game object. New same-core maps are selectable at the next
session. A Core/BOARD protocol change must not force a connected room reload.
The host publishes `mapVersion` on board-state packets, and
the existing controller checks the version and turn tokens. The map manifest
does not grant third-party code sandboxing: trust only reviewed repository
modules. Cache previously fetched immutable board assets, but never prefetch
all maps merely to display their names.
