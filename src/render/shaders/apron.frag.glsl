// M4 apron fade. Lighting + per-tile animation are copied from terrain.frag
// (same fixed light direction, same fire/healing branches) so the ring is
// indistinguishable from the board until the fog term kicks in — the apron
// is "the same ground continuing", not a new material. No grid-line stamp:
// grid lines ending at the playable edge is the legibility cue.
//
// The fog itself: distance outside the playable rect (rect SDF on world XZ,
// so corners round off), wobbled by summed sines over uTime so the mist
// edge slowly creeps, then either smoothstepped (uDither 0, the default)
// or thresholded against a 4×4 Bayer matrix in screen space (uDither 1)
// for a terminal-flavored stipple dissolve. The fog TARGET color is the
// BackdropRenderer mist sampled where this fragment's view ray meets the
// mist plane (`fogColorAt` + the precision statement come from
// fogcolor.glsl, prepended at material construction) — a fully fogged
// pixel is pixel-identical to the mist behind it, so the dissolve reads
// as the ground sinking into fog, no transparency needed, and the
// billboard sprites never alpha-sort against the apron.
//
// M4 playtest additions: the near-black edge band on the ring's innermost
// sliver (the strong playable-boundary read) and the mist-ray fog target.

uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uTime;
uniform vec2 uPlayHalf;
uniform float uFadeEnd;
uniform vec3 uFogColor;
uniform float uDither;
uniform float uMistY;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vAnim;
varying vec3 vWorldPos;

// Screen-pixel chunk size for the stipple — >1 so the dither reads as
// deliberate chunky CRT dither instead of per-pixel noise on high-DPI
// displays.
const float DITHER_CELL_PX = 3.0;

// 2×2 Bayer cell value in {0,1,2,3}, arithmetic form — GLSL ES 1.00 has no
// dynamic array indexing.
float bayer2(vec2 p) {
  p = floor(mod(p, 2.0));
  return 3.0 * p.y + 2.0 * p.x - 4.0 * p.x * p.y;
}

// 4×4 Bayer threshold in (0, 1).
float bayer4(vec2 p) {
  return (4.0 * bayer2(p) + bayer2(floor(p / 2.0)) + 0.5) / 16.0;
}

void main() {
  float diffuse = max(0.0, dot(normalize(vNormalW), normalize(uLightDir)));
  float shading = uAmbient + (1.0 - uAmbient) * diffuse;
  vec3 base = vColor * shading;

  if (vAnim.x > 1.5) {
    base *= 1.0 + 0.10 * sin(uTime * 1.6 + vAnim.y);
  } else if (vAnim.x > 0.5) {
    float f = sin(uTime * 6.0 + vAnim.y) * 0.5
            + sin(uTime * 9.7 + vAnim.y * 1.7) * 0.5;
    base *= 1.0 + 0.30 * f;
  }

  // Rect SDF: 0 at the playable edge, growing outward.
  vec2 outside = max(abs(vWorldPos.xz) - uPlayHalf, 0.0);
  float d = length(outside);

  // M4 playtest — crisp near-black band on the ring's innermost sliver:
  // the strong playable-edge outline (the board's own grid lines are
  // thinner and only 0.6-mixed). Applied before the fog, but at d≈0 the
  // fog is ≈0, so the band renders effectively unfogged. Also catches the
  // inner-rim side faces (d=0 there), so a sunken apron tile shows a dark
  // seam wall against the board.
  const float EDGE_BAND_TILES = 0.12;
  const float EDGE_BAND_AA = 0.05;
  float band = 1.0 - smoothstep(EDGE_BAND_TILES - EDGE_BAND_AA, EDGE_BAND_TILES, d);
  base = mix(base, vec3(0.02), band * 0.85);

  // Creep — the mist edge breathes. Amplitudes sum to CREEP_MAX_TILES
  // (ApronRenderer shortens uFadeEnd by the same amount so the outer rim
  // stays fully fogged even at the creep's deepest inhale).
  float creep = 0.18 * sin(vWorldPos.x * 1.9 + uTime * 0.7)
              + 0.14 * sin(vWorldPos.z * 2.6 - uTime * 0.53)
              + 0.13 * sin((vWorldPos.x + vWorldPos.z) * 1.3 + uTime * 1.1);

  float fog = smoothstep(0.0, uFadeEnd, d + creep);
  float fogMix = uDither > 0.5
    ? step(bayer4(gl_FragCoord.xy / DITHER_CELL_PX), fog)
    : fog;

  // M4 playtest — fade toward the mist the camera would see behind this
  // fragment: project the view ray down to the mist plane and sample the
  // shared fogColorAt there. The ray always points downward at our locked
  // 45° pitch; the min() guard keeps a degenerate near-horizontal ray
  // from exploding the projection.
  vec3 rayDir = normalize(vWorldPos - cameraPosition);
  float toMist = (uMistY - vWorldPos.y) / min(rayDir.y, -0.05);
  vec3 fogTarget = fogColorAt(vWorldPos.xz + rayDir.xz * toMist, uTime, uFogColor);

  gl_FragColor = vec4(mix(base, fogTarget, fogMix), 1.0);
}
