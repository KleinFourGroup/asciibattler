// Standard fullscreen ShaderPass vertex shader: pass UV through, write
// clip-space position from the post-process quad. Shared by every
// post-process fragment pass in this folder so they don't each carry an
// identical copy.
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
