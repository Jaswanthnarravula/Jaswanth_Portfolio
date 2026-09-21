// One fullscreen triangle (plans/02 "Shader spec"): three vertices cover clip space; no index buffer, no quad seam.
precision highp float;

in vec3 position;
out vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
