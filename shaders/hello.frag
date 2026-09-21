// Hello GlassStage — plans/02-hello-page.md "Shader spec". Tier 2 only.
// field(uv): 3 drifting Gaussian lights in the storyboard's light palette (blue, pink, peach over #eaf0ff) + one pointer-following light (analytic, no fbm loops).
// Lenses: SDF rounded rectangles (uPanels, updated from a ResizeObserver, never per frame). Inside a lens the field is
// sampled through a refraction offset along the SDF gradient, three times for R/G/B dispersion, with a fresnel rim.
// Film grain; uIntensity fades the stage in over 600 ms; uDim hands over to the intro's #141414.
precision highp float;

uniform vec2 uResolution; // device px
uniform float uTime; // s
uniform vec2 uPointer; // 0..1, y up, smoothed
uniform vec3 uAccent;
uniform float uIntensity;
uniform float uDim;
uniform vec4 uPanels[4]; // x, y (bottom-left, device px), w, h
uniform float uRadii[4]; // device px
uniform int uPanelCount;

in vec2 vUv;
out vec4 fragColor;

const vec3 STAGE = vec3(0.918, 0.941, 1.0); // #eaf0ff
const vec3 NETFLIX_BLACK = vec3(0.0784);

// On a light stage lights tint rather than add: mix toward the light's colour by its Gaussian weight.
vec3 tint(vec3 base, vec2 p, vec2 c, float r, vec3 col, float strength) {
  vec2 d = p - c;
  return mix(base, col, strength * exp(-dot(d, d) / (r * r)));
}

vec3 field(vec2 uv) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime * 0.07;
  vec3 col = STAGE;
  // Same positions and colours as the T1 CSS field, so the step to Tier 2 adds life, not a new look.
  col = tint(col, p, vec2((0.30 + 0.05 * sin(t * 1.3)) * aspect, 0.64 + 0.06 * cos(t)), 0.46, vec3(0.616, 0.725, 1.0), 0.95);
  col = tint(col, p, vec2((0.78 + 0.05 * cos(t * 0.9)) * aspect, 0.62 + 0.05 * sin(t * 1.7)), 0.42, vec3(1.0, 0.753, 0.871), 0.9);
  col = tint(col, p, vec2((0.58 + 0.06 * sin(t * 0.7)) * aspect, 0.12 + 0.06 * cos(t * 1.1)), 0.46, vec3(1.0, 0.851, 0.627), 0.9);
  col = tint(col, p, vec2(uPointer.x * aspect, uPointer.y), 0.30, mix(STAGE, uAccent, 0.45), 0.35);
  return col;
}

float roundBox(vec2 p, vec4 box, float r) {
  vec2 halfSize = box.zw * 0.5;
  vec2 q = abs(p - (box.xy + halfSize)) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float lenses(vec2 px) {
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    if (i >= uPanelCount) break;
    d = min(d, roundBox(px, uPanels[i], uRadii[i]));
  }
  return d;
}

void main() {
  vec2 px = vUv * uResolution;
  vec3 col = field(vUv);

  if (uPanelCount > 0) {
    float d = lenses(px);
    if (d < 1.5) {
      vec2 e = vec2(1.0, 0.0);
      vec2 grad = vec2(lenses(px + e.xy) - lenses(px - e.xy), lenses(px + e.yx) - lenses(px - e.yx));
      vec2 n = normalize(grad + 1e-5);
      float depth = clamp(-d / (28.0 * uResolution.y / 900.0), 0.0, 1.0); // 0 at the rim → 1 inside
      vec2 bend = n * (1.0 - depth) * 0.045;
      vec3 refracted = vec3(field(vUv - bend).r, field(vUv - bend * 1.4).g, field(vUv - bend * 1.8).b);
      refracted = mix(refracted, vec3(1.0), 0.34); // frosted white, as the CSS glass (rgb(255 255 255 / .34))
      float rim = pow(1.0 - depth, 5.0) * 0.5;
      float inside = 1.0 - smoothstep(-1.0, 1.0, d);
      col = mix(col, refracted + rim, inside);
    }
  }

  float grain = fract(sin(dot(px + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += grain * 0.022;
  col = mix(STAGE, col, uIntensity);
  col = mix(col, NETFLIX_BLACK, uDim);
  fragColor = vec4(col, 1.0);
}
