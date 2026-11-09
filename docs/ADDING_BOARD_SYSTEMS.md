# BOARD PARTY: Add Items, Spaces and Events as Plugins

New BOARD systems live **only** in `src/board-party/plugins/<category>/<slug>/`
where `<category>` is `items`, `spaces`, or `events`.
The static deploy builder auto-discovers each direct child directory, validates
its manifest, and publishes a version-pinned `board-system-catalog.json`
and `board-system-assets/` modules. No imports or switches in `app.js`,
`index.html`, or the BOARD engine need editing to add a system.

```json
{"id":"bonus","category":"items","name":"Bonus","version":"1.0.0",
 "apiVersion":1,"enabled":true,"entry":"./index.js"}
```

`index.js` exports a default **object** with exactly the corresponding
identity `id` and category `category`.

- `items`: `begin(session,player,api,helpers)` returns true only
  after a successful mutation. `helpers` contains `consume`,
  `position`, and `afterUse`. Item logic must not bypass the
  shared one-item-per-round, turn or inventory checks. Optional
  `confirm(session,button,api,helpers)` and `update(session,dt,api,helpers)`
  may implement a multi-stage effect.
- `spaces`: `onLand({session,player,node,api})` returns
  `{handled:true,kind,dead}` to replace default landing behavior,
  or `{handled:false}` to use existing behavior. This is a
  deterministic synchronous hook; no network calls or promises during a turn.
- `events`: `onUpdate({session,dt,api})` may mutate
  host-owned state in the authoritative fixed-step BOARD update loop.

Old BOARD items (`potion`, `ufo`, `rocket`,
`bomber`, `car`, `shield`) and legacy spaces
are **reserved** and remain behaviorally identical. Their source code stays in
the existing compatibility adapter. New item IDs append after the six original
slots; no existing ID or UI action index changes.

Only reviewed same-origin repository code may be a plugin. Content hashes
ensure an immutable version. The live session pins loaded plugin objects;
a same-core catalog refresh updates **metadata only** and new implementations
activate on the **next BOARD session**. A failed optional plugin does not
disconnect the room and cannot activate a half-loaded collection.

Run `node scripts/build-board-system-catalog.cjs --check`,
`node tests/board-system-discovery.cjs`, `node tests/board-system-runtime.cjs`,
and complete BOARD regression/browser gates before merging.
