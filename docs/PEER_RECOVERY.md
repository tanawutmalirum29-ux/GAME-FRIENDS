# Host PeerJS recovery and controller ingress

## Lifecycle and persistent state
The pinned PeerJS dependency is 1.5.5. Its `disconnected` event means
the signaling server went away while existing WebRTC DataConnections may
remain alive. `peer.reconnect()` can be used on a disconnected, non-destroyed
Peer. `close` is emitted for a destroyed Peer and cannot be recovered with
the same instance.

An opened Host retains its Peer instance, room code, live connections,
players, board state (HP, inventory and turn order) and running round through
signaling disruption. Backoff intervals start at 1, 2, 4, 8, 16 seconds,
capped at 16, with 0–20% jitter and 8 attempts maximum. Each attempt
has a 5-second watchdog to avoid a permanently pending PeerJS handshake.
Only one timer/watchdog can be pending. Successful `open` cancels retry state
without navigating or reinitializing the game; explicit `closeHost()` stops
retries before PeerJS destruction.

A destroyed Host Peer is not silently replaced during an active session,
because that would drop existing live connections. Instead the session
remains visible and is marked degraded for explicit user action. A
`unavailable-id` on an open room may mean the old ID was taken after loss
of signaling; that cannot safely be fixed by inventing another ID.

Error classes from PeerJS 1.5.5:
- Recoverable signals when the Peer is still usable: `network`,
  `socket-error`, `socket-closed`, `server-error`,
  `disconnected`, `webrtc`.
- Non-retryable configuration errors: `browser-incompatible`,
  `invalid-id`, `invalid-key`, `ssl-unavailable`.
- `unavailable-id` is retried with the **same** code only during initial
  creation; for an existing room it is shown as a degraded condition.
- Unknown error types do not close an already-active room.

## Ingress controls
Controller sends a 100 ms heartbeat and more packets on pointer moves,
so each connection is allowed 180 messages/sec sustained with a burst
of 260, avoiding normal movement/button loss during touch bursts. A packet
must have a recognized message type and valid structure, and its bounded
estimated payload size must be 4096 bytes or less. No logging per invalid
packet. The per-connection guard is disposed upon close/error.

## Validation and limits
`tests/host-reconnect.cjs`, `tests/controller-ingress.cjs`,
`tests/player-name.cjs` and `tests/smoke.cjs` exercise the server logic.
`tests/host-reconnect-browser.cjs` runs a controllable Mock PeerJS inside
real Chromium and WebKit with live Host UI, remote joins, a BOARD session,
and simulated signaling failure. It does **not** certify behavior during
real Internet outages, ICE candidate failure, NAT rebinding or mobile
background suspension; those require physical/integration-network testing.
Offline scope-cache tests in `tests/cache-worker.cjs` were already fixed
in PR #217 and are intentionally not changed by this PR.
