/** Engine, vocabulary and model checks. Run with `npm test`. */
import * as THREE from 'three';
import { Engine, PHYS, airWindow, isJumpable, type ObstacleSpec } from '../src/game/engine';
import { CATALOG } from '../src/game/catalog';
import { MODEL_TYPES, buildModel } from '../src/render/models';
import { demoVocabulary, toSpecs, guessEnvironment } from '../src/vision/vocabulary';
import { colorName } from '../src/vision/color';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

// 1. every catalog entry has a model, the model fits its stated size, and it is jumpable at every size
const size = new THREE.Vector3();
let worstFit = '', catalogOk = true, jumpOk = true;
for (const [type, entry] of Object.entries(CATALOG)) {
  const model = buildModel(type, '#c08040');
  if (!model) { catalogOk = false; worstFit += ` ${type}:no-model`; continue; }
  const box = new THREE.Box3().setFromObject(model, true); box.getSize(size);
  const [w, h, d] = entry.dims;
  if (size.x > w + 0.03 || size.y > h + 0.03 || size.z > d + 0.03 || box.min.y < -0.02 || size.y < h - 0.12) {
    catalogOk = false; worstFit += ` ${type}:[${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)}] vs [${w},${h},${d}]`;
  }
  for (const k of [0.86, 1, 1.12]) {
    const f = Math.min(k, PHYS.maxHeight / h, PHYS.maxDepth / d);
    if (!isJumpable(h * f, d * f)) { jumpOk = false; worstFit += ` ${type}@${k}:not-jumpable`; }
  }
}
check('every category has a model that fits its catalog size', catalogOk && MODEL_TYPES.length === Object.keys(CATALOG).length, worstFit);
check('every category is jumpable at small, medium and large', jumpOk);

// 2. a bot with good timing never crashes; a runner that never jumps always does
const allSpecs: ObstacleSpec[] = Object.entries(CATALOG).map(([type, e]) => ({ key: type, type, label: e.label, w: e.dims[0], h: e.dims[1], d: e.dims[2] }));
const tallest: ObstacleSpec[] = allSpecs.filter(s => s.h >= 0.94 || s.d >= 1.0);
function runBot(specs: ObstacleSpec[], seed: number, seconds: number, lateBy = 0): { crashed: boolean; time: number; cleared: number } {
  const e = new Engine(specs, seed); let cleared = 0; const seen = new Set<number>();
  for (let i = 0; i < seconds / PHYS.step && e.status === 'running'; i++) {
    let next: { z: number } | null = null;
    for (const o of e.obstacles) if (o.active && o.z < 0.2 && (!next || o.z > next.z)) next = o;
    if (next && e.grounded && -next.z <= e.speed * (PHYS.jumpTime / 2 - lateBy)) e.jump();
    for (const o of e.obstacles) if (o.active && o.z > 1 && !seen.has(o.serial)) { seen.add(o.serial); cleared++; }
    e.step();
  }
  return { crashed: e.status === 'crashed', time: e.time, cleared };
}
let botOk = true, cleared = 0;
for (let seed = 1; seed <= 12; seed++) for (const set of [allSpecs, tallest, allSpecs.slice(0, 1), allSpecs.slice(3, 5)]) {
  const r = runBot(set, seed, 240); cleared += r.cleared; if (r.crashed) { botOk = false; console.log('   crashed at', r.time.toFixed(1), 's seed', seed); }
}
check('well-timed bot survives 4 minutes on every course (48 runs)', botOk, `${cleared} obstacles cleared`);
let slackOk = true;
for (const late of [-0.07, 0.07]) for (let seed = 1; seed <= 6; seed++) if (runBot(tallest, seed, 180, late).crashed) slackOk = false;
check('jumping 70 ms early or late still clears the tallest and deepest obstacles', slackOk);
const idle = new Engine(allSpecs, 5); for (let i = 0; i < 20 / PHYS.step; i++) idle.step();
check('never jumping ends in a crash', idle.status === 'crashed', `after ${idle.time.toFixed(1)} s`);

// 3. determinism and frame-rate independence
const trace = (dt: number) => { const e = new Engine(allSpecs, 99); const out: string[] = []; let t = 0;
  while (t < 30 && e.status === 'running') { if (Math.floor((t + dt) / 1.37) > Math.floor(t / 1.37)) e.jump(); e.update(dt); t += dt; }
  out.push(e.status, e.time.toFixed(2), e.hitSpec.toString()); return out.join('|'); };
check('same seed gives the same run', trace(1 / 60) === trace(1 / 60));
const crashTimes = [1 / 30, 1 / 60, 1 / 144].map(dt => Number(trace(dt).split('|')[1]));
check('30, 60 and 144 fps give the same outcome', Math.max(...crashTimes) - Math.min(...crashTimes) < 0.12, crashTimes.join(' / '));

// 4. jump shape
const j = new Engine(allSpecs, 1); j.jump(); let apex = 0, air = 0; while (!j.grounded) { j.step(); apex = Math.max(apex, j.y); air += PHYS.step; }
check('jump height and duration are fixed', Math.abs(apex - PHYS.jumpHeight) < 0.02 && Math.abs(air - PHYS.jumpTime) < 0.02, `${apex.toFixed(2)} units, ${air.toFixed(2)} s`);
const dj = new Engine(allSpecs, 1); dj.jump(); for (let i = 0; i < 20; i++) dj.step(); const vy = dj.vy; dj.jump(); dj.step();
check('no double jump', dj.vy < vy);
check('air window is positive for the tallest obstacle', airWindow(PHYS.maxHeight) > 0.3, airWindow(PHYS.maxHeight).toFixed(2) + ' s');

// 5. speed ramps, gaps stay fair
const g = new Engine(allSpecs, 3); const spawnDist: number[] = []; let lastSerial = 0; let minMargin = Infinity;
for (let i = 0; i < 200 / PHYS.step; i++) {
  const before = g.distance; g.y = 5;  // hover so the run never ends
  g.step();
  for (const o of g.obstacles) if (o.active && o.serial > lastSerial) { lastSerial = o.serial; spawnDist.push(before);
    if (spawnDist.length > 1) minMargin = Math.min(minMargin, (spawnDist[spawnDist.length - 1] - spawnDist[spawnDist.length - 2]) / g.speed - PHYS.jumpTime); }
}
check('speed rises from start to maximum', g.speed === PHYS.maxSpeed);
check('there is always time to land and react between obstacles', minMargin > 0.3, `tightest spare time ${minMargin.toFixed(2)} s`);

// 6. vocabulary
const demo = demoVocabulary();
check('demo vocabulary is labelled as demo', demo.source === 'demo' && demo.detected_objects.every(o => o.note?.includes('not scanned')));
check('vocabulary objects become obstacle specs', toSpecs(demo).length === demo.detected_objects.length && toSpecs(demo).every(s => isJumpable(s.h, s.d)));
check('environment guess', guessEnvironment(demo.detected_objects) !== 'unknown');
check('colour names', colorName({ r: 200, g: 40, b: 40 }) === 'red' && colorName({ r: 110, g: 70, b: 40 }) === 'brown' && colorName({ r: 60, g: 150, b: 70 }) === 'green' && colorName({ r: 240, g: 240, b: 240 }) === 'white');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
if (failed) throw new Error('checks failed');
