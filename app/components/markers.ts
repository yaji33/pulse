// Factories for the custom Mapbox marker DOM elements. Styling lives in
// globals.css so the markers stay in sync with the design system. Mood and
// whisper text use textContent, never innerHTML, so a tampered value can never
// inject markup.

import { moodCategory } from "@/lib/moods";

function span(className: string, text?: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function createMeMarkerEl(mood: string | null): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "me-marker";

  const category = moodCategory(mood);
  // The identity ring carries the mood: warm pulses faster, quiet slower.
  const ringClass = category ? `me-ring mood-${category}` : "me-ring";

  el.append(span("me-label", "ME"), span(ringClass), span("me-dot"));
  if (mood) el.append(span("mood-pill mood-pill-below", mood));
  return el;
}

export function createStrangerMarkerEl(mood: string | null): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "stranger-marker";
  el.title = "Connect";

  const category = moodCategory(mood);
  if (category) el.append(span(`mood-aura mood-${category}`));
  el.append(span("stranger-dot"));
  if (mood) el.append(span("mood-pill mood-pill-above stranger-mood", mood));
  return el;
}
