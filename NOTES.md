# Notes

## Phase 1 — Make it Run

Before touching any code, I read through the entire codebase: all four API routes, the five components, the lib modules, the Prisma schema, and the WebRTC layer. I wanted a clear picture of how the pieces fit together before deciding what was broken and what was intentional.

The app uses HTTP polling (every 1.5s) as a signaling relay for WebRTC. Presence and signals are stored in Postgres via Prisma. Chat and video go peer-to-peer over WebRTC and never touch the server. Once I understood that coordination model, the bugs became easier to spot.

### Bugs found and fixed

**Ghost dots (poll heartbeat updates all rows)**

`/api/poll` was calling `prisma.presence.updateMany({ where: {} })` on every request. This refreshed `lastSeen` for every user in the database, not just the caller. No one ever went stale, so dots stayed on the map long after users left. Fixed by scoping the update to `where: { id }`.

**Chat never arriving**

`sendChat` in `lib/webrtc.ts` sent messages as `{ t: "msg" }` but the receiver checked for `t === "chat"`. Every message was sent, displayed locally, and silently dropped on the other end. Fixed by changing the sender to use `"chat"`.

**Users stuck as busy after disconnecting**

`/api/signal` had handlers for `accept` (sets both peers busy) and `decline` (clears both), but nothing for `end`. When a connection ended normally, both users kept `busy: true` in the database and their dots showed at 35% opacity permanently. Fixed by adding `end` to the decline branch.

**"Me" pin placed at raw coordinates**

`/api/join` applies a 1-3 km privacy offset before storing coordinates, but was only returning `{ ok: true }`. The client stored raw geolocation in `myLocation`, so the "Me" pin landed up to 3 km away from where others saw the user's dot. Fixed by returning the offset coordinates from join and using them to place the pin.

**Silent API failures**

`join()` and `sendSignal()` in `lib/api.ts` did not check `res.ok`. A failed join would silently move the app into live mode with no presence row in the database. Fixed by throwing on non-OK responses.

**ICE candidates dropped on intermittent connections**

This one only showed up sometimes: two users would connect, but both stayed stuck on "Connecting..." and could only end the call. In `lib/webrtc.ts`, `handleSignal` flushed the queued ICE candidates before calling `setRemoteDescription`. The browser does not allow `addIceCandidate` until a remote description is set, so when candidates arrived before the offer or answer in a poll cycle, they were queued, then flushed too early, rejected, and silently lost to an empty `catch`. With no usable candidates the data channel never opened. It was intermittent because everything is delivered over 1.5s polls, so whether ICE or the SDP arrived first changed run to run. Fixed by setting the remote description first, then flushing the queue, so candidates apply no matter which arrives first.

### Setup issues

**`.env` file encoding**

`npx prisma db push` failed to resolve `DATABASE_URL` despite the file existing. The cause was a hidden BOM (byte order mark) introduced when the file was created on Windows. Deleting and recreating the `.env` file with clean encoding resolved it. `prisma.config.ts` was also updated to read the file via `fs.readFileSync` as a more explicit fallback for future environments where `process.loadEnvFile` may behave unexpectedly.

**Prisma client not generated**

`npx prisma db push` syncs the schema to the database but does not generate the Prisma client. The app threw a missing module error on first run. `npx prisma generate` must be run once before `npm run dev`. The `build` script already handles this for production.

## Phase 2 — Make it Good

The starter UI worked but felt like a default template: emerald buttons, white cards, rounded pills, a genfeat(security): authenticate and validate all coordination API routes

- add HMAC session token signed on join and verified on poll, signal, and leave
- validate session ids as UUID v4 and require SDP/ICE payloads to be JSON
- throttle polling per session to reject requests faster than 500ms
- attach the session token automatically from the client api helperseric map pin. I wanted Pulse to feel like a threshold, not a product page. The idea I kept coming back to is that the app connects strangers across the world, so the design should feel quiet, vast, and a little eerie, like looking down at Earth at night and watching for signals.

### Design system

I set one strict palette and stuck to it everywhere: near-black background, dark surfaces, faint borders, off-white text, muted grey for secondary text, and a single red accent used only for live signals. No gradients, no glows, no extra colors. The discipline is the point. When red only ever means "a person," it carries weight.

Type is three families with clear jobs: Syne for headlines (geometric and cold), Inter for body and UI, and JetBrains Mono for the small technical labels and meta lines. Buttons are all ghost or outline style that invert to white on hover, never filled by default.

### Landing page

The entry gate is the first impression, so I spent the most time here. It is a single full-height view with the content on the left and a globe bleeding off the right edge, so you feel like you are near the planet rather than looking at a diagram.

