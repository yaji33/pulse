// Mood signals are a fixed allowlist shared by client and server. Presets only:
// the entire input surface is these strings, so there's no free-text abuse
// vector and nothing to moderate. Category drives the marker aura.

export type MoodCategory = "warm" | "quiet";

export interface Mood {
  value: string;
  category: MoodCategory;
}

export const MOODS: Mood[] = [
  { value: "curious", category: "warm" },
  { value: "need to talk", category: "warm" },
  { value: "in a good place", category: "warm" },
  { value: "killing time", category: "warm" },
  { value: "bored", category: "warm" },
  { value: "can't sleep", category: "quiet" },
  { value: "restless", category: "quiet" },
  { value: "something's off", category: "quiet" },
  { value: "lonely", category: "quiet" },
  { value: "overwhelmed", category: "quiet" },
  { value: "just passing through", category: "quiet" },
  { value: "just here", category: "quiet" },
];

const BY_VALUE = new Map(MOODS.map((m) => [m.value, m]));

export function isValidMood(value: unknown): value is string {
  return typeof value === "string" && BY_VALUE.has(value);
}

export function moodCategory(value: string | null | undefined): MoodCategory | null {
  if (!value) return null;
  return BY_VALUE.get(value)?.category ?? null;
}
