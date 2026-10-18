// The apron's fade. Lighting and the per-tile animation follow terrain.frag
// (the same light, the same fire, healing and deep-water branches), so the
// ring matches the board until the fog takes it: the same ground
// continuing, not a new material. No grid stamp: grid lines ending at the
// playable edge are the legibility cue.
//
// The fog: the distance outside the playable rectangle (a rectangle SDF on
// world XZ, so its corners round off), wobbled by summed sines over uTime so
// the mist's edge creeps, then smoothstepped. Its target colour is the mist
// floor's, sampled where this fragment's view ray meets the mist plane
// (`fogColorAt` and the precision statement come from fogcolor.glsl,
// prepended at the material's construction), so a fully fogged pixel matches
// the mist behind it: the ground sinks into fog with no transparency, and
// the billboard sprites never alpha-sort against the apron.

uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uTime;
uniform vec2 uPlayHalf;
uniform float uFadeEnd;
uniform vec3 uFogColor;
uniform float uMistY;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec2 vAnim;
varying vec3 vWorldPos;

void main() {
  float diffuse = max(0.0, dot(normalize(vNormalW), normalize(uLightDir)));
  float shading = uAmbient + (1.0 - uAmbient) * diffuse;
  vec3 base = vColor * shading;

  if (vAnim.x > 2.5) {
    // Deep water's bands: terrain.frag's world-space formula, one band per
    // tile, so a clamp-sampled deep tile at the edge continues its pattern
    // into the fog. DEEP_DRIFT must equal terrain.frag's, or the two halves
    // of a band slide apart at the edge.
    const float DEEP_DRIFT = 0.6;
    float wave = sin((vWorldPos.x + vWorldPos.z) * 6.28318530718 * 1.0 + uTime * DEEP_DRIFT);
    base *= 1.0 + 0.22 * wave;
  } else if (vAnim.x > 1.5) {
    base *= 1.0 + 0.10 * sin(uTime * 1.6 + vAnim.y);
  } else if (vAnim.x > 0.5) {
    float f = sin(uTime * 6.0 + vAnim.y) * 0.5
            + sin(uTime * 9.7 + vAnim.y * 1.7) * 0.5;
    base *= 1.0 + 0.30 * f;
  }

  // Rect SDF: 0 at the playable edge, growing outward.
  vec2 outside = max(abs(vWorldPos.xz) - uPlayHalf, 0.0);
  float d = length(outside);

  // A crisp near-black band on the ring's innermost sliver, the strong
  // outline of the playable edge (the board's own grid lines are thinner
  // and mixed only 0.6). Applied before the fog, which the creep can raise
  // to about 0.3 within the band; the band stays dark, the fog's target
  // being dark too. It also darkens the ring's inner side faces (d = 0
  // there), the wall an apron tile raised above the board's edge shows.
  const float EDGE_BAND_TILES = 0.12;
  const float EDGE_BAND_AA = 0.05;
  float band = 1.0 - smoothstep(EDGE_BAND_TILES - EDGE_BAND_AA, EDGE_BAND_TILES, d);
  base = mix(base, vec3(0.02), band * 0.85);

  // The creep: the mist's edge breathes. The amplitudes sum to CREEP_MAX_TILES
  // (ApronRenderer shortens uFadeEnd by the same amount so the outer rim
  // stays fully fogged even at the creep's deepest inhale).
  float creep = 0.18 * sin(vWorldPos.x * 1.9 + uTime * 0.7)
              + 0.14 * sin(vWorldPos.z * 2.6 - uTime * 0.53)
              + 0.13 * sin((vWorldPos.x + vWorldPos.z) * 1.3 + uTime * 1.1);

  float fog = smoothstep(0.0, uFadeEnd, d + creep);

  // Fade toward the mist the camera would see behind this fragment: project
  // the view ray down to the mist plane and sample the shared fogColorAt
  // there. The ray always points down (players' camera is pitched 45°, never
  // level); the min() guard keeps a near-horizontal ray from blowing up the
  // projection. Under an orthographic camera the view rays are parallel (the
  // camera's forward axis, row 2 of the view rotation); a ray from
  // cameraPosition would fan out and paint a ghost ring of mist. three.js
  // injects `isOrthographic`; the perspective branch serves the board
  // explorer's perspective camera.
  vec3 rayDir = isOrthographic
    ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])
    : normalize(vWorldPos - cameraPosition);
  float toMist = (uMistY - vWorldPos.y) / min(rayDir.y, -0.05);
  vec3 fogTarget = fogColorAt(vWorldPos.xz + rayDir.xz * toMist, uTime, uFogColor);

  gl_FragColor = vec4(mix(base, fogTarget, fog), 1.0);
}
