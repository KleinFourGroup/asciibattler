// M4 playtest — the mist floor under/around the board (BackdropRenderer).
// `fogColorAt` (and the file's precision statement) comes from
// fogcolor.glsl, prepended at material construction.

uniform float uTime;
uniform vec3 uFogColor;

varying vec3 vWorldPos;

void main() {
  gl_FragColor = vec4(fogColorAt(vWorldPos.xz, uTime, uFogColor), 1.0);
}
