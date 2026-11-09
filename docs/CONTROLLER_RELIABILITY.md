# Controller reliability and network setup

## What changed

The controller gets a single 844×390 **reference for the visible analog ring, knob, A/B buttons and action column**. The reference scale uses `VisualViewport` (and swaps dimensions in portrait fallback), coalescing viewport events into one animation frame. The rest of the controller layout and safe-area padding remain responsive; this is not a full fixed-size letterboxed stage.

Video fallback stays visible until an actual decoded, playing video frame is available. A 4-second watchdog exposes the user-gesture play button when autoplay or stream delivery stalls. Host-side JPEG fallback now tries a third 128×72 low-quality frame if its first two encodings exceed the 24,000-character packet bound. A 30 fps maximum on copy-to-stream canvases reduces host painting work, without changing simulation FPS.

Analog movement changes are combined to roughly 30 Hz. **Button transitions and joystick release still send immediately**. The existing reliable PeerJS data channel remains in use to avoid dropping A/B/C transitions or enabling spoofed dual-channel controllers. The host acknowledges accepted input about four times a second; the controller displays approximate input round-trip latency. BOARD camera gestures are coalesced per paint and retain host-side current-turn validation.

BOARD rendering now caches immutable topology lookup tables and lowers decorative detail after sustained host frame times over 40 ms, recovering after sustained fast rendering. Manual detail selection remains authoritative.

## TURN is not provisioned in this frontend

PeerJS provides STUN by default, which does **not** guarantee relay connectivity across restrictive cellular, carrier-grade NAT or school networks. This repository is a static frontend: there is no secure TURN credential issuer, and **permanent TURN usernames/passwords must never be committed to GitHub**.

If the deployment has a secure service that issues temporary TURN credentials, it can populate `window.GF_ICE_SERVERS` **before the first Peer instance is created**, in a trusted script loaded before `app.js`:

```js
window.GF_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turns:relay.example.com:5349', username: temporaryUsername, credential: temporaryPassword }
];
```

The example is illustrative and does not configure a functioning TURN relay. Both host and phone must receive valid ICE servers. If `GF_ICE_SERVERS` is absent or empty, the code retains PeerJS defaults. A production implementation should retrieve short-lived credentials from an authenticated endpoint with appropriate rotation and abuse protection.

## Remaining engineering decisions

- Full 844×390 **letterboxed stage** requires a dedicated layout migration and real iPhone/iPad Safari tests; the existing grid is deliberately preserved to avoid breaking the picker, safe areas and landscape fallback.
- A separate unordered/unreliable movement DataChannel would require connection binding and ingress security changes; this PR retains reliable PeerJS delivery and coalesces high-rate updates instead.
- A live BOARD position-only minimap requires a new authenticated state packet, scene projection and 10–15 Hz culling; it is not implemented by the JPEG preview patch.
- On-device WebRTC verification (cellular vs Wi-Fi, autoplay, native toolbar, landscape fallback) remains mandatory; Chromium/WebKit CI only simulates browsers.

## QA

`node tests/controller-perf-regression.cjs` covers ICE option injection, no-TURN fallback, first-frame readiness and viewport batching. Full `validate` and the dynamically generated Chromium/WebKit browser matrix must pass before merge. Never merge on syntax checks alone.
