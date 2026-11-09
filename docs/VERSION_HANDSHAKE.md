# GAME-FRIENDS transport handshake

Production Host and Controller send `protocolVersion` (1) and
the immutable `coreHash` fingerprint on their first PeerJS
`join` and `welcome` packets. If both endpoints are not from
the same compatible build Core, **the join is refused before adding or
replacing a seat**, without altering the Host's room, BOARD turn or players.
The Controller checks the welcome independently and refuses an incompatible
Host. Local unbuilt regression fixtures have no Core hash and remain usable.

The Host also reports `pluginHash` for the currently pinned minigame
and `boardMapVersion` in the welcome payload. Minigame physics
run **only on the authoritative Host**, never inside a remote phone; the
Controller only sends joystick/A/B/C. The Host always pins the selected
engine object through a round, even if the same-core catalog refreshes.

A plugin-only update does **not** change the Core hash and can activate
safely at the next round; a Core or protocol update waits until room exit.
Do not navigate a connected Host/Controller or use a stale deployment
during an active online room.

Required tests: `node tests/version-handshake.cjs`,
`node tests/controller-ingress.cjs`, full Host/Controller browser QA.
