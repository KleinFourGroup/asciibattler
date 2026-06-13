// M4 playtest — backdrop mist plane (BackdropRenderer). World position
// through; all the look lives in the fragment's fogColorAt.

precision highp float;

varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
