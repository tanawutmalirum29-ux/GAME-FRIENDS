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
at `/` or a subpath. Fresh game/module updates load only when chosen; the
worker never precaches all games or maps to discover them. Offline fallback
requires that the requested content was fetched while online. Same-core catalog
updates do not reload connected rooms; incompatible Core updates remain deferred.

Run `node tests/cache-worker.cjs` for update, offline, scope isolation and
more-than-120 immutable assets, plus Chromium/WebKit browser QA.

## Live update behavior and recovery

The production deployment watcher checks `deployment.json` and live catalogs
every **45 seconds**, plus immediately on page activation, focus, coming online
and returning from the browser back-forward cache. Requests to the mutable
deployment manifest and catalogs bypass the HTTP cache; content-addressed game
and map assets remain reusable. Controllers and NORMAL-only rooms skip BOARD
catalog traffic.

In an online Host lobby or running BOARD session, the same-Core game catalog
is refreshed **without navigating or closing PeerJS**. New/changed minigames
are loaded from immutable asset URLs on demand, and active engine instances
stay pinned until their round ends. Incompatible **Core** updates cannot replace
a running JavaScript closure: the watcher announces and defers a full reload
until there is no connected Host/Controller or active session.

When a same-Core modular BOARD map catalog changes during BOARD play, the new
metadata is staged without mutating active `BoardMap`, `BoardArt` or the
selector. Returning to the Host lobby applies the staged catalog, refreshes
again and safely prepares the selected map for the next BOARD session.
The built-in `winter-expedition` map is now also packaged as four
content-addressed runtime scripts (design, scenery, map, art) and tracked by
`GAME_DEFAULT_BOARD_MAP_HASH`, independent of the shared Core fingerprint.
A new map/art release is validated and swapped only after BOARD has exited to
the Host lobby, with previous map globals restored on load/validation failure.
**Changes to shared BOARD rules, engine, controls or layout still change Core**,
and those cannot hot-reload while an online PeerJS room is active.

An old browser tab now checks the deployment manifest *before* reconnecting
a saved Host or controller room (with a short offline timeout). The temporary
`gf_refresh` navigation nonce forces a fresh HTML request, and the browser
removes that nonce from its address bar after boot while preserving existing
join and Host query parameters. A deployment reload attempt is remembered
only for a bounded cooldown, not forever; if the CDN serves stale HTML again
the watcher retries later. The Service Worker is revalidated on activation
but never automatically disconnects an active session.

Relevant regression suites: `tests/auto-update.cjs`,
`tests/cache-worker.cjs`, `tests/board-map-runtime.cjs`,
`tests/game-platform.cjs` and production Chromium/WebKit deployment QA.
