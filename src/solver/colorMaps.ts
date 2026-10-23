import { ColormapType } from './types';

export function getColormapRgb(normalized: number, colormap: ColormapType): [number, number, number] {
  const t = Math.max(0, Math.min(1, normalized));

  if (colormap === 'viridis') {
    // Viridis approximation: purple -> teal -> yellow
    const r = Math.round(255 * (0.28 + 0.72 * t * t));
    const g = Math.round(255 * (0.05 + 0.9 * Math.sin(t * Math.PI * 0.95)));
    const b = Math.round(255 * (0.35 + 0.65 * (1 - t) * Math.cos(t * Math.PI * 0.5)));
    return [Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b))];
  }

  if (colormap === 'turbo') {
    // Turbo approximation: blue -> cyan -> green -> yellow -> red
    const r = Math.round(255 * Math.sin(Math.max(0, t - 0.25) * Math.PI * 1.3));
    const g = Math.round(255 * Math.sin(t * Math.PI));
    const b = Math.round(255 * Math.cos(Math.min(0.65, t) * Math.PI * 1.4));
    return [Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b))];
  }

  // Coolwarm: blue -> white -> red
  if (t < 0.5) {
    const factor = t * 2;
    const r = Math.round(59 + (255 - 59) * factor);
    const g = Math.round(130 + (255 - 130) * factor);
    const b = 255;
    return [r, g, b];
  } else {
    const factor = (t - 0.5) * 2;
    const r = 255;
    const g = Math.round(255 - (255 - 60) * factor);
    const b = Math.round(255 - (255 - 60) * factor);
    return [r, g, b];
  }
}
