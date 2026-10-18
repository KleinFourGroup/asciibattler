// The terrain's faceted prisms and their per-tile animation.
//
// Diffuse shading from a fixed light direction plus an ambient floor, with no
// scene lights, so nothing spills onto the sprite renderers, which are unlit.
// The grid line is stamped on the top face only (`vIsTop`).
//
// `vAnim.x` picks the tile's animation (0 none, 1 fire, 2 healing, 3 deep
// water) and `vAnim.y` is its phase. Fire and healing apply across the prism,
// so a fire tile's sides glow too, dimmer by the SIDE_SHADE baked into their
// colour. The animation runs before the grid stamp, so the grid doesn't
// flicker.
//
// Deep water is a pattern, not an animation: diagonal bands across the top
// face, so the passable/impassable split is never told by colour alone (deep
// water is level with shallow). The bands run in world space with a whole
// number per world unit, the formula apron.frag uses too, so the pattern is
// continuous across tile edges and across the board's edge into the apron.
// One band per tile, since two read as a hazard stripe; the amplitude is
// small, so the tile stays a dark navy plane. The `uTime * DEEP_DRIFT` term
// drifts the bands along the diagonal, one band width per ~10 s at 0.6 rad/s:
// the bands are the tell, the drift is flair. Under reduced motion BattleScene
// holds `uTime` (`advanceShaderTime`, the one shader-motion gate), so the
// bands stand still, as do the fire, the healing and the mist, with no branch
// here. DEEP_DRIFT equals apron.frag's (TerrainRenderer.test.ts pins the
// two), or the two halves of a band slide apart at the board's edge.

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

  // The per-tile animation. Fire sums two sines, so its flicker reads as
  // alive rather than as one rhythmic pulse; healing is one slow sine of
  // small amplitude, a gentle pulse, not a flicker.
  if (vAnim.x > 2.5) {
    // Deep water: diagonal bands on the top face (see the header).
    const float DEEP_BANDS_PER_TILE = 1.0; // whole → continuous across tiles
    const float DEEP_BAND_AMPLITUDE = 0.22;
    const float DEEP_DRIFT = 0.6; // rad/s along the diagonal (= apron.frag)
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
