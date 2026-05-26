// Terrain (C1c faceted low-poly + D7.C per-tile animation).
//
// Diffuse shading from a fixed light direction plus an ambient floor.
// No scene lights — this material has no spill into the sprite renderers
// (which are unlit by design). Grid line stamped on the top face only,
// via `vIsTop` from the vertex shader.
//
// D7.C: `vAnim.x` selects a per-tile animation (0=none, 1=fire, 2=healing)
// and `vAnim.y` is the per-tile phase offset. Animation is applied
// uniformly across the prism (top + sides) so a fire tile's side faces
// also glow — sides are dimmer via the baked SIDE_SHADE multiplier in
// the vertex color, so the visual amplitude tapers naturally. Animation
// runs BEFORE the grid-line stamp so the grid stays canonical and doesn't
// itself flicker.

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

void main() {
  float diffuse = max(0.0, dot(normalize(vNormalW), normalize(uLightDir)));
  float shading = uAmbient + (1.0 - uAmbient) * diffuse;
  vec3 base = vColor * shading;

  // D7.C per-tile animation. Two sines summed for fire so the flicker
  // reads as "alive" rather than a single rhythmic pulse. Healing uses a
  // single slow sine with small amplitude — a gentle "I'm-here" pulse,
  // not a flicker.
  if (vAnim.x > 1.5) {
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
