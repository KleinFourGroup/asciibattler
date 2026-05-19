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
// Per-sprite multiplier on the sprite's contribution to the bloom buffer
// (B1.1 selective bloom). Only the bloom-layer fragment shader applies
// it; the main-layer shader ignores it. 0.0 = no halo (sprite still
// visible at natural color); 1.0 = natural contribution (halo iff color
// crosses the high-pass threshold); >1.0 = forced strong glow for
// emphasis (attack windups, criticals, elite tier). Lerping 0↔1 fades
// the halo smoothly while the sprite's visible color never changes.
attribute float instanceBloomIntensity;

uniform float uSpriteSize;

varying vec2 vAtlasUV;
varying vec3 vColor;
varying float vAlpha;
varying float vBloomIntensity;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(instancePosition, 1.0);
  mvPos.xy += position.xy * uSpriteSize;
  gl_Position = projectionMatrix * mvPos;

  vAtlasUV = mix(instanceGlyphUV.xy, instanceGlyphUV.zw, uv);
  vColor = instanceColor;
  vAlpha = instanceAlpha;
  vBloomIntensity = instanceBloomIntensity;
}
