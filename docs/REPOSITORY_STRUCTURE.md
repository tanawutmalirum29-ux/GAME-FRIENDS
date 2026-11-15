# Repository structure and file ownership

This project is a static browser application with a large-screen Host, mobile Controller, a shared game platform, and folder-discovered minigames. File paths are part of the runtime contract: HTML script URLs, dynamic loaders, build scripts, catalog manifests, generated bundles, and service-worker cache rules all refer to paths.

## Main entrypoints

- `index.html` is the shared browser entry. Query parameters and `src/platform/main-loader.js` decide whether the page boots a Host or a Controller.
- `host.html` is the dedicated iOS/iPadOS Host-install page; it is not the game runtime.
- `style.css` owns the shared application styles.
- `sw.js`, `auto-update.js`, `runtime-config.js`, and `deployment.json` participate in deployment, cache, and safe-update behavior.
- Several root-level JavaScript files are intentional browser assets referenced by `index.html` or dynamically loaded by the platform. Do not move them merely to make the root look smaller; first update every loader, build rule, cache rule, and regression test that uses their URL.

## Source of truth

| Area | Authoritative source | Generated or deployed counterpart |
|---|---|---|
| Host / Controller application | `src/app/modules.json` and its ordered `src/app/**` modules | `app.js` and `app-controller.js` via `scripts/build-app.cjs` |
| BOARD logic | `src/board-party/modules.json`, `core/`, `systems/`, `ui/` | `src/board-party/runtime/board-party.js` via `scripts/build-board-party.cjs` |
| BOARD design / scenery | `src/board-party/source/*.b64.part*` | `src/board-party/runtime/board-design.js` and `board-scenery.js` via `scripts/build-board-assets.cjs` |
| Minigames | One folder per game under `src/games/<slug>/`, with `manifest.json` and `game.js` | `game-catalog.json` and content-addressed `game-assets/<id>/<hash>/` |
| BOARD maps | `src/board-party/maps/<slug>/` manifests and map sources | `board-map-catalog.json` and `board-map-assets/<id>/<hash>/` |
| BOARD items / spaces / events | `src/board-party/plugins/{items,spaces,events}/` manifests and sources | `board-system-catalog.json` and `board-system-assets/` |
| Shared character rendering | `player-avatar.js`, `character-system.js`, `cosmetic-system.js` | Shared by game renderers, Plaza, portraits, and results |
| Lobby scene | `src/lobby/` | Loaded by the Host route |
| Shared game art | `src/shared/` | Declared as dependencies by the owning game manifests |
| Build and QA automation | `scripts/`, `ci/browser-tests.json`, `.github/workflows/` | Generated deployment files and GitHub Actions checks |

## Generated files that must not be deleted as “old copies”

These files are generated, but they are committed and intentionally used by static hosting, compatibility harnesses, or integrity checks:

- `app.js` and `app-controller.js`: generated from the same modular source manifest; they are the classic-script bundles used by development and production boot paths.
- `src/board-party/runtime/board-party.js`: the one canonical BOARD classic runtime assembled from authored modules.
- `src/board-party/runtime/board-design.js` and `board-scenery.js`: restored from the compressed source parts at build time.
- `src/app/core/legacy-game-defaults.js`: generated from game-owned manifests.
- `src/platform/board-items-brief.js`: generated from the BOARD item catalogue for Controller routes that do not load Host physics.
- `runtime-config.js`, `deployment.json`, and the game / map / system catalog outputs: deployment-time metadata and catalog artifacts.

Use each builder's `--check` mode before changing or committing a generated counterpart. Edit the authored source, run the corresponding builder with `--write`, then commit both source and required generated output.

## Assets and documentation

- `assets/game-friends-*.svg/png` are site-level brand/share assets.
- `assets/cosmetics/<id>/` contains one front/top SVG master per costume, metadata, and design previews. Player-color details use the root SVG `color` attribute plus `currentColor`, not per-palette SVG copies. `asset.json` describes an individual costume; `assets/cosmetics/wardrobe-assets.json` is the canonical 18-entry runtime wardrobe catalog; `wardrobe-cycle.svg` is a shared design reference, not a runtime registration file.
- `docs/*.md` contains architecture, operating rules, design handoffs, and implementation notes. Handoff files may describe the state at the time they were written; check the current source and tests before treating an old “next steps” paragraph as unfinished work.
- `tools/art-preview.html` is a standalone art-inspection page, not a production entrypoint.

## Tests and CI

- `tests/*.cjs` and `tests/*.js` are executable regression suites and fixtures. A test not named in a workflow may still be used by another test or local validation script; do not delete one from its filename alone.
- `ci/browser-tests.json` registers browser suites, browser engines, ownership areas, and estimated run times. Browser shard count is calculated dynamically.
- `scripts/ci-impact.cjs` is deliberately fail-closed: an unknown changed path selects full validation. `.github/workflows/verify.yml` owns the shared Node validation and browser matrix; other workflow files own targeted regression jobs.

## Safe cleanup procedure

Before deleting, renaming, or moving any file:

1. Check direct references in `index.html`, HTML templates, module manifests, game/map/system manifests, builders, service-worker rules, CSS URLs, tests, and documentation.
2. Check dynamic references too: constructed URLs, catalog paths, plugin discovery, runtime `fetch()` calls, and generated bundle inputs may not appear as a static import.
3. Distinguish runtime code, generated compatibility output, source artwork, test fixtures, previews, and historical design records. “Not loaded on first page boot” does not mean “unused.”
4. For a true duplicate, verify byte-identical content, identify the canonical path, update every reference, then remove the redundant copy.
5. Run the specific owner tests and the build integrity checks. For unclassified or CI-affecting changes, allow the full fail-closed validation to run before merging.

Do not collapse the project into fewer folders at the cost of breaking URL stability, plugin discovery, live-update hashes, or source-to-generated integrity.
