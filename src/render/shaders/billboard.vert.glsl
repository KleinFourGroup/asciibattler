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
// The sprite's multiplier on its contribution to the bloom buffer. Only the
// bloom layer's fragment shader applies it; the main layer's ignores it. 0 is
// no halo (the sprite still visible at its own colour); 1 the colour's own
// halo (the bloom's threshold is 0, so any colour halos); above 1 a stronger
// glow. Lerping 0 ↔ 1 fades the halo while the sprite's visible colour never
// changes.
attribute float instanceBloomIntensity;
// The sprite's size multiplier over the global uSpriteSize: 1 is a unit's or
// wall's glyph; below 1 shrinks (a tracer reads as a bolt, not a full glyph).
// It scales the quad about the instance's anchor (below), so the bloom mesh,
// which shares this shader and these buffers, shrinks its halo to match.
attribute float instanceSize;
// The quad-local point (the quad spans [-0.5, 0.5]²) that meets the projected
// instancePosition. (0, 0): the quad centres on its anchor (projectiles,
// motes, the aura ring float at a point); (0, -0.5): the quad's base sits on
// its anchor (a unit stands on its tile). Applied in view space, where X and Y
// are screen-right and up by construction, so the rise off a ground anchor is
// always screen-up, never the off-axis diagonal a world-Y lift projects to
// under a perspective camera.
attribute vec2 instanceAnchor;

uniform float uSpriteSize;

varying vec2 vAtlasUV;
varying vec3 vColor;
varying float vAlpha;
varying float vBloomIntensity;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(instancePosition, 1.0);
  vec2 offset = (position.xy - instanceAnchor) * uSpriteSize * instanceSize;
  mvPos.xy += offset;
  gl_Position = projectionMatrix * mvPos;

  // Upright depth for a sprite that stands (base-anchored: its anchor sits
  // below the quad's centre; gotcha #139). The camera-facing card leans back
  // by the camera's pitch, so a higher tile just behind the anchor (a diagonal
  // move past a higher corner) would be nearer than the card's lower band and
  // hide it. Each vertex keeps its screen position and takes the depth of the
  // world-vertical card through the anchor instead: world-up in view space is
  // (0, upV.y, upV.z), so a point `offset.y` up the screen stands
  // `offset.y * upV.z / upV.y` nearer. Terrain behind the anchor can't cut into
  // a standing glyph; terrain in front of it still hides the feet. Exact under
  // ortho; under a dev lens the depth is the upright point's, taken at this
  // vertex. Pinned by tests/board/clip.test.ts.
  if (instanceAnchor.y < 0.0) {
    vec3 upV = mat3(viewMatrix) * vec3(0.0, 1.0, 0.0);
    vec4 upright = mvPos;
    upright.z += offset.y * upV.z / upV.y;
    vec4 clip = projectionMatrix * upright;
    gl_Position.z = clip.z / clip.w * gl_Position.w;
  }

  vAtlasUV = mix(instanceGlyphUV.xy, instanceGlyphUV.zw, uv);
  vColor = instanceColor;
  vAlpha = instanceAlpha;
  vBloomIntensity = instanceBloomIntensity;
}
