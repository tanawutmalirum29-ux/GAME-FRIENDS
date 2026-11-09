# GAME-FRIENDS — Controller stage, live BOARD minimap and relay rollout

## Controller dimensions and touch input

The entire controller is a single **844 × 390 CSS-pixel stage**. The host page is not affected. VisualViewport measurements minus CSS safe-area padding determine `--gf-controller-stage-scale`, with black bars outside the stage. Portrait fallback rotates the same stage by 90°. Floating joystick pointer offsets and travel are divided by the stage scale before converting to local coordinates, so touch sensitivity stays the same across devices. The entire visible A/B/C hit areas remain part of the original gamepad grid.

## Live BOARD PARTY preview

When a player turns on the controller preview in BOARD PARTY, modern controllers advertise `minimap:true`. The host sends a small topology packet once per board session, then authoritative `BoardItems.position()` coordinates for at most 12 players at **approximately 12 Hz**. A lightweight 480×270 Canvas displays nearby routes, the owner's position and other players. The controller does not download BOARD physics and the host does not encode JPEG/video for a capable BOARD minimap controller. Older controllers retain the existing preview fallback. Preview OFF sends no minimap packets.

## Fast axis channel: security and limitations

Buttons A/B/C and room management remain in the original reliable, authenticated channel. A host-minted **128-bit random one-session token** binds any extra DataConnection to exactly one joined player and peer. A separate guard rejects unwanted fields, invalid values, duplicate/out-of-order sequences and floods. Fast axis input is accepted only with a valid current BOARD turn, map version and player identity; inspection mode blocks walking. Host-side input action sequencing prevents fast updates from swallowing later reliable button edges.

The client requests `Peer.connect(...,{reliable:false})`, but **only enables fast input after inspecting the actual RTCDataChannel and confirming `ordered===false` AND `maxRetransmits===0`**. PeerJS or browsers that do not provide that precise transport keep the previous reliable 10 Hz heartbeat and coalesced pointer input. Never treat `reliable:false` alone as a guarantee that retransmissions are disabled.

## Deploy TURN (required to support restrictive mobile/school networks)

The AWS Amplify frontend is **static**. It cannot itself run coturn or hold a TURN signing secret. Deployment requires these external resources:

1. Configure a public coturn relay with authenticated REST credentials (`use-auth-secret`, `static-auth-secret`, `realm`, and working `turn:` / `turns:` endpoints), the required UDP/TCP ports and firewall rules.
2. Deploy `server/turn-credentials.mjs` as a Node.js AWS Lambda behind an HTTPS API Gateway route. Configure:
   - `TURN_SHARED_SECRET`: same random shared signing secret as coturn, **minimum 24 characters**, stored in Secrets Manager or encrypted Lambda environment variables
   - `TURN_URLS`: comma-separated public relay URLs, e.g. `turn:relay.example.com:3478,turns:relay.example.com:5349`
   - `TURN_ALLOWED_ORIGIN`: exact public origin of the Amplify site, e.g. `https://main.example.amplifyapp.com`
   - `TURN_TTL_SECONDS`: default 600, allowed 120–1800 seconds
3. Add **API Gateway throttling and AWS WAF IP-based rate limits** to the public credential endpoint. CORS/Origin is not authentication; non-browser clients can spoof Origin. Inspect costs and request logs to prevent TURN abuse.
4. Configure the AWS Amplify build environment variable `GF_TURN_CREDENTIALS_ENDPOINT` to the public HTTPS API Gateway URL. `scripts/build-static.cjs` injects **only this URL** into `build-version.js` before `app.js`, never the secret. Rebuild the app.
5. Test real iPhone Safari/Android Chrome between 4G/5G and separate Wi-Fi networks, using WebRTC internals to verify **relay** candidates and actual TURN traffic. Keep direct STUN connections as the fallback if the credential service is down.

`partyIceCredentialsReady()` fetches non-cacheable temporary credentials before each first Peer construction and refreshes them before expiry. It updates the Peer configuration used for newly initiated connections where the library permits it. Existing long-running Peer connections remain subject to browser/PeerJS ICE renegotiation behavior, which must be verified on devices.

**Production TURN is NOT active merely because this code is merged.** The coturn relay, HTTPS API, WAF/throttling, AWS secrets and Amplify environment variable must actually be deployed.

## Regression gates

- `node tests/controller-perf-regression.cjs` — single-scale VisualViewport, first video frame and ICE validation
- `node tests/controller-minimap.cjs` — topology-once, live coordinates, malformed packet and preview-off behavior
- `node tests/controller-ingress.cjs` — reliable ingress and fast-axis replay/flood protection
- `node tests/turn-credentials.cjs` — signed coturn ephemeral HMAC credentials and secure API behavior
- `tests/controller-stage-browser.cjs` in dynamically sharded Chromium + WebKit QA — 844×390 baseline, two phone widths and rotated portrait
- Full `validate`, each generated browser shard and `Browser QA / required gate` are required for merge.

No game rules, bot parameters, physics, scores, BOARD graph or turn timings are intentionally changed by this work.

## Mandatory landscape across web Host and installed apps (2026-11-09)

The installed Host PWA (`host.webmanifest`) and installed Controller PWA
(`manifest.webmanifest`) now request native `orientation: landscape`.
iOS Safari, some WebKit builds and browser tabs may ignore this request even
after a fullscreen gesture. No website can physically rotate the device or
guarantee removal of browser/OS status bars; the fallback rotates the **entire
interactive layout** into a landscape coordinate space without a prompt.

- **Installed PWA:** home, room lobby, game, join form and controller stay in
  landscape presentation. If the device stays physically portrait,
  `gf-virtual-landscape` rotates the app shell by 90°. Orientation/viewport
  changes are handled without reloading or breaking the room connection.
- **Web Host:** the landing page is still a normal mobile website. Once a
  room is open, both lobby and game use the same fullscreen landscape shell.
- **Web Controller:** the join form remains upright for the mobile keyboard;
  joining requests native fullscreen/landscape on the user's gesture. If
  orientation remains portrait, the already fixed **844×390** gamepad rotates
  immediately with no chooser, and returns to native landscape automatically.
- Canvas taps use `arenaPointer()` and the untransformed
  `arenaLayoutRect()`: portrait screen coordinates are inverse-rotated before
  BOARD pan, pinch, node selection and Ghost map inspection. The host bot
  testing joystick and remote BOARD gesture controls use the same rotated axes.
- Native DOM hit testing already handles transform rotation for A/B/C,
  buttons, links, and inputs. Do not apply a second manual rotation to their
  event targets. Local gesture vectors are the only exception.

Verify on real iOS/Android devices, including opening the installed PWA with a
portrait rotation lock, accepting room invitations, leaving/rejoining a room,
BOARD drag/pinch, controller double-tap inspection and A/B/C interactions.

**The webpage cannot promise 100% physical immersive fullscreen in browsers
that deny the Fullscreen API or keep system chrome visible.** The game uses
the available visual viewport and keeps its content in landscape instead.
