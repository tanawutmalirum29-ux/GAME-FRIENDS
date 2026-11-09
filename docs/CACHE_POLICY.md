# Offline game assets

The service worker caches only \`game-assets/<id>/<content-hash>/...\` and
a last-successful, network-first \`game-catalog.json\`. It neither navigates
the page nor intercepts HTML, core JavaScript or multiplayer traffic.
It limits the asset cache to 120 requests; browser storage can be evicted.
Games can be replayed offline only after their assets and compatible catalog
were previously downloaded; fresh games cannot appear offline.

The service worker computes game-asset paths relative to its registration scope
(`/` or a subpath such as `/GAME-FRIENDS/`). Catalog and immutable game
CacheStorage names are scoped independently because CacheStorage is shared
across all workers for the same origin. A request outside the worker's scope is
not intercepted. The content hash in the asset URL still determines updates.
`node tests/cache-worker.cjs` covers both deployment modes, offline fallback,
version replacement, and cross-scope isolation.
