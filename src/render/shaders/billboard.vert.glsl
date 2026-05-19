// Camera-facing billboard for ASCII sprites. Transforms the instance's
// world position into view space, then offsets by the quad-local
// position in view space — in view space the camera looks down -Z, so
// X/Y are screen-right/up regardless of camera orientation, and the
// quad ends up facing the camera for free.
//
// Each instance also carries a UV rect into the font atlas; we
// interpolate it by the quad's local UV so bottom-left (uv=0,0) maps to
// (u0,v0) and top-right (uv=1,1) maps to (u1,v1).

attribute vec3 instancePosition;
attribute vec4 instanceGlyphUV;
attribute vec3 instanceColor;
attribute float instanceAlpha;

uniform float uSpriteSize;

varying vec2 vAtlasUV;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(instancePosition, 1.0);
  mvPos.xy += position.xy * uSpriteSize;
  gl_Position = projectionMatrix * mvPos;

  vAtlasUV = mix(instanceGlyphUV.xy, instanceGlyphUV.zw, uv);
  vColor = instanceColor;
  vAlpha = instanceAlpha;
}
