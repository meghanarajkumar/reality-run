import { CATALOG, NEVER_STORE } from '../game/catalog';
import { ColorBins, colorName, toHex } from './color';
import { guessEnvironment, type RelativeSize, type VocabObject, type Vocabulary } from './vocabulary';

export interface RawDetection { label: string; score: number; x: number; y: number; w: number; h: number; }  // box in 0..1 of the frame

interface Track {
  id: number; type: string; hits: number; last: number; best: number;
  box: RawDetection; bestBox: RawDetection; areaSum: number; colors: ColorBins;
}

const iou = (a: RawDetection, b: RawDetection): number => {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
};
const centerGap = (a: RawDetection, b: RawDetection): number => Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);

/**
 * Follows detections from frame to frame so one object seen in fifty frames is
 * stored once. The number of objects kept per category never exceeds the most
 * that were visible together in a single frame, which stops an object that left
 * the view and came back from being counted twice.
 */
export class Tracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private mostAtOnce = new Map<string, number>();
  private sample = document.createElement('canvas');
  private ctx = this.sample.getContext('2d', { willReadFrequently: true })!;

  /** Tracks seen in the latest frame, for drawing outlines. */
  visible: { type: string; label: string; box: RawDetection; confirmed: boolean }[] = [];

  observe(detections: RawDetection[], video: HTMLVideoElement, now: number): void {
    const usable = detections.filter(d => !NEVER_STORE.has(d.label));   // people are dropped here and never stored
    const W = 160, H = Math.max(1, Math.round((W * video.videoHeight) / Math.max(1, video.videoWidth)));
    if (this.sample.width !== W || this.sample.height !== H) { this.sample.width = W; this.sample.height = H; }
    this.ctx.drawImage(video, 0, 0, W, H);
    const pixels = usable.length ? this.ctx.getImageData(0, 0, W, H).data : null;

    const counts = new Map<string, number>(), taken = new Set<Track>();
    this.visible = [];
    for (const det of [...usable].sort((a, b) => b.score - a.score)) {
      const type = det.label.replace(/\s+/g, '_');
      counts.set(type, (counts.get(type) ?? 0) + 1);
      let match: Track | null = null, bestScore = 0;
      for (const t of this.tracks) {
        if (t.type !== type || taken.has(t) || now - t.last > 1500) continue;
        const overlap = iou(t.box, det), gap = centerGap(t.box, det);
        const score = overlap > 0.1 ? 1 + overlap : gap < 0.25 ? 1 - gap : 0;
        if (score > bestScore) { bestScore = score; match = t; }
      }
      if (!match) {
        match = { id: this.nextId++, type, hits: 0, last: now, best: 0, box: det, bestBox: det, areaSum: 0, colors: new ColorBins() };
        this.tracks.push(match);
      }
      taken.add(match);
      match.hits++; match.last = now; match.box = det; match.areaSum += det.w * det.h;
      if (det.score > match.best) { match.best = det.score; match.bestBox = det; }
      if (pixels) {   // sample the middle of the box, where the object is most likely to be
        const x0 = Math.floor((det.x + det.w * 0.25) * W), x1 = Math.ceil((det.x + det.w * 0.75) * W);
        const y0 = Math.floor((det.y + det.h * 0.25) * H), y1 = Math.ceil((det.y + det.h * 0.75) * H);
        match.colors.add(pixels, W, Math.max(0, x0), Math.max(0, y0), Math.min(W, x1), Math.min(H, y1));
      }
      this.visible.push({ type, label: CATALOG[type]?.label ?? det.label, box: det, confirmed: match.hits >= 3 });
    }
    for (const [type, n] of counts) this.mostAtOnce.set(type, Math.max(n, this.mostAtOnce.get(type) ?? 0));
  }

  /** Labels of the objects confirmed so far that the game can use. */
  confirmedLabels(): string[] {
    const seen = new Set<string>();
    for (const t of this.tracks) if (t.hits >= 3 && CATALOG[t.type]) seen.add(CATALOG[t.type].label);
    return [...seen];
  }

  build(): Vocabulary {
    const byType = new Map<string, Track[]>();
    for (const t of this.tracks) if (t.hits >= 3) byType.set(t.type, [...(byType.get(t.type) ?? []), t]);

    const objects: VocabObject[] = [];
    for (const [type, tracks] of byType) {
      const keep = tracks.sort((a, b) => b.hits - a.hits).slice(0, Math.max(1, this.mostAtOnce.get(type) ?? 1));
      keep.forEach((t, i) => {
        const entry = CATALOG[type], rgb = t.colors.dominant(), b = t.bestBox;
        const coverage = t.areaSum / t.hits;
        const relative_size: RelativeSize = coverage < 0.04 ? 'small' : coverage < 0.18 ? 'medium' : 'large';
        const x = b.x + b.w / 2, y = b.y + b.h / 2;
        objects.push({
          id: `${type}-${i + 1}`, type, label: entry?.label ?? type.replace(/_/g, ' '), shape: entry?.shape ?? 'unknown',
          relative_size, color: colorName(rgb), color_hex: toHex(rgb),
          position: { x: +x.toFixed(3), y: +y.toFixed(3), zone: x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'center' },
          coverage: +coverage.toFixed(4), aspect: +(b.w / Math.max(1e-3, b.h)).toFixed(2),
          confidence: +t.best.toFixed(3), sightings: t.hits,
          jumpable: !!entry, ...(entry ? {} : { note: 'no toy model for this category yet' }),
        });
      });
    }
    objects.sort((a, b) => b.confidence - a.confidence);
    return { environment: guessEnvironment(objects), source: 'scan', detected_objects: objects };
  }
}
