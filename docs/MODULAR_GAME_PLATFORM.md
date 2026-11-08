# GAME-FRIENDS modular platform — migration contract

The legacy engines, board physics and multiplayer protocol are preserved. The
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
Infrastructure and compatibility adapters can ship without rewriting physics.
Full page-specific lazy loading, splitting `app.js`, centralizing *all* legacy
HUD/round result paths, and browser-tested core recovery must be checked as
separate migration gates before claiming the complete six-phase refactor.