The globe went through a few iterations on purpose. I tried an SVG wireframe, then a canvas wireframe with real 3D math and depth fading, then the `cobe` library for a dotted-continent look. I landed on a pure canvas particle sphere because it felt the most alive and kept the dependency count at zero. It is 2800 points placed with a Fibonacci distribution, then deliberately roughed up: random displacement off the surface, per-particle size and opacity, density clusters, edge densification, and a slow breathing scale. A perfect sphere reads as a math diagram, so the imperfection is what makes it feel like a real data cloud.

I also added cursor physics. Hovering the globe repels nearby particles with a spring-damper return, with a softer wake just outside the repulsion radius. It rewards curiosity without being a gimmick, and it reinforces the idea that the sphere is responsive and alive.

### Application view

I carried the same system into the live app.

- The map keeps the dark Mapbox style with a subtle vignette so the center feels like a focused view.
- The "Me" marker is a red dot with a pulsing sonar ring and a small mono label, replacing the default emoji pin. Strangers are quiet white dots that brighten on hover, so the map reads clearly and the eye is drawn to people, not chrome.
- The presence count became a fixed pill with the same pulsing red dot from the globe, tying the two views together.
- The connection request modal is a sharp-cornered dark card with two broadcast arcs that draw themselves in, a Syne headline, and a one-line reassurance that the connection is anonymous and peer-to-peer.
- The chat panel is a right drawer with a clear header, a blinking "connecting" status, and a deliberately understated message style: their messages get a left rule, mine are quieter and right-aligned. No chat bubbles, no fills. The only red touch is the text caret. The map shrinks to make room for the drawer instead of being covered.

### Motion and accessibility

Motion is used sparingly: staggered fade-ins on load, the globe rotation and breathing, the sonar pulses, and short transitions on hover and mount. Every animation is wrapped so that `prefers-reduced-motion` disables it while keeping the layout and globe visible.

### Trade-offs

I chose a pure canvas globe over a library to keep things lightweight and fully under my control, at the cost of writing more code. I kept the existing component file names rather than renaming them, so the diff stays focused on visuals and the git history is easy to follow.

## Phase 3 — Make it Secure

The starting point was an API that trusted the client completely. Every route accepted whatever `id` the request carried, with no proof the caller owned it, no format checks, and no rate limits. Because all coordination state lives in shared Postgres rows keyed by `id`, and ids are visible to everyone (each peer shows up in the `/api/poll` response), simply knowing an id was enough to act as that person. That was the gap I focused on.

### Session tokens

On `/api/join` the server now issues a token bound to the caller's session id: an HMAC-SHA256 of `id + expiry`, signed with a server-only `SESSION_SECRET`, formatted as `<expiry>.<signature>`. The client stores it and attaches it to every later request (`Authorization: Bearer` for poll and signal, in the body for leave since `sendBeacon` can't set headers). Each route recomputes the HMAC and compares it with a timing-safe check, so the comparison can't leak through response timing. The token expires after 24 hours.

The key property: ids are public, but the token is not, and it can't be produced without the secret. So a client can prove it owns the id it claims without the server storing any sessions, which keeps the app stateless and anonymous.

### Input validation

Session ids must now match a strict UUID v4 pattern instead of the old "between 8 and 64 characters" check. SDP and ICE payloads (`offer`, `answer`, `ice`) must parse as a JSON object or the request is rejected. The server only ever relays well-formed signaling data, and junk ids can't create stray presence rows.

### Rate limiting

`/api/poll` runs several queries per call and clients poll every 1.5 seconds, so I added a per-session throttle: if the same id polls again within 500ms, the server returns `429` before doing any work. Legitimate clients never hit it.

This is a per-session limit, not per-IP. A proper IP-based limiter in a serverless setup needs a shared store like Redis or Upstash, which felt out of scope for this assessment. I noted the gap here rather than pull in that infrastructure.

### What this looks like in practice

Two strangers are mid-conversation. A third person opens the app, polls, and sees both of their ids in the peer list. Before Phase 3, they could POST `{ fromId: <partner>, toId: <you>, type: "end" }` to `/api/signal`, and the server would relay it and clear both busy flags. The call would drop and neither person did it. The same trick worked for forging an `offer` to hijack the handshake, or hitting `/api/leave` with someone else's id to remove their dot from the map.

After Phase 3, all of those fail with `401`. The attacker sees the ids but can't produce a valid token for them, so the server never relays the forged signal. Identity is tied to a secret the client can't guess, not to an id anyone can read.

### Trade-offs

- The token is deterministic per id with an expiry and no server-side session store. That fits the ephemeral, no-accounts design, but it does mean a leaked token stays valid until it expires. For transient anonymous sessions that's an acceptable balance.
- Rate limiting is per session, not per IP (see above).
- `SESSION_SECRET` is now required. It is in `.env.example` as a placeholder and must be set in `.env` locally and in the Vercel project settings for the deployment to work.
