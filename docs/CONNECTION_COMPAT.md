# Multiplayer core compatibility

Host and Controller exchange a SHA-derived `coreHash` when joining and
accepting a room. No numbered map, game, or transport release is necessary.

- The host rejects a different core fingerprint without closing the room or
  affecting connected players.
- A controller rejects a host with a different fingerprint and can retry
  joining after obtaining the current deployment.
- Development fixtures without generated fingerprints can test the same source.
- Board inputs include a stable `mapId`, the turn token and action sequence.
- Existing live games finish before an application deployment reload.

See `src/app/core/connection-compat.js`,
`tests/connection-compat.cjs` and `tests/peer-protocol.cjs`
for transport validation. The internal fingerprint exists for safety, not as a
numbered release or asset URL suffix.
