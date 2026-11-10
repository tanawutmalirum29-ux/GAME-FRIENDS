# BOARD PARTY — canonical map runtime

BOARD PARTY exposes one active map identity: `winter-expedition`. There are
no numbered V6–V10 runtime releases, filenames, or map versions.

The authored base is `src/board-party/runtime/board-map.js` (213 nodes and
9 islands). The compressed design and scenery are restored by
`node scripts/build-board-assets.cjs` as `board-design.js` and
`board-scenery.js`. The layout transforms in `board-layout.js` produce
the **single playable graph** (302 nodes, 17 islands). `window.BoardMap`
then points to that final graph, not to a selectable historical release.

Both source development HTML and the production lazy loader use the same
canonical scripts. Production loads them only when BOARD is selected.

Map packets contain `mapId`, not `mapVersion`. Generated deployment URLs
are stable; a network-compatible core fingerprint still prevents old code
from joining an active room. See [connection compatibility](CONNECTION_COMPAT.md).

Verify with `node tests/board-runtime-layers.cjs`,
`node tests/board-map-geometry.cjs`, `node tests/board-map-layout.cjs`
and `node tests/board-no-root-assets.cjs`.
