# Adding a minigame: folder-only discovery

## Contract

A new game must be self-contained under `src/games/<unique-slug>/`. **Do not edit**
`index.html`, `host.html`, `app.js`, `app-controller.js`,
`board-minigame.js`, `src/app/modules.json`, or a global game list.
The deploy builder discovers every direct child directory of `src/games/`,
validates its manifest, publishes versioned assets, and generates
`game-catalog.json`. Host, phone picker, game roulette, Normal Party and
Board Party all use that catalog. A directory without `manifest.json`
**fails the build** rather than disappearing silently.

```text
src/games/my-new-game/
  manifest.json       required: game identity, modes, player counts and entry
  game.js             required: ES module exporting the playable engine
  cover.svg           optional: image displayed in the picker / roulette
  art.js              optional: local engine dependency
  ...                 additional imports and assets (keep inside this folder)
```

Example `manifest.json`:

```json
{
  "id": "my_new_game",
  "name": "MY NEW GAME",
  "version": "1.0.0",
  "apiVersion": 1,
  "enabled": true,
  "players": {"min": 1, "max": 12},
  "modes": ["normal", "board"],
  "controls": ["joystick", "A", "B"],
  "entry": "./game.js",
  "cover": "cover.svg",
  "legacyScripts": [],
  "controller": {
    "help": "Use the joystick to move",
    "labels": {"A": "Action", "B": "Special"},
    "status": "Playing"
  }
}
```

The slug uses lowercase letters, digits and hyphens. The unique `id` uses
lowercase letters, digits and underscores; it must start with a letter.
`cover` and `controller` are optional. Use `enabled:false` to remove a
game from both mode selectors. Remove a mode from `modes` to exclude it.
Min/max player counts control Board Party eligibility. The same manifest controls
the phone's actions and help text.

**Native plug-ins do not set `global`.** `game.js` exports one object as
`default`; the host loader validates its `setup`, `update`, `draw`,
`hud` and `getResult` functions. Return the result schema expected by
`BoardMinigame.ranking` so the board can award placements. Review an existing
engine and the shared avatar/physics APIs before implementing a new one;
a file with empty methods is not a playable game. Use relative imports for
other files inside this directory. The older `global`/`legacyScripts` bridge
exists to maintain the original games, not as a requirement for new games.

## Deployment and live updates

1. Add the game folder and commit/push it.
2. AWS Amplify executes `scripts/build-static.cjs` during deployment.
   It discovers the new manifest, verifies file references, and emits
   `game-catalog.json` plus `game-assets/<id>/<hash>/...`. Nothing has to
   be appended to HTML or a bundle.
3. A running page refreshes the catalog on focus/visibility and approximately
   every 45 seconds. A same-core new game is selectable without interrupting an
   existing match. The new engine is downloaded **only when selected**; Board
   Party may prewarm a small bounded number of eligible engines.
4. A breaking change to shared Core code waits for a safe room reload; ongoing
   rooms are never forcibly disconnected. A failed per-game download is
   quarantined while the last loaded stable engine is preserved.

**Important:** Browsers cannot list folders on a static HTTP site. Discovery
happens at **build time**, not by scanning GitHub from the user's phone.
New folders become available after a successful deployment. Do not browse
directly to a raw source `index.html` without a generated catalog and expect
new games to be available; use the build output or the deployed site.

## Validation and safety

Run:

```sh
node scripts/build-game-catalog.cjs --check
node scripts/build-app.cjs --check
node tests/game-platform.cjs
node tests/static-build-integrity.cjs
node tests/game-source-ownership.cjs
node tests/plugin-roster-ownership.cjs
```

For a new game, also add its engine regressions, player-scale coverage and a
Chromium/WebKit browser test to the CI registry according to
`docs/CI_TESTING.md`. A new game directory **requires no registration
changes** for functionality, but must still pass the complete PR validation
before merging. No unreviewed external scripts or cross-origin game assets.
