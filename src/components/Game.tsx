import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine } from '../game/engine';
import { GameScene } from '../render/scene';
import { hashVocabulary, toSpecs, type Vocabulary } from '../vision/vocabulary';

const BEST_KEY = 'reality-run.best';
const readBest = (): number => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const writeBest = (v: number): void => { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode */ } };

interface Result { score: number; best: number; distance: number; newBest: boolean; hit: string; }

export function Game({ vocab, hasCamera, onRescan }: { vocab: Vocabulary; hasCamera: boolean; onRescan(): void }) {
  const specs = useMemo(() => toSpecs(vocab), [vocab]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scoreEl = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const runs = useRef(0);
  const [best, setBest] = useState(readBest);
  const [result, setResult] = useState<Result | null>(null);
  const [intro, setIntro] = useState(true);
  const labels = useMemo(() => [...new Set(specs.map(s => s.label))], [specs]);

  useEffect(() => {
    const seed = hashVocabulary(vocab);
    const engine = new Engine(specs, seed);
    engineRef.current = engine;
    const scene = new GameScene(canvas.current!, specs);
    let raf = 0, last = performance.now(), reported = false, shown = -1;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (document.hidden) return;
      engine.update(dt);
      scene.sync(engine, dt);
      if (engine.score !== shown && scoreEl.current) { shown = engine.score; scoreEl.current.textContent = String(shown); }
      if (engine.status === 'crashed' && !reported) {
        reported = true;
        navigator.vibrate?.(60);
        const score = engine.score, previous = readBest(), newBest = score > previous;
        if (newBest) { writeBest(score); setBest(score); }
        const hit = specs[engine.hitSpec]?.label ?? '';
        window.setTimeout(() => setResult({ score, best: Math.max(score, previous), distance: Math.round(engine.distance), newBest, hit }), 650);
      }
      if (engine.status === 'running') reported = false;
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => scene.resize();
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) engine.jump(); } };
    window.addEventListener('resize', onResize); window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => setIntro(false), 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); scene.dispose(); engineRef.current = null; };
  }, [specs, vocab]);

  const jump = useCallback((e: React.PointerEvent) => { e.preventDefault(); engineRef.current?.jump(); }, []);
  const runAgain = useCallback(() => {
    // same vocabulary, no new scan; a new seed per run so the order of obstacles changes
    engineRef.current?.reset(hashVocabulary(vocab) + ++runs.current);
    setResult(null);
  }, [vocab]);

  return (
    <section className={'game' + (hasCamera ? '' : ' no-camera')}>
      <canvas ref={canvas} className="stage" />
      <div className="tap-zone" onPointerDown={jump} />

      <div className="hud">
        <div className="pill"><small>Score</small><span ref={scoreEl}>0</span></div>
        <div className="pill"><small>Best</small><span>{best}</span></div>
      </div>
      {vocab.source === 'demo' && <div className="demo-badge">Demo world, not your scan</div>}
      {intro && !result && (
        <div className="intro" role="status">{vocab.source === 'demo' ? 'Demo obstacles' : 'From your world'}: {labels.join(', ')}</div>
      )}

      {!result && <button className="jump" onPointerDown={jump} aria-label="Jump">JUMP</button>}

      {result && (
        <div className="card over" role="alertdialog">
          <h3>Oops! You crashed.</h3>
          {result.hit && <p className="hit">That {result.hit} came out of nowhere.</p>}
          <dl>
            <div><dt>Your score</dt><dd>{result.score}</dd></div>
            <div><dt>Best score</dt><dd>{result.best}{result.newBest && <em>new</em>}</dd></div>
          </dl>
          <p className="distance">{result.distance} m run</p>
          <button className="cta" onClick={runAgain} autoFocus>Run Again</button>
          <button className="link" onClick={onRescan}>Scan a New World</button>
        </div>
      )}
    </section>
  );
}
