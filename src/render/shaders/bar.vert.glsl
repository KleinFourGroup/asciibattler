// Camera-facing billboard quad for HP / progress bars. Same view-space
// offset trick as billboard.vert.glsl, but width and height come from a
// per-instance vec2 instead of a single uniform — HP bars are wider than
// progress bars and we don't want two materials for that.
//
// Pass through the quad's local uv unchanged. The fragment shader uses
// uv.x to decide which side of `instanceFillPct` it's on (bg vs fill).

attribute vec3 instancePosition;
attribute vec2 instanceSize;
attribute float instanceFillPct;
attribute vec3 instanceBgColor;
attribute vec3 instanceFillColor;
attribute float instanceAlpha;

varying vec2 vUv;
varying float vFillPct;
varying vec3 vBgColor;
varying vec3 vFillColor;
varying float vAlpha;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(instancePosition, 1.0);
  mvPos.xy += position.xy * instanceSize;
  gl_Position = projectionMatrix * mvPos;

  vUv = uv;
  vFillPct = instanceFillPct;
  vBgColor = instanceBgColor;
  vFillColor = instanceFillColor;
  vAlpha = instanceAlpha;
}
