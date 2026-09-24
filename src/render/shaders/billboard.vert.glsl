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
// Per-sprite size multiplier on top of the global uSpriteSize. 1.0 = the
// default unit/wall glyph size; <1.0 shrinks (E6.B ranged tracers spawn
// smaller so they read as a bolt rather than a full glyph). Scales the
// quad about the instance ANCHOR (below), so the bloom mesh — which
// shares this shader + these buffers — shrinks its halo to match for free.
attribute float instanceSize;
// §79c — the quad-local point (quad spans [-0.5, 0.5]²) that coincides with
// the projected instancePosition. (0, 0) = the quad CENTERS on its anchor
// (the historical behavior — projectiles, markers, motes float AT a point);
// (0, -0.5) = the quad's BASE sits on its anchor (a unit STANDS on its
// tile). Applied in VIEW space, where X/Y are screen-right/up by
// construction — so the vertical rise off a ground anchor is always
// screen-up, never the off-axis diagonal a world-Y lift projects to under
// the pitched camera (the I2/J3/79b off-axis class, killed structurally).
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

  // 107d-post — UPRIGHT DEPTH for a sprite that stands (base-anchored: its
  // anchor sits below the quad's centre). The camera-facing card leans back
  // by the camera's pitch, so a tile just behind the anchor that stands higher
  // (a diagonal move past a higher corner) was nearer than the card's lower
  // band and hid it. Each vertex keeps its screen position and takes the depth
  // of the world-vertical card through the anchor instead: world-up in view
  // space is (0, upV.y, upV.z), so a point `offset.y` up the screen stands
  // `offset.y * upV.z / upV.y` nearer. Terrain behind the anchor can no longer
  // cut into a standing glyph; terrain in front of it still hides the feet.
  // Exact under ortho; under a dev lens the depth is the upright point's, taken
  // at this vertex. Pinned by tests/board/clip.test.ts. Landing note: re-read
  // against the hop (lifting the move over the corner) once §108's ground
  // marks exist (ROADMAP §108).
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
