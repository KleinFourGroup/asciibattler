// 108b — THE GROUND MARKS (Round 7.5 spec D3). Spliced into terrain.frag by
// TerrainRenderer (`groundMarkShaders`) only while the marks are on; with
// them off the terrain draws from its own two files, byte for byte. The
// table is groundMarks.ts's `MarkTable`: `uMarks` holds (x, z, extent,
// shape code) and (r, g, b, alpha) per mark, two texels each, MARKS_PER_ROW
// marks a row; `uMarkBins` holds each tile's mark indices + 1 in
// MARK_BIN_TEXELS texels, four to a texel, plates first, 0 ending the list.
//
// A mark is a WORLD shape on the ground plane, evaluated at this fragment's
// world XZ wherever terrain is drawn: the tile tops; the step faces the
// camera sees, where the face's XZ is the mark's edge, so the mark hangs down
// the face (the §106 drape, for free); and the hill mounds, whose material
// shares these uniforms. Depth is the terrain's own.
//
// The look is the signed §106 bookmark's (groundMarks.ts `DEFAULT_MARK_STYLE`):
// plates first (dark fill, then the frame in the body's colour), then every
// contact mark's dark fill, then every contact outline, so an outline is
// never under a neighbour's fill. A contact outline is the mock's ring: the
// shape less the shape scaled by (1 − stroke), so across an edge it is
// r · stroke · cos(π/n) wide.
//
// Edges are anti-aliased from the world position's screen derivatives, taken
// once, in uniform control flow: the per-tile loops below diverge within a
// pixel quad that straddles a tile edge, where dFdx is undefined. Each shape's
// own gradient turns them into a coverage width.

uniform highp sampler2D uMarks;
uniform highp sampler2D uMarkBins;
// (gridW, gridH) of the table; no marks draw while uMarkCount is 0.
uniform vec2 uMarkGrid;
uniform float uMarkCount;
// Contact marks: fill opacity, outline opacity, outline stroke (a fraction of
// the vertex radius, measured along it), unused.
uniform vec4 uContactStyle;
// Plates: fill opacity, frame opacity, frame width (world), corner radius (world).
uniform vec4 uPlateStyle;
// A dashed frame's gap width, world units; 0 draws it solid.
uniform float uPlateDashGap;

varying vec3 vMarkNormal;

// Coverage of {f <= 0} across an edge whose screen width, in f, is fw.
float markCover(float f, float fw) {
  return clamp(0.5 - f / fw, 0.0, 1.0);
}

// How much f changes across one pixel when f grows along world XZ direction g.
float markWidth(vec2 g, vec2 dpx, vec2 dpy) {
  return max(abs(dot(g, dpx)) + abs(dot(g, dpy)), 1e-6);
}

float markBinEntry(ivec2 tile, int k) {
  vec4 t = texelFetch(uMarkBins, ivec2(tile.x * MARK_BIN_TEXELS + k / 4, tile.y), 0);
  int lane = k % 4;
  return lane == 0 ? t.x : (lane == 1 ? t.y : (lane == 2 ? t.z : t.w));
}

// A contact shape as a support value: the shape is m <= apothem, grad is the
// outward direction m grows along. d = (dx, dz) from the mark's centre; r =
// the vertex radius. Shapes (groundMarks.ts): 0 circle; 1 diamond, vertices on
// the grid axes; 2 triangle, apex toward world −z, base at z = +r/2.
void contactShape(int shape, vec2 d, float r, out float m, out float apothem, out vec2 grad) {
  if (shape == 0) {
    m = length(d);
    grad = m > 1e-6 ? d / m : vec2(1.0, 0.0);
    apothem = r;
  } else if (shape == 1) {
    grad = vec2(d.x >= 0.0 ? 0.7071067811865476 : -0.7071067811865476,
                d.y >= 0.0 ? 0.7071067811865476 : -0.7071067811865476);
    m = dot(d, grad);
    apothem = r * 0.7071067811865476;
  } else {
    vec2 n1 = vec2(0.8660254037844386, -0.5);
    vec2 n2 = vec2(-0.8660254037844386, -0.5);
    m = d.y;
    grad = vec2(0.0, 1.0);
    float m1 = dot(d, n1);
    float m2 = dot(d, n2);
    if (m1 > m) { m = m1; grad = n1; }
    if (m2 > m) { m = m2; grad = n2; }
    apothem = r * 0.5;
  }
}

