# GAME-FRIENDS — game-owned live roster contract

The Host Core never looks up minigame IDs to render the live player roster.
The engine object pinned at round start may optionally provide
`renderRoster(root, active, round)` for a custom DOM layout. It is
called after the Host clears the roster and sets shared grid properties.

The 15 original engines maintain their original DOM/SVG layouts through this
hook, including score, elimination, items, and game-specific status labels.
Do not reintroduce `if (round.mode === '...')` branches in
`src/app/rounds/render.js`. Gameplay, physics and ranking remain
in the individual engine and its separate `getResult` API.

New native plug-ins do not have to implement a DOM renderer.
`getRoster(round, activePlayers)` may return an array of
`{id, value, label, status, eliminated}`. The generic Host renderer
sorts descending by finite `value` (default: player score), shows
`label` and `status` as text (never injected HTML), and
marks `eliminated` visually. A plugin can instead implement
`renderRoster` for advanced graphics.

Neither method changes final rankings: the pinned engine's
`getResult(round,players)` remains authoritative. To add a new game,
create its folder with `manifest.json` and `game.js`; never add
the name or score condition to Core.

QA: `node tests/plugin-roster-ownership.cjs`, full 15-game
regressions, production build, Chromium/WebKit Host/Controller, all
required GitHub checks. Generated `app.js` and
`app-controller.js` must match `scripts/build-app.cjs --check`.
