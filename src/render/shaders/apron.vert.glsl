// M4 apron (battle-backdrop ring). Same prism inputs as terrain.vert minus
// the top-UV channel — the apron stamps no grid lines; the missing grid is
// the deliberate "not playable" cue. Adds the world-position varying the
// fragment fade needs (distance from the playable rect is a world-space
// question, so it can't be baked per-vertex without seams on the prism
// sides).

precision highp float;

attribute vec3 aColor;
attribute vec2 aAnim;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vAnim;
varying vec3 vWorldPos;

void main() {
  vColor = aColor;
  vNormalW = normalize(normalMatrix * normal);
  vAnim = aAnim;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
