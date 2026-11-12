import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';
import type { RawDetection } from './tracker';

// Both are fetched at scan time. To self-host, copy node_modules/@mediapipe/tasks-vision/wasm
// and the .tflite file into public/ and point these at the copies.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

export interface Detector { detect(video: HTMLVideoElement, now: number): RawDetection[]; close(): void; }

/** EfficientDet-Lite0 (80 everyday categories), running on the phone. */
export async function createDetector(): Promise<Detector> {
  const files = await FilesetResolver.forVisionTasks(WASM);
  const make = (delegate: 'GPU' | 'CPU') => ObjectDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', scoreThreshold: 0.45, maxResults: 8,
  });
  let detector: ObjectDetector;
  try { detector = await make('GPU'); } catch { detector = await make('CPU'); }
  return {
    detect(video, now) {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return [];
      const out: RawDetection[] = [];
      for (const d of detector.detectForVideo(video, now).detections) {
        const c = d.categories[0], b = d.boundingBox;
        if (!c || !b) continue;
        const x = Math.max(0, b.originX / vw), y = Math.max(0, b.originY / vh);
        out.push({ label: c.categoryName, score: c.score, x, y, w: Math.min(1 - x, b.width / vw), h: Math.min(1 - y, b.height / vh) });
      }
      return out;
    },
    close() { detector.close(); },
  };
}
