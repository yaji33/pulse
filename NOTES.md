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

### Setup issues

**`.env` file encoding**

`npx prisma db push` failed to resolve `DATABASE_URL` despite the file existing. The cause was a hidden BOM (byte order mark) introduced when the file was created on Windows. Deleting and recreating the `.env` file with clean encoding resolved it. `prisma.config.ts` was also updated to read the file via `fs.readFileSync` as a more explicit fallback for future environments where `process.loadEnvFile` may behave unexpectedly.

**Prisma client not generated**

`npx prisma db push` syncs the schema to the database but does not generate the Prisma client. The app threw a missing module error on first run. `npx prisma generate` must be run once before `npm run dev`. The `build` script already handles this for production.
