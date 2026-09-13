/**
 * Image URLs. Originals live in R2; /img/* resizes on demand and the result is
 * edge-cached, so this is as fast as a static asset after first hit.
 */
export interface ImgOptions {
  width: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'scale-down';
}

export function imgUrl(key: string, { width, quality = 82, fit = 'cover' }: ImgOptions): string {
  const params = new URLSearchParams({ w: String(width), q: String(quality), fit });
  return `/img/${key}?${params}`;
}

/** Widths chosen for the shop grid and product gallery at 1x/2x on common viewports. */
export const GRID_WIDTHS = [320, 480, 640, 960] as const;
export const HERO_WIDTHS = [640, 960, 1280, 1920] as const;

export function srcSet(key: string, widths: readonly number[]): string {
  return widths.map((w) => `${imgUrl(key, { width: w })} ${w}w`).join(', ');
}
