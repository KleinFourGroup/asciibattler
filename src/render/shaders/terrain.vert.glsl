// Terrain vertex shader. Vertex displacement happens CPU-side (so the
// noise stays seeded and deterministic), so the shader just forwards
// world-space Y and the transformed normal to the fragment shader.

varying float vWorldY;
varying vec3 vNormalW;

void main() {
  vWorldY = position.y;
  vNormalW = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
