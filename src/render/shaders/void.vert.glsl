// The mist floor's plane (BackdropRenderer). The world position passes
// through; the look is all in the fragment's fogColorAt.

precision highp float;

varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
