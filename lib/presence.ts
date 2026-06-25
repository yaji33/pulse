// How long a presence row survives without a heartbeat (poll). After this the
// dot is treated as offline and removed — implements "dot disappears when the
// user leaves" even if their tab closed without a clean leave.
export const STALE_MS = 15_000;

// Orphan signals (mailbox messages never drained) are cleaned up after this.
export const SIGNAL_TTL_MS = 60_000;

// Client poll interval. Kept here so client + server reason about the same cadence.
export const POLL_INTERVAL_MS = 1_500;

// Minimum gap the server accepts between polls from one session. Legitimate
// clients poll every POLL_INTERVAL_MS, so anything well below this is abuse.
export const MIN_POLL_INTERVAL_MS = 500;

// How long a whisper lingers on the map before it's reaped. Long enough to keep
// the map feeling inhabited across sessions, short enough to stay ephemeral.
export const WHISPER_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Max characters in a whisper. Keeps the map readable and caps the payload.
export const WHISPER_MAX_LEN = 80;

// Min gap between whispers from one session (anti-spam).
export const MIN_WHISPER_INTERVAL_MS = 10_000;
