// The apron's ring. The prism inputs of terrain.vert less the top UV: the
// apron stamps no grid lines, the missing grid being the cue that it is not
// playable. It adds the world position the fragment's fade needs (distance
// from the playable rectangle is a world-space question, which per-vertex
// values can't answer without seams on the prism sides).

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
