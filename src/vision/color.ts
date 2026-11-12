export interface RGB { r: number; g: number; b: number; }

export function toHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

export function toHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}

/** A plain-language colour name for the vocabulary. */
export function colorName(rgb: RGB): string {
  const { h, s, l } = toHsl(rgb);
  if (l < 0.14) return 'black';
  if (s < 0.12) return l > 0.82 ? 'white' : l < 0.3 ? 'charcoal' : 'gray';
  if (l > 0.9) return 'white';
  if (h < 45 && h >= 12 && l < 0.42) return 'brown';
  if (h >= 25 && h < 60 && s < 0.4 && l > 0.6) return 'beige';
  if (h < 12 || h >= 345) return l > 0.72 ? 'pink' : 'red';
  if (h < 40) return 'orange';
  if (h < 68) return 'yellow';
  if (h < 160) return 'green';
  if (h < 195) return 'teal';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

/**
 * Collects pixels into coarse colour bins and reports the fullest bin,
 * which is steadier than a plain average when the box includes background.
 */
export class ColorBins {
  private bins = new Map<number, [number, number, number, number]>();
  add(data: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
        const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
        const bin = this.bins.get(key);
        if (bin) { bin[0]++; bin[1] += r; bin[2] += g; bin[3] += b; } else this.bins.set(key, [1, r, g, b]);
      }
    }
  }
  dominant(): RGB {
    let best: [number, number, number, number] | null = null;
    for (const bin of this.bins.values()) if (!best || bin[0] > best[0]) best = bin;
    return best ? { r: best[1] / best[0], g: best[2] / best[0], b: best[3] / best[0] } : { r: 200, g: 190, b: 180 };
  }
}
