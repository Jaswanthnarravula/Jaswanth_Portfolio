/**
 * Shader files resolve to their source text (see the raw-loader rules in
 * next.config.ts), so they can be passed straight to ShaderMaterial.
 */
declare module '*.glsl' {
  const source: string;
  export default source;
}
declare module '*.vert' {
  const source: string;
  export default source;
}
declare module '*.frag' {
  const source: string;
  export default source;
}
declare module '*.vs' {
  const source: string;
  export default source;
}
declare module '*.fs' {
  const source: string;
  export default source;
}
