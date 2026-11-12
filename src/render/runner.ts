/** Pip: the runner. Original character, built from primitives, animated procedurally. */
import * as THREE from 'three';

const CORAL = '#FF8F7A', CORAL_DARK = '#F2755F', CREAM = '#FFF4E4', PLUM = '#5B4B7A', MINT = '#8FDDB8', LILAC = '#C9B8F5', INK = '#3B2A4A', PINK = '#FFB7B0', YELLOW = '#FFD76A';

export interface RunnerPose {
  phase: number;        // run-cycle phase, grows with distance
  y: number; vy: number; grounded: boolean;
  sinceLanding: number; // seconds since the last landing
  crashedFor: number;   // seconds since the crash, or -1
  time: number;
}

export function createRunner(): { root: THREE.Group; update(p: RunnerPose): void } {
  const mats = new Map<string, THREE.MeshLambertMaterial>();
  const mat = (c: string) => mats.get(c) ?? (mats.set(c, new THREE.MeshLambertMaterial({ color: c })), mats.get(c)!);
  const ball = (parent: THREE.Object3D, r: number, c: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(c));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  };
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, c: string, x: number, y: number, z: number, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z); m.rotation.z = rz; parent.add(m); return m;
  };

  const root = new THREE.Group();     // position in the lane
  const spin = new THREE.Group();     // facing and tumble
  const body = new THREE.Group();     // squash and stretch, pivot at the feet
  root.add(spin); spin.add(body);

  ball(body, 0.34, CORAL, 0, 0.52, 0, 1, 1.12, 0.95);
  ball(body, 0.26, CREAM, 0, 0.47, 0.2, 1, 1.05, 0.5);                      // belly
  ball(body, 0.1, CREAM, 0, 0.36, -0.33);                                    // tail
  const ears = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * 0.2, 0.84, 0); body.add(g);
    ball(g, 0.11, CORAL, 0, 0.06, 0); ball(g, 0.06, PINK, 0, 0.06, 0.07, 1, 1, 0.5);
    return g;
  });
  const sprout = new THREE.Group(); sprout.position.set(0, 0.9, 0); body.add(sprout);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 6), mat('#6FBF95')); stem.position.y = 0.08; sprout.add(stem);
  ball(sprout, 0.09, MINT, -0.08, 0.18, 0, 1.2, 0.35, 0.8).rotation.z = 0.5;
  ball(sprout, 0.09, MINT, 0.08, 0.18, 0, 1.2, 0.35, 0.8).rotation.z = -0.5;

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.05, 8, 24), mat(LILAC));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.72; body.add(scarf);
  const tails = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * 0.06, 0.7, -0.28); body.add(g);
    box(g, 0.09, 0.04, 0.26, LILAC, 0, 0, -0.13);
    return g;
  });

  // face (seen when Pip turns round after a crash)
  const eyes = [-1, 1].map(s => { const e = ball(body, 0.045, INK, s * 0.12, 0.62, 0.3); ball(e, 0.016, CREAM, 0.012, 0.016, 0.034); return e; });
  const dizzy = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * 0.12, 0.62, 0.32); body.add(g); g.visible = false;
    box(g, 0.11, 0.025, 0.02, INK, 0, 0, 0, 0.785); box(g, 0.11, 0.025, 0.02, INK, 0, 0, 0, -0.785);
    return g;
  });
  for (const s of [-1, 1]) ball(body, 0.05, PINK, s * 0.2, 0.52, 0.27, 1, 0.7, 0.4);
  ball(body, 0.03, CORAL_DARK, 0, 0.55, 0.325, 1.4, 0.7, 0.6);

  const legs = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * 0.14, 0.24, 0); spin.add(g);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), mat(PLUM)); leg.position.y = -0.1; g.add(leg);
    ball(g, 0.1, PLUM, 0, -0.19, 0.04, 1, 0.6, 1.4);
    return g;
  });
  const arms = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * 0.32, 0.56, 0); body.add(g);
    ball(g, 0.08, CORAL_DARK, s * 0.03, -0.08, 0);
    return g;
  });

  const stars = new THREE.Group(); stars.position.y = 1.15; stars.visible = false; root.add(stars);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), mat(YELLOW));
    s.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.36, 0, Math.sin((i * Math.PI * 2) / 3) * 0.36);
    stars.add(s);
  }

  spin.rotation.y = Math.PI;   // runs away from the camera

  function update(p: RunnerPose): void {
    const crashed = p.crashedFor >= 0;
    eyes.forEach(e => (e.visible = !crashed)); dizzy.forEach(d => (d.visible = crashed)); stars.visible = crashed && p.crashedFor > 0.45;

    if (crashed) {
      // knocked back in a tumble, lands facing the camera, wobbles
      const t = p.crashedFor, hop = Math.max(0, p.y + 3.2 * t - 9 * t * t), k = Math.min(1, t / 0.5);
      root.position.set(0, hop, 1.1 * (1 - Math.exp(-5 * t)));
      spin.rotation.set(-Math.PI * 2 * (1 - (1 - k) * (1 - k)), Math.PI * (1 - k), 0);
      const wobble = t > 0.5 ? Math.sin((t - 0.5) * 9) * 0.12 * Math.exp(-(t - 0.5) * 1.6) : 0;
      body.rotation.set(0, 0, wobble); body.scale.set(1, 1, 1); body.position.y = 0;
      legs.forEach((l, i) => l.rotation.set(-1.2, 0, (i ? 1 : -1) * 0.5));
      arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 0.9));
      sprout.rotation.x = Math.sin(t * 7) * 0.3 * Math.exp(-t);
      stars.rotation.y = t * 4;
      return;
    }

    root.position.set(0, p.y, 0);
    spin.rotation.set(0, Math.PI, 0);
    const swing = Math.sin(p.phase);
    if (p.grounded) {
      const squash = Math.max(0, 1 - p.sinceLanding / 0.14) * 0.16;   // brief squash on landing
      body.position.y = Math.abs(swing) * 0.06;
      body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      body.rotation.set(0.1, 0, swing * 0.05);                         // lean into the run
      legs[0].rotation.set(swing * 0.95, 0, 0); legs[1].rotation.set(-swing * 0.95, 0, 0);
      arms[0].rotation.x = -swing * 0.8; arms[1].rotation.x = swing * 0.8;
      sprout.rotation.x = -0.25 + Math.cos(p.phase * 2) * 0.12;
      ears.forEach((e, i) => (e.rotation.z = (i ? -1 : 1) * Math.abs(swing) * 0.1));
      tails.forEach((t, i) => (t.rotation.x = 0.25 + Math.sin(p.phase * 2 + i) * 0.2));
    } else {
      const stretch = THREE.MathUtils.clamp(p.vy * 0.012, -0.1, 0.14);
      body.position.y = 0;
      body.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
      body.rotation.set(0.1 - p.vy * 0.012, 0, 0);
      legs[0].rotation.set(0.9, 0, 0); legs[1].rotation.set(-0.5, 0, 0);
      arms.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? -1 : 1) * 0.9; });
      sprout.rotation.x = -p.vy * 0.05;
      ears.forEach((e, i) => (e.rotation.z = (i ? -1 : 1) * -p.vy * 0.02));
      tails.forEach(t => (t.rotation.x = -p.vy * 0.06));
    }
    arms.forEach((a, i) => { if (p.grounded) a.rotation.z = (i ? -1 : 1) * 0.15; });
  }

  return { root, update };
}
