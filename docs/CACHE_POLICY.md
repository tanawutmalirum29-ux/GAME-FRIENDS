# Immutable assets & offline recovery

The service worker caches only immutable, content-addressed assets from
`game-assets/<id>/<hash>/`, `board-map-assets/<id>/<hash>/` and
`board-system-assets/<category>/<id>/<hash>/`. It stores the last
successful `game-catalog.json`, `board-map-catalog.json` and
`board-system-catalog.json` using network-first, offline-fallback reads.
It never intercepts HTML, mutable Core JS, or multiplayer traffic.

**No automatic deletion of cached hashed assets:** previously the game
cache deleted entries above a global 120-request threshold. That could evict
assets still being used by a live BOARD minigame after frequent hot deploys.
The worker now never removes immutable game/map/system assets while a connected
session may be using them. The browser may still evict stored data due to
storage quotas or device pressure; there is no guarantee of indefinite offline
persistence. Do not implement naive LRU eviction without a reliable session pin
protocol covering all connected clients and current rounds.

CacheStorage names are isolated per Service Worker registration scope, whether
at `/` or a subpath. Fresh game/module versions load only when chosen; the
worker never precaches all games or maps to discover them. Offline fallback
requires that the relevant version was fetched while online. Same-core catalog
updates do not reload connected rooms; incompatible Core updates remain deferred.

Run `node tests/cache-worker.cjs` for update, offline, scope isolation and
more-than-120 immutable assets, plus Chromium/WebKit browser QA.
