import { useEffect, useRef, useState } from 'react';
import { createDetector, type Detector } from '../vision/detector';
import { Tracker } from '../vision/tracker';
import { toSpecs, type Vocabulary } from '../vision/vocabulary';

const SCAN_MS = 8000;        // how long the player pans around
const DETECT_EVERY_MS = 110; // frame sampling: about nine frames a second

type Phase = 'loading' | 'scanning' | 'empty' | 'error';

export function Scan({ video, onDone, onDemo }: { video: HTMLVideoElement; onDone(v: Vocabulary): void; onDemo(): void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [found, setFound] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const overlay = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let alive = true, raf = 0, detector: Detector | null = null;
    const tracker = new Tracker();
    setPhase('loading'); setFound([]);

    const draw = () => {
      const c = overlay.current; if (!c) return;
      const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
      if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return;
      const scale = Math.max(W / vw, H / vh), ox = (W - vw * scale) / 2, oy = (H - vh * scale) / 2;   // the video is shown "cover"
      g.lineCap = 'round'; g.lineJoin = 'round'; g.font = '700 13px Nunito, system-ui, sans-serif'; g.textBaseline = 'middle';
      for (const v of tracker.visible) {
        const x = ox + v.box.x * vw * scale, y = oy + v.box.y * vh * scale, w = v.box.w * vw * scale, h = v.box.h * vh * scale;
        const L = Math.min(26, w / 3, h / 3), r = 10;
        g.strokeStyle = v.confirmed ? 'rgba(255,244,228,.95)' : 'rgba(255,244,228,.5)'; g.lineWidth = 3;
        g.shadowColor = 'rgba(59,42,74,.35)'; g.shadowBlur = 6;
        g.beginPath();   // four soft corner brackets
        g.moveTo(x, y + L); g.arcTo(x, y, x + L, y, r); g.lineTo(x + L, y);
        g.moveTo(x + w - L, y); g.arcTo(x + w, y, x + w, y + L, r); g.lineTo(x + w, y + L);
        g.moveTo(x + w, y + h - L); g.arcTo(x + w, y + h, x + w - L, y + h, r); g.lineTo(x + w - L, y + h);
        g.moveTo(x + L, y + h); g.arcTo(x, y + h, x, y + h - L, r); g.lineTo(x, y + h - L);
        g.stroke();
        if (v.confirmed) {
          const tw = g.measureText(v.label).width + 18;
          g.shadowBlur = 0; g.fillStyle = 'rgba(255,244,228,.92)';
          g.beginPath(); g.roundRect(x + 4, y + 4, tw, 24, 12); g.fill();
          g.fillStyle = '#3B2A4A'; g.fillText(v.label, x + 13, y + 17);
        }
      }
      g.shadowBlur = 0;
    };

    (async () => {
      try { detector = await createDetector(); }
      catch (err) { console.error(err); if (alive) setPhase('error'); return; }
      if (!alive) { detector.close(); return; }
      setPhase('scanning');
      const started = performance.now();
      let last = 0, shown = '';
      const loop = (now: number) => {
        if (!alive || !detector) return;
        const elapsed = now - started;
        if (bar.current) bar.current.style.width = Math.min(100, (elapsed / SCAN_MS) * 100) + '%';
        if (elapsed >= SCAN_MS) {
          const vocab = tracker.build();
          detector.close(); detector = null;       // detection ends here; nothing runs during play
          tracker.visible = []; draw();
          if (toSpecs(vocab).length) done.current(vocab); else setPhase('empty');
          return;
        }
        if (video.readyState >= 2 && now - last >= DETECT_EVERY_MS) {
          last = now;
          try { tracker.observe(detector.detect(video, now), video, now); }
          catch (err) { console.error(err); detector.close(); detector = null; setPhase('error'); return; }
          draw();
          const labels = tracker.confirmedLabels(), key = labels.join('|');
          if (key !== shown) { shown = key; setFound(labels); }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => { alive = false; cancelAnimationFrame(raf); detector?.close(); detector = null; };
  }, [attempt, video]);

  return (
    <section className="scan">
      <canvas ref={overlay} className="overlay" />
      <div className="scan-top">
        <h2>Look around. Let’s build your world.</h2>
        {phase === 'scanning' && <p>Pan slowly across the things near you.</p>}
      </div>

      {(phase === 'loading' || phase === 'scanning') && (
        <div className="scan-bottom">
          <ul className="chips" aria-live="polite">{found.map(l => <li key={l}>{l}</li>)}</ul>
          <div className="progress" role="status">
            <span>{phase === 'loading' ? 'Getting ready…' : 'Discovering your world…'}</span>
            <div className="progress-track"><div ref={bar} className="progress-fill" /></div>
          </div>
        </div>
      )}

      {(phase === 'empty' || phase === 'error') && (
        <div className="card" role="alertdialog">
          <h3>{phase === 'empty' ? 'Nothing to build with yet' : 'Scanning isn’t available'}</h3>
          <p>{phase === 'empty'
            ? 'No objects the game knows were found. Point at furniture or everyday things like chairs, plants, cups, books or bags, and move a little closer.'
            : 'The object detector could not load. Check your connection and scan again, or play the demo world.'}</p>
          <button className="cta" onClick={() => setAttempt(a => a + 1)}>Scan again</button>
          <button className="link" onClick={onDemo}>Play the demo world</button>
        </div>
      )}
    </section>
  );
}
