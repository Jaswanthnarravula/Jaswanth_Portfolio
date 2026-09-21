/**
 * Continuous-corner "squircle" (superellipse, n = 5) used for Apple-style icon masks. Pure; importable from build
 * scripts (erasable syntax only).
 */
export function squirclePath(size: number, exponent = 5, steps = 96): string {
  const half = size / 2;
  const points: string[] = [];
  for (let index = 0; index < steps; index++) {
    const angle = (index / steps) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = half + half * Math.sign(cos) * Math.abs(cos) ** (2 / exponent);
    const y = half + half * Math.sign(sin) * Math.abs(sin) ** (2 / exponent);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/** SVG document of a filled squircle — a mask image (CSS `mask-image`) and the ingest mask. */
export function squircleSvg(size = 100): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path d="${squirclePath(size)}" fill="#000"/></svg>`;
}
