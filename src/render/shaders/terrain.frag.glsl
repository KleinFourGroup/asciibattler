// Terrain fragment shader. Two-stop palette blend by height (low → mid
// → high) plus a subtle slope-darkening factor so steeper faces read
// distinct from flat ground. World up is +Y, so abs(normal.y) ≈ 1 on
// flat ground.

precision highp float;

uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;
uniform float uMinY;
uniform float uMaxY;

varying float vWorldY;
varying vec3 vNormalW;

void main() {
  float t = smoothstep(uMinY, uMaxY, vWorldY);

  vec3 color = t < 0.5
    ? mix(uColorLow, uColorMid, smoothstep(0.0, 0.5, t))
    : mix(uColorMid, uColorHigh, smoothstep(0.5, 1.0, t));

  float slope = 1.0 - clamp(abs(vNormalW.y), 0.0, 1.0);
  color *= 1.0 - slope * 0.35;

  gl_FragColor = vec4(color, 1.0);
}
