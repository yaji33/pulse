// Factories for the custom Mapbox marker DOM elements. Styling lives in
// globals.css (.me-marker / .stranger-marker) so the markers stay in sync with
// the rest of the design system.

export function createMeMarkerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "me-marker";
  el.innerHTML = `
    <span class="me-label">ME</span>
    <span class="me-ring"></span>
    <span class="me-dot"></span>
  `;
  return el;
}

export function createStrangerMarkerEl(): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "stranger-marker";
  el.title = "Connect";
  return el;
}
