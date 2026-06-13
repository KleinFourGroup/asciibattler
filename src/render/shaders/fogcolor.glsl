// M4 playtest — the shared mist-color function, prepended (TS-side string
// concat at material construction) to every fragment shader that needs
// "what color is the fog at this world XZ": the backdrop plane displays it
// directly; the apron fades toward it so a fully-fogged tile is
// pixel-identical to the mist behind it. One copy — the two consumers
// cannot drift.
//
// Pure functions only — no uniform declarations (each host shader passes
// its own time/base color), so concatenation can't double-declare.

precision highp float;

float fogHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Smoothed value noise in [0, 1].
float fogNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(fogHash(i), fogHash(i + vec2(1.0, 0.0)), u.x),
    mix(fogHash(i + vec2(0.0, 1.0)), fogHash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

// Mist amplitude fades to zero with distance from the board (world
// origin), so the plane's far reaches — and any ultrawide-aspect sliver
// past its horizon — converge on the flat scene background. Both ends of
// that blend are the same color: no seam, anywhere.
const float MIST_CALM_NEAR = 22.0;
const float MIST_CALM_FAR = 90.0;
// Relative luminance swing of the mist around the base color (subtle —
// the base is near-black, so ±20% reads as a slow dark roil, not weather).
const float MIST_AMPLITUDE = 0.4;

// Two octaves of value noise drifting in different directions — cheap,
// and the cross-drift keeps the pattern from reading as a scrolling
// texture.
vec3 fogColorAt(vec2 p, float t, vec3 base) {
  float n = fogNoise(p * 0.35 + vec2(t * 0.12, -t * 0.08))
          + 0.5 * fogNoise(p * 0.85 + vec2(-t * 0.05, t * 0.09));
  n /= 1.5;
  float amp = 1.0 - smoothstep(MIST_CALM_NEAR, MIST_CALM_FAR, length(p));
  return base * (1.0 + (n - 0.5) * MIST_AMPLITUDE * amp);
}
