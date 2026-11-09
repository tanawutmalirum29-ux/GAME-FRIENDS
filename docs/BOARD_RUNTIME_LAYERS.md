# BOARD PARTY — Base map vs active V10 runtime

The repository intentionally contains two graph representations; they are
**not** two competing production map selections.

- `src/board-party/runtime/board-map.js` defines the deterministic, pre-adapter authored base
  (`winter-expedition-152-v6`, **213 nodes / 9 islands**). Its original
  constraints remain covered by `tests/board-fixed.cjs` and other legacy
  unit tests that load this module alone.
- `src/board-party/runtime/board-v7-design.js` and `src/board-party/runtime/board-v7-art.js` are generated from the
  verified, checksum-pinned source pieces by
  `node scripts/build-board-v7.cjs`. This build is idempotent; a fresh
  checkout does not need manually checked-in generated files.
- `src/board-party/runtime/board-branch-naming.js` and `src/board-party/runtime/board-v7-adapter.js` apply the later
  migrations to `window.BoardMap` in the browser, yielding
  **302 nodes / 17 islands**, version `winter-expedition-152-v10`.
  `src/board-party/runtime/board-party.js` subsequently reads `window.BoardMap` and thus
  uses the V10 graph, not the unadapted v6 fixture.

**Runtime entrypoints:** the source `index.html` loads board files in this
order for the legacy loader. Production `scripts/build-static.cjs`
restores generated board assets and may prune eager BOARD scripts;
`src/platform/board-runtime.js` then loads the same sequence on demand
before `src/app/board/integration.js` starts the BOARD session.
Neither path intentionally selects the 213-node base as the final graph.

**Regression coverage:** `node tests/board-runtime-layers.cjs` verifies
both load orders and actual VM graph counts before and after the adapter.
`node tests/board-build-fresh.cjs` exercises an empty build directory,
checksum validation, idempotent repeat, and stale-file recovery.
`node tests/board-v7.cjs`, `node tests/board-v8-layout.cjs`,
`node tests/board-graph-migration.cjs`, and
`node tests/board-layout-audit.cjs` bootstrap the generated files on
first invocation. CI also performs one explicit restore before Node and
browser QA. The base map must **not** be deleted as dead code: it is a
required adapter input and independently tested authored graph.
