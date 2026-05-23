// C1c variant A: flat grid terrain. Vertex shader just forwards world
// XZ so the fragment can do the cell lookup and grid-line math.

precision highp float;

varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
