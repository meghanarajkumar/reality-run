/**
 * Deterministic endless-runner engine.
 * Pure TypeScript: no rendering, no camera, no randomness beyond the seed.
 * The runner stands at z = 0. Obstacles spawn ahead (negative z) and move toward +z.
 */

export interface ObstacleSpec {
  key: string;     // unique per vocabulary object
  type: string;    // object category, e.g. "chair"
  label: string;
  w: number;       // width across the lane
  h: number;       // height
  d: number;       // depth along the lane
}

export interface Obstacle { active: boolean; spec: number; z: number; serial: number; }

const jumpHeight = 1.75;   // apex of the feet above the ground
const jumpTime = 0.66;     // seconds from take-off to landing, always the same
const gravity = (8 * jumpHeight) / (jumpTime * jumpTime);

export const PHYS = {
  jumpHeight, jumpTime, gravity,
  jumpVelocity: (gravity * jumpTime) / 2,
  step: 1 / 120,           // fixed simulation step
  startSpeed: 8.5, maxSpeed: 19, accel: 0.14,   // units/s, units/s, units/s^2
  spawnZ: -34, despawnZ: 5,
  runnerDepth: 0.5,        // hitbox of the runner along the lane
  forgiveness: 0.1,        // feet may clip this far into the top of an obstacle
  jumpBuffer: 0.12,        // a tap this soon before landing still counts
  reaction: 0.3,           // breathing room added to every gap
  firstSpawnAt: 6,
  scorePerUnit: 5,
  maxHeight: 1.0, maxDepth: 1.3,
} as const;

/** Seconds per jump during which the feet are above height h. */
export function airWindow(h: number): number {
  const c = PHYS.jumpHeight - h;
  return c <= 0 ? 0 : 2 * Math.sqrt((2 * c) / PHYS.gravity);
}

/** True when an obstacle of this size can be cleared with timing slack at every speed. */
export function isJumpable(h: number, d: number): boolean {
  if (h > PHYS.maxHeight || d > PHYS.maxDepth) return false;
  const needed = (d + PHYS.runnerDepth) / PHYS.startSpeed;   // slowest speed needs the longest air time
  return airWindow(h - PHYS.forgiveness) - needed >= 0.12;
}

/** Small seeded generator (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Engine {
  readonly obstacles: Obstacle[] = Array.from({ length: 8 }, () => ({ active: false, spec: 0, z: 0, serial: 0 }));
  status: 'running' | 'crashed' = 'running';
  time = 0;
  distance = 0;
  speed: number = PHYS.startSpeed;
  y = 0;
  vy = 0;
  grounded = true;
  landedAt = -1;
  crashedAt = -1;
  hitSpec = -1;
  /** Unsimulated remainder in seconds, for render interpolation. */
  leftover = 0;

  private acc = 0;
  private buffer = 0;
  private nextSpawn = 0;
  private lastSpec = -1;
  private serial = 0;
  private rng: () => number = Math.random;

  constructor(readonly specs: ObstacleSpec[], seed: number) {
    if (!specs.length) throw new Error('The engine needs at least one obstacle spec');
    this.reset(seed);
  }

  reset(seed: number): void {
    this.rng = makeRng(seed);
    for (const o of this.obstacles) o.active = false;
    this.status = 'running';
    this.time = 0; this.distance = 0; this.speed = PHYS.startSpeed;
    this.y = 0; this.vy = 0; this.grounded = true; this.landedAt = -1; this.crashedAt = -1; this.hitSpec = -1;
    this.acc = 0; this.leftover = 0; this.buffer = 0; this.lastSpec = -1;
    this.nextSpawn = PHYS.firstSpawnAt;
  }

  get score(): number { return Math.floor(this.distance * PHYS.scorePerUnit); }

  /** The one control. Returns true if the runner left the ground on this call. */
  jump(): boolean {
    if (this.status !== 'running') return false;
    if (this.grounded) { this.takeOff(); return true; }
    this.buffer = PHYS.jumpBuffer;   // remembered briefly; never a double jump
    return false;
  }

  /** Advance by real elapsed seconds using fixed steps, so physics do not depend on frame rate. */
  update(elapsed: number): void {
    this.acc += Math.min(Math.max(elapsed, 0), 0.1);
    while (this.acc >= PHYS.step) { this.step(); this.acc -= PHYS.step; }
    this.leftover = this.acc;
  }

  step(): void {
    if (this.status !== 'running') return;
    const dt = PHYS.step;
    this.time += dt;
    this.speed = Math.min(PHYS.maxSpeed, PHYS.startSpeed + PHYS.accel * this.time);
    const move = this.speed * dt;
    this.distance += move;

    if (this.buffer > 0) this.buffer -= dt;
    if (!this.grounded) {
      this.y += this.vy * dt - 0.5 * PHYS.gravity * dt * dt;   // exact for constant gravity
      this.vy -= PHYS.gravity * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.grounded = true; this.landedAt = this.time;
        if (this.buffer > 0) this.takeOff();
      }
    }

    for (const o of this.obstacles) {
      if (!o.active) continue;
      o.z += move;
      const s = this.specs[o.spec];
      const half = (s.d + PHYS.runnerDepth) / 2;
      if (o.z > -half && o.z < half && this.y < s.h - PHYS.forgiveness) {
        this.status = 'crashed'; this.crashedAt = this.time; this.hitSpec = o.spec;
        return;
      }
      if (o.z > PHYS.despawnZ) o.active = false;
    }

    if (this.distance >= this.nextSpawn) this.spawn();
  }

  private takeOff(): void { this.vy = PHYS.jumpVelocity; this.grounded = false; this.buffer = 0; }

  private spawn(): void {
    const slot = this.obstacles.find(o => !o.active);
    if (!slot) { this.nextSpawn = this.distance + 2; return; }
    let i = Math.floor(this.rng() * this.specs.length);
    if (this.specs.length > 1 && i === this.lastSpec) i = (i + 1 + Math.floor(this.rng() * (this.specs.length - 1))) % this.specs.length;
    this.lastSpec = i;
    slot.active = true; slot.spec = i; slot.z = PHYS.spawnZ; slot.serial = ++this.serial;

    // Gap to the next obstacle: always enough to land, react and jump again, even as speed rises.
    const difficulty = (this.speed - PHYS.startSpeed) / (PHYS.maxSpeed - PHYS.startSpeed);
    const minGap = this.speed * 1.08 * (PHYS.jumpTime + PHYS.reaction) + this.specs[i].d + PHYS.maxDepth;
    const spread = 1.5 - 0.95 * difficulty;      // obstacles arrive more often later on
    this.nextSpawn = this.distance + minGap * (1 + this.rng() * spread);
  }
}
