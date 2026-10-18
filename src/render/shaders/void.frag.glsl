// The mist floor under and around the board (BackdropRenderer).
// `fogColorAt` and the precision statement come from fogcolor.glsl,
// prepended at the material's construction.

uniform float uTime;
uniform vec3 uFogColor;

varying vec3 vWorldPos;

void main() {
  gl_FragColor = vec4(fogColorAt(vWorldPos.xz, uTime, uFogColor), 1.0);
}
