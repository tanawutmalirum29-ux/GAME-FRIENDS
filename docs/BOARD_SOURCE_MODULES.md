# BOARD PARTY authored source modules

The deployed `src/board-party/runtime/board-party.js` remains a **single classic-script runtime**
because Host, multiplayer events, dice, movement, effects and board UI
currently share one lexical state contract. Its source is now maintained
under `src/board-party/` and ordered by `src/board-party/modules.json`.
The assembler regenerates **byte-for-byte equivalent** `src/board-party/runtime/board-party.js` from
the original 602-line source, with no changes to game rules, canonical map,
turn movement, item handling or renderer integration.

Source ownership:

- `core/engine.js` — board creation, lifecycle, shared helpers
- `core/turn-manager.js` — order roll, phase transitions
- `core/player-state.js` — HP, protection, turn effects
- `systems/spaces/legacy-spaces.js` — tile landing and existing effects
- `core/movement-system.js` — walking, branches, camera-relative steering
- `core/dice-system.js` — dice actions and step accounting
- `systems/items/legacy-items.js` — existing item interactions and controls
- `systems/minigame-bridge.js` — minigame outcomes and board restoration
- `core/update-loop.js` — authoritative clock and bots
- `ui/controller.js` — snapshot, control labels and public BoardParty API

For any behavior change edit only the corresponding authored source. Run
`node scripts/build-board-party.cjs --write` and commit both source
and regenerated `src/board-party/runtime/board-party.js`; CI requires `--check`.
Do not add individual game IDs, maps or import declarations to the manifest.
Minigames use GamePlatform, board maps use the map catalog.

This is **source-level modularization**, not yet independent ES modules
or per-feature network chunks. The existing `BoardRuntime.ensure()`
still downloads the BOARD classic-script set lazily. Converting each
subsystem into independently loaded runtime plug-ins needs separate
interfaces, core-compatible state ownership and additional multiplayer
regression tests; never claim that this source split alone achieves that.

The existing canonical map is loaded through its adapter; the authored source
and every gameplay rule must continue to pass the full BOARD QA matrix.
