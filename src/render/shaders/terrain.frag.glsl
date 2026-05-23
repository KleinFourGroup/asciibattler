// Terrain (C1c faceted low-poly).
//
// Diffuse shading from a fixed light direction plus an ambient floor.
// No scene lights — this material has no spill into the sprite renderers
// (which are unlit by design). Grid line stamped on the top face only,
// via `vIsTop` from the vertex shader.

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
