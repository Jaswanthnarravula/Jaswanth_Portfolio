// Hello GlassStage — plans/02-hello-page.md "Shader spec" + "Visual target". Tier 2 only.
// field(uv): the storyboard frame's light field, computed exactly as its CSS draws it — three elliptical radial
// gradients (blue, pink, peach; each its colour at the centre, transparent at 60 % of its radii) over #eaf0ff — so the
// step to Tier 2 changes nothing but the glass.
// Lenses: SDF rounded rectangles (uPanels, updated from a ResizeObserver, never per frame). The glass is the DOM's
// refracting lens (the owner's liquid-glass decision of 2026-09-21, plans/06 Deviations log;
// components/welcome/refraction.ts): inside, the field frosted as the lens CSS does it (saturate(160%)
// brightness(1.04), then its ~12 % white tint); within BAND of the rim every sample moves outward along the edge normal
// by up to BEND, strongest at the rim — `field(uv + n·k)`, three times for R/G/B dispersion — so the field around the
// glass bends into it, plus a fresnel rim. Normals come from a rounder rectangle so corners bend without a mitre.
// uIntensity fades the refraction in over 600 ms; uDim hands over to the intro's #141414.
precision highp float;

uniform vec2 uResolution; // device px
uniform float uPx; // device px per CSS px
uniform float uIntensity;
uniform float uDim;
uniform vec4 uPanels[4]; // x, y (bottom-left, device px), w, h
uniform float uRadii[4]; // device px
uniform int uPanelCount;

in vec2 vUv;
out vec4 fragColor;

const vec3 STAGE = vec3(0.917647, 0.941176, 1.0); // #eaf0ff
const vec3 NETFLIX_BLACK = vec3(0.0784);
// refraction.ts LENS_REFRACTION, in CSS px: band, scale / 2, power.
const float BAND = 120.0;
const float BEND = 130.0;
const float POWER = 2.0;

// `radial-gradient(rx ry at cx cy, col 0, transparent 60%)` composited over `base` (CSS y runs down, uv.y runs up).
vec3 layer(vec3 base, vec2 uv, vec2 at, vec2 radii, vec3 col) {
  vec2 d = (vec2(uv.x, 1.0 - uv.y) - at) / radii;
  float alpha = clamp(1.0 - length(d) / 0.6, 0.0, 1.0);
  return mix(base, col, alpha);
}

vec3 field(vec2 uv) {
  vec3 col = STAGE;
  // CSS paints the last-listed gradient first.
  col = layer(col, uv, vec2(0.60, 0.95), vec2(0.60, 0.70), vec3(1.0, 0.850980, 0.627451)); // #ffd9a0
  col = layer(col, uv, vec2(0.85, 0.25), vec2(0.55, 0.60), vec3(1.0, 0.752941, 0.870588)); // #ffc0de
  col = layer(col, uv, vec2(0.18, 0.20), vec2(0.60, 0.70), vec3(0.615686, 0.725490, 1.0)); // #9db9ff
  return col;
}

// CSS `saturate(160%) brightness(1.04)` (Filter Effects matrices, on sRGB values), then the lens tint (white, ~12 %).
vec3 frost(vec3 c) {
  const float s = 1.6;
  mat3 m = mat3(
    0.213 + 0.787 * s, 0.213 - 0.213 * s, 0.213 - 0.213 * s,
    0.715 - 0.715 * s, 0.715 + 0.285 * s, 0.715 - 0.715 * s,
    0.072 - 0.072 * s, 0.072 - 0.072 * s, 0.072 + 0.928 * s
  );
  return mix(clamp(clamp(m * c, 0.0, 1.0) * 1.04, 0.0, 1.0), vec3(1.0), 0.12);
}

float roundBox(vec2 p, vec4 box, float r) {
  vec2 halfSize = box.zw * 0.5;
  vec2 q = abs(p - (box.xy + halfSize)) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// `minRadius` > 0 rounds every corner at least that much (for normals only).
float lenses(vec2 px, float minRadius) {
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    if (i >= uPanelCount) break;
    float r = min(max(uRadii[i], minRadius), 0.5 * min(uPanels[i].z, uPanels[i].w));
    d = min(d, roundBox(px, uPanels[i], r));
  }
  return d;
}

void main() {
  vec2 px = vUv * uResolution;
  vec3 col = field(vUv);

  if (uPanelCount > 0) {
    float d = lenses(px, 0.0);
    if (d < 1.5) {
      float band = BAND * uPx;
      float normalRadius = band * 1.15;
      vec2 e = vec2(1.0, 0.0);
      vec2 grad = vec2(
        lenses(px + e.xy, normalRadius) - lenses(px - e.xy, normalRadius),
        lenses(px + e.yx, normalRadius) - lenses(px - e.yx, normalRadius)
      );
      vec2 n = normalize(grad + 1e-5);
      float t = clamp(1.0 + d / band, 0.0, 1.0); // 0 at the band's inner edge → 1 at the rim
      vec2 bend = n * pow(t, POWER) * BEND * uPx / uResolution * uIntensity;
      vec3 refracted = vec3(field(vUv + bend).r, field(vUv + bend * 1.04).g, field(vUv + bend * 1.08).b);
      float depth = clamp(-d / (28.0 * uPx), 0.0, 1.0);
      float rim = pow(1.0 - depth, 5.0) * 0.5 * uIntensity;
      float inside = 1.0 - smoothstep(-1.0, 1.0, d);
      col = mix(col, frost(refracted) + rim, inside);
    }
  }

  col = mix(col, NETFLIX_BLACK, uDim);
  fragColor = vec4(col, 1.0);
}
