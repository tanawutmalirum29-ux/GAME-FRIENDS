# GAME-FRIENDS modular platform — migration contract

The legacy engines, board physics and multiplayer protocol are preserved. The AWS production build strips eager legacy minigame engine scripts from HTML and loads the selected engine on demand. Development index retains the original engine script tags until the core bootstrap is completely separated. The
new build catalog is **generated from** `src/games/*/manifest.json`; browser
directory listing is not involved. A release produces `game-catalog.json`
and immutable **content-addressed paths** under `game-assets/<id>/<hash>/`.

## Adding a game
Create `src/games/<folder>/manifest.json` and `game.js` (ES module).
`game.js` must export an object providing `setup(round, players)`,
`update(dt, round, players)`, `draw(canvas, time, round, players)`,
`hud(players, round)` and `getResult(round, players)`. The first four
methods use the legacy engine signature; a later API version may change it.
`getResult` returns an array of `{id, value, label?}` for active participants,
where higher numeric values win, `Infinity` means survived, and ties have
identical values. New plugins should implement `dispose()` for optional
cleanup. Keep assets and ES imports relative to `game.js`.

Old engines have `legacyScripts` and `global` in their manifests, and
`game.js` exports their original engine global. They retain game-specific
legacy result paths until migrated individually.

`node scripts/build-game-catalog.cjs --check` validates 15 existing
manifests (and all future entries). `--write` builds the deploy artifacts.
The AWS build invokes this before version-stamping the HTML.

## Version and session integrity
- A running match pins the **engine object** at its start.
- A new game version is activated only before another round, not mid-frame.
- A catalog with a different core fingerprint is rejected by the live
  plugin loader; existing BOARD PARTY sessions keep running.
- If a dependency fails to load, the game must not begin, and the room stays
  recoverable. The old cached engine remains in memory for the current match.
- Local content hashes prevent mixing files of different game builds.
- Real static deploys do not retain every earlier release forever; cross-deploy
  rollback to an expired CDN artifact is **not** guaranteed.
- Only repository-trusted same-origin plugin code can execute. A manifest is
  NOT a sandbox for third-party code.

## Migration status
Production game-engine lazy-loading and compatibility adapters can ship without rewriting physics. The production HTML now also omits 12 heavyweight BOARD PARTY scripts, which are loaded sequentially by `src/platform/board-runtime.js` only upon BOARD entry; controller and NORMAL initial views do not download them. The in-repository development HTML retains its eager tags to preserve the local no-build workflow. Board play remains present while a selected minigame is loaded and pinned for that round.
Full page-specific lazy loading, splitting `app.js`, centralizing *all* legacy
HUD/round result paths, and browser-tested core recovery must be checked as
separate migration gates before claiming the complete six-phase refactor.

## Source architecture: maintained app modules
`app.js` is now a **generated, byte-for-byte compatibility bundle**. Make application edits in `src/app/` instead; `src/app/modules.json` defines the ordered source modules that are assembled into one lexical runtime by `scripts/build-app.cjs`. The CI `--check` gate rejects divergence, and AWS runs the generator before calculating the core fingerprint. This avoids `eval` and changes no current host/controller API contracts. Named modules:

- `core/runtime.js` — shared state, reusable UI, layout, player and host canvas primitives
- `host/room.js` — host room lifecycle, QR, player and peer management
- `controller/connection.js` — join/return, phone previews, orientation and controller input
- `board/integration.js` — BOARD session and controller bridge
- `rounds/engine.js` — round setup and fixed-step update
- `rounds/results.js` — shared ranking, legacy result adapters, result UI
- `rounds/render.js` — HUD, camera and main animation loop
- `host/lobby.js` — lobby/start/roulette flow and UI bindings
- `main.js` — launch route, room restoration and update guards

Run `node scripts/build-app.cjs --write` after source edits, then `node scripts/build-app.cjs --check`. The existing `app.js` file is not the source of truth. **These are source modules assembled at build-time, not independent network chunks:** interdependent functions still share one lexical runtime for multiplayer/host safety. Actual route-level network chunking is a separate gate and must not be assumed from the source split.

### On-demand remote connection stack
The production HTML omits the 2 third-party defer tags for PeerJS and QRCode. `src/platform/runtime-deps.js` loads PeerJS only when a controller joins; when the host creates a room it loads both PeerJS and QRCode. Offline bots and initial controller join screens no longer download these online libraries. A cancelled host-room load is guarded by `hostOpenAttempt`, so a late network response cannot reopen an abandoned room. Legacy development HTML retains CDN tags for test harness compatibility.

### Lightweight page bootstrap
The production page uses `src/platform/main-loader.js` as its first application entrypoint, rather than an unconditional `app.js` script tag. A fresh `?host=1` welcome screen downloads the full host app only after the user chooses online/offline mode; controller join links and existing host sessions eagerly load the app for immediate restoration. The first host click requests fullscreen synchronously before the async download (subject to platform permission). This is a **real network reduction on fresh host welcome**, not just build-time source organization. Full per-feature code splitting inside the single host/controller closure would require an additional API-boundary migration and is not claimed here.