// A plate as a signed distance (f < 0 inside) with its outward gradient: the
// square of half-side h, its corners rounded to radius c.
void plateShape(vec2 d, float h, float c, out float f, out vec2 grad) {
  vec2 s = vec2(d.x >= 0.0 ? 1.0 : -1.0, d.y >= 0.0 ? 1.0 : -1.0);
  vec2 q = abs(d) - vec2(h - c);
  if (q.x > 0.0 && q.y > 0.0) {
    float l = length(q);
    f = l - c;
    grad = s * q / max(l, 1e-6);
  } else if (q.x > q.y) {
    f = q.x - c;
    grad = vec2(s.x, 0.0);
  } else {
    f = q.y - c;
    grad = vec2(0.0, s.y);
  }
}

// A dashed frame's coverage along its edge: two gaps per side, centred a
// third of the way from the middle to each corner, so the corners stay whole.
float plateDash(vec2 d, float h, vec2 dpx, vec2 dpy) {
  bool xEdge = abs(d.x) > abs(d.y); // on a side at x = ±h: the dash runs along z
  float u = xEdge ? d.y : d.x;
  vec2 along = xEdge ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  float e = abs(abs(u) - h / 3.0) - 0.5 * uPlateDashGap; // < 0 inside a gap
  return clamp(0.5 + e / markWidth(along, dpx, dpy), 0.0, 1.0);
}

vec3 applyGroundMarks(vec3 base) {
  if (uMarkCount < 0.5) return base;
  vec2 p = vWorldPos.xz;
  vec2 dpx = dFdx(p);
  vec2 dpy = dFdy(p);
  // The tile. On a step face XZ lies ON the tile boundary, so step inward
  // along the face's outward normal (a top's normal has no XZ; a mound's
  // is small, and by its own XZ an overhanging mound reads its neighbour's
  // marks, which is right for a mark drawn by XZ).
  vec2 pick = p - 1e-3 * vMarkNormal.xz;
  ivec2 tile = ivec2(floor(pick.x + 0.5 * uMarkGrid.x), floor(0.5 * uMarkGrid.y - pick.y));
  if (tile.x < 0 || tile.y < 0 || float(tile.x) >= uMarkGrid.x || float(tile.y) >= uMarkGrid.y) return base;

  // Pass 1: each plate's fill and frame (plates lead the bin), then each
  // contact mark's dark fill.
  for (int k = 0; k < MARK_BIN_DEPTH; k++) {
    float id = markBinEntry(tile, k);
    if (id < 0.5) break;
    int i = int(id) - 1;
    ivec2 at = ivec2((i % MARKS_PER_ROW) * 2, i / MARKS_PER_ROW);
    vec4 geo = texelFetch(uMarks, at, 0);
    vec4 col = texelFetch(uMarks, at + ivec2(1, 0), 0);
    vec2 d = p - geo.xy;
    int code = int(geo.w + 0.5);
    int shape = code % 4;
    if (shape == 3) {
      float f;
      vec2 g;
      plateShape(d, geo.z, uPlateStyle.w, f, g);
      float fw = markWidth(g, dpx, dpy);
      float fill = markCover(f, fw);
      base = mix(base, vec3(0.0), fill * uPlateStyle.x * col.a);
      float frame = fill * (1.0 - markCover(f + uPlateStyle.z, fw));
      if (code >= 4 && uPlateDashGap > 0.0) frame *= plateDash(d, geo.z, dpx, dpy);
      base = mix(base, col.rgb, frame * uPlateStyle.y * col.a);
    } else {
      float m;
      float a;
      vec2 g;
      contactShape(shape, d, geo.z, m, a, g);
      float fill = markCover(m - a, markWidth(g, dpx, dpy));
      base = mix(base, vec3(0.0), fill * uContactStyle.x * col.a);
    }
  }

  // Pass 2: the contact outlines, over every fill.
  for (int k = 0; k < MARK_BIN_DEPTH; k++) {
    float id = markBinEntry(tile, k);
    if (id < 0.5) break;
    int i = int(id) - 1;
    ivec2 at = ivec2((i % MARKS_PER_ROW) * 2, i / MARKS_PER_ROW);
    vec4 geo = texelFetch(uMarks, at, 0);
    int shape = int(geo.w + 0.5) % 4;
    if (shape == 3) continue;
    vec4 col = texelFetch(uMarks, at + ivec2(1, 0), 0);
    float m;
    float a;
    vec2 g;
    contactShape(shape, p - geo.xy, geo.z, m, a, g);
    float fw = markWidth(g, dpx, dpy);
    float ring = markCover(m - a, fw) * (1.0 - markCover(m - a * (1.0 - uContactStyle.z), fw));
    base = mix(base, col.rgb, ring * uContactStyle.y * col.a);
  }
  return base;
}
