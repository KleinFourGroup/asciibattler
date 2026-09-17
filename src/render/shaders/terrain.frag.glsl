// Terrain (C1c faceted low-poly + D7.C per-tile animation).
//
// Diffuse shading from a fixed light direction plus an ambient floor.
// No scene lights — this material has no spill into the sprite renderers
// (which are unlit by design). Grid line stamped on the top face only,
// via `vIsTop` from the vertex shader.
//
// D7.C: `vAnim.x` selects a per-tile animation (0=none, 1=fire, 2=healing,
// 3=deep water — 98d) and `vAnim.y` is the per-tile phase offset. Animation
// is applied uniformly across the prism (top + sides) so a fire tile's side
// faces also glow — sides are dimmer via the baked SIDE_SHADE multiplier in
// the vertex color, so the visual amplitude tapers naturally. Animation
// runs BEFORE the grid-line stamp so the grid stays canonical and doesn't
// itself flicker.
//
// 98e — DEEP WATER (id 3) is not an animation but a STATIC SURFACE PATTERN:
// diagonal bands across the top face, the "never color alone" tell for the
// passable / impassable split (deep water is coplanar with shallow since
// §37b, so until 98e the two blues' luminance gap was the only read). The
// bands run in WORLD space (`vWorldPos`, 98e-post) with an integer count
// per world unit — the same formula as apron.frag — so the pattern is
// continuous across tile edges AND across the board edge into the apron
// (a tile-UV formula ran the opposite diagonal there: the user's catch).
// One band per tile (98e-post, the user's read: two read as a hazard
// stripe); the amplitude is small (the tile stays a dark navy plane).
// The `uTime * DEEP_DRIFT` term is the §99 drift (99d): a slow phase
// drift along the diagonal — one band width per ~16 s at 0.4 rad/s — for
// motion-on players; the static bands are the tell, the wave is flair
// (the §98 kickoff's call E). Under reduced motion BattleScene HOLDS
// `uTime` (`advanceShaderTime`, the one shader-motion gate), so the bands
// (and the fire flicker, the healing shimmer, the mist) stand still with
// no branch here. Keep the constant equal in apron.frag — the two shaders
// share the formula so the pattern is continuous across the board edge.

precision highp float;

uniform vec3 uLightDir;
uniform float uAmbient;
uniform vec3 uGridLineColor;
uniform float uGridLineWidth;
uniform float uTime;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vTopUV;
varying float vIsTop;
varying vec2 vAnim;
varying vec3 vWorldPos;

void main() {
  float diffuse = max(0.0, dot(normalize(vNormalW), normalize(uLightDir)));
  float shading = uAmbient + (1.0 - uAmbient) * diffuse;
  vec3 base = vColor * shading;

  // D7.C per-tile animation. Two sines summed for fire so the flicker
  // reads as "alive" rather than a single rhythmic pulse. Healing uses a
  // single slow sine with small amplitude — a gentle "I'm-here" pulse,
  // not a flicker.
  if (vAnim.x > 2.5) {
    // 98e — deep water: static diagonal bands on the top face (see the header).
    const float DEEP_BANDS_PER_TILE = 1.0; // integer → continuous across tiles; 98e-post: 2 read as a hazard stripe
    const float DEEP_BAND_AMPLITUDE = 0.22;
    const float DEEP_DRIFT = 0.4; // 99d: rad/s along the diagonal (= apron.frag); reduced motion holds uTime instead
    if (vIsTop > 0.5) {
      // World space, the apron's formula verbatim — one diagonal on both sides of the board edge.
      float wave = sin((vWorldPos.x + vWorldPos.z) * 6.28318530718 * DEEP_BANDS_PER_TILE + uTime * DEEP_DRIFT);
      base *= 1.0 + DEEP_BAND_AMPLITUDE * wave;
    }
  } else if (vAnim.x > 1.5) {
    base *= 1.0 + 0.10 * sin(uTime * 1.6 + vAnim.y);
  } else if (vAnim.x > 0.5) {
    float f = sin(uTime * 6.0 + vAnim.y) * 0.5
            + sin(uTime * 9.7 + vAnim.y * 1.7) * 0.5;
    base *= 1.0 + 0.30 * f;
  }

  if (vIsTop > 0.5) {
    vec2 edgeDist = min(vTopUV, 1.0 - vTopUV);
    float edge = min(edgeDist.x, edgeDist.y);
    float lineAlpha = 1.0 - smoothstep(0.0, uGridLineWidth, edge);
    base = mix(base, uGridLineColor, lineAlpha * 0.6);
  }

  gl_FragColor = vec4(base, 1.0);
}
