// C1c variants B/C: prism-per-tile terrain.
//
// Diffuse shading from a fixed light direction (in view space) plus an
// ambient floor — no scene lights, so this material has no spill into
// the rest of the scene (sprites are unlit by design). Grid line stamped
// only on the top face via `vIsTop`.

precision highp float;

uniform vec3 uLightDir;
uniform float uAmbient;
uniform vec3 uGridLineColor;
uniform float uGridLineWidth;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vTopUV;
varying float vIsTop;

void main() {
  float diffuse = max(0.0, dot(normalize(vNormalW), normalize(uLightDir)));
  float shading = uAmbient + (1.0 - uAmbient) * diffuse;
  vec3 base = vColor * shading;

  if (vIsTop > 0.5) {
    vec2 edgeDist = min(vTopUV, 1.0 - vTopUV);
    float edge = min(edgeDist.x, edgeDist.y);
    float lineAlpha = 1.0 - smoothstep(0.0, uGridLineWidth, edge);
    base = mix(base, uGridLineColor, lineAlpha * 0.6);
  }

  gl_FragColor = vec4(base, 1.0);
}
