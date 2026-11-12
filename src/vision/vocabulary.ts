import { CATALOG, type Room, type Shape } from '../game/catalog';
import { PHYS, isJumpable, type ObstacleSpec } from '../game/engine';

export type RelativeSize = 'small' | 'medium' | 'large';

/** One physical object found during the scan. */
export interface VocabObject {
  id: string;
  type: string;                 // category, e.g. "potted_plant"
  label: string;
  shape: Shape | 'unknown';
  relative_size: RelativeSize;  // from how much of the view it filled
  color: string;                // dominant colour, named
  color_hex: string;
  position: { x: number; y: number; zone: 'left' | 'center' | 'right' };  // where it sat in the view, 0..1
  coverage: number;             // share of the frame its box filled
  aspect: number;               // box width / height
  confidence: number;           // best detector score, 0..1
  sightings: number;            // frames it was seen in
  jumpable: boolean;
  note?: string;
}

export interface Vocabulary {
  environment: Room | 'unknown' | 'demo';   // a guess from the object mix
  source: 'scan' | 'demo';
  detected_objects: VocabObject[];
}

export interface RenderSpec extends ObstacleSpec { colorHex: string; }

const SIZE_FACTOR: Record<RelativeSize, number> = { small: 0.86, medium: 1, large: 1.12 };

export function guessEnvironment(objects: VocabObject[]): Vocabulary['environment'] {
  const votes = new Map<Room, number>();
  for (const o of objects) for (const room of CATALOG[o.type]?.rooms ?? []) votes.set(room, (votes.get(room) ?? 0) + Math.max(o.confidence, 0.1));
  let best: Room | null = null, top = 0;
  for (const [room, v] of votes) if (v > top) { top = v; best = room; }
  return best ?? 'unknown';
}

/**
 * Turn vocabulary objects into obstacle specs. Sizes are normalised so every
 * obstacle can be jumped; the object's category and colour are kept.
 */
export function toSpecs(vocab: Vocabulary, limit = 10): RenderSpec[] {
  const specs: RenderSpec[] = [];
  for (const o of vocab.detected_objects) {
    if (!o.jumpable || specs.length >= limit) continue;
    const entry = CATALOG[o.type];
    if (!entry) continue;
    const [w, h, d] = entry.dims;
    const k = Math.min(SIZE_FACTOR[o.relative_size], PHYS.maxHeight / h, PHYS.maxDepth / d);
    const spec = { key: o.id, type: o.type, label: entry.label, w: w * k, h: h * k, d: d * k, colorHex: o.color_hex };
    if (isJumpable(spec.h, spec.d)) specs.push(spec);
  }
  return specs;
}

/** Used only when the camera or the detector is unavailable. Never presented as a scan. */
export function demoVocabulary(): Vocabulary {
  const make = (type: string, color: string, color_hex: string, relative_size: RelativeSize, x: number): VocabObject => ({
    id: 'demo-' + type, type, label: CATALOG[type].label, shape: CATALOG[type].shape, relative_size, color, color_hex,
    position: { x, y: 0.6, zone: x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'center' },
    coverage: 0, aspect: CATALOG[type].dims[0] / CATALOG[type].dims[1], confidence: 0, sightings: 0, jumpable: true,
    note: 'demo object, not scanned',
  });
  return {
    environment: 'demo', source: 'demo',
    detected_objects: [
      make('chair', 'orange', '#d98a52', 'medium', 0.3), make('potted_plant', 'green', '#5fae6b', 'small', 0.7),
      make('book', 'blue', '#5b8fd6', 'small', 0.5), make('cup', 'yellow', '#e8c14e', 'small', 0.55),
    ],
  };
}

export function hashVocabulary(vocab: Vocabulary): number {
  let h = 2166136261;
  for (const o of vocab.detected_objects) for (const ch of o.type + o.color_hex) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
