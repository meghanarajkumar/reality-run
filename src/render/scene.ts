/** Draws the game. Reads the engine's state every frame and never changes it. */
import * as THREE from 'three';
import { PHYS, type Engine } from '../game/engine';
import { CATALOG } from '../game/catalog';
import type { RenderSpec } from '../vision/vocabulary';
import { buildModel } from './models';
import { createRunner } from './runner';

const LANE_WIDTH = 3.3, LANE_NEAR = 4.5, LANE_FAR = 40;

const LANE_VERT = `
  varying vec2 vUv; varying float vZ;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vZ = w.z; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const LANE_FRAG = `
  precision mediump float;
  varying vec2 vUv; varying float vZ;
  uniform float uScroll; uniform vec3 uColor;
  void main() {
    float side = min(vUv.x, 1.0 - vUv.x);
    float soft = smoothstep(0.0, 0.03, side);
    float rail = 1.0 - smoothstep(0.05, 0.065, side);
    float stripe = step(0.5, fract((vZ - uScroll) / 2.6)) * (1.0 - smoothstep(0.012, 0.02, abs(vUv.x - 0.5)));
    float tick = step(0.86, fract((vZ - uScroll) / 2.6)) * (1.0 - smoothstep(0.1, 0.11, side)) * (1.0 - rail);
    float far = smoothstep(${(-LANE_FAR).toFixed(1)}, ${(-LANE_FAR * 0.55).toFixed(1)}, vZ);
    float mark = clamp(rail * 0.75 + stripe + tick * 0.5, 0.0, 1.0);
    vec3 col = mix(uColor, vec3(1.0), mark * 0.85);
    gl_FragColor = vec4(col, (0.42 + 0.4 * mark) * soft * far);
  }
`;

export class GameScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  private lane: THREE.ShaderMaterial;
  private runner = createRunner();
  private runnerShadow: THREE.Mesh;
  private pools: THREE.Object3D[][];
  private prototypes: THREE.Object3D[];
  private slots: { obj: THREE.Object3D | null; spec: number; serial: number; shadow: THREE.Mesh }[] = [];
  private phase = 0;
  private scroll = 0;

  constructor(private canvas: HTMLCanvasElement, private specs: RenderSpec[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);    // the camera feed shows through
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xffdcc0, 1.25));
    const sun = new THREE.DirectionalLight(0xfff2e0, 1.5); sun.position.set(-3, 6, 5); this.scene.add(sun);


    const laneLength = LANE_NEAR + LANE_FAR;
    this.lane = new THREE.ShaderMaterial({
      vertexShader: LANE_VERT, fragmentShader: LANE_FRAG, transparent: true, depthWrite: false,
      uniforms: { uScroll: { value: 0 }, uColor: { value: new THREE.Color('#FFE3C2') } },
    });
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH, laneLength), this.lane);
    lane.rotation.x = -Math.PI / 2; lane.position.z = LANE_NEAR - laneLength / 2; lane.renderOrder = 0;
    this.scene.add(lane);

    const shadowTex = makeShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    const shadow = () => {
      const m = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1; m.visible = false;
      this.scene.add(m); return m;
    };
    this.runnerShadow = shadow();
    this.scene.add(this.runner.root);

    // One prototype per vocabulary object, cloned into a small pool on demand (clones share geometry and materials).
    this.prototypes = specs.map(s => {
      const model = buildModel(s.type, s.colorHex) ?? new THREE.Group();
      model.scale.setScalar(s.h / CATALOG[s.type].dims[1]);
      const holder = new THREE.Group(); holder.add(model); return holder;
    });
    this.pools = specs.map(() => []);
    for (let i = 0; i < 8; i++) this.slots.push({ obj: null, spec: -1, serial: -1, shadow: shadow() });
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    // Framing keeps the runner above the JUMP button and the whole lane on screen in either orientation.
    const wide = w > h;
    this.camera.aspect = w / h;
    this.camera.fov = wide ? 44 : 55;
    this.camera.position.set(0, wide ? 3.0 : 3.9, wide ? 6.6 : 8.4);
    this.camera.lookAt(0, wide ? -1.6 : 0.2, wide ? -6 : -7);
    this.camera.updateProjectionMatrix();
  }

  private acquire(spec: number): THREE.Object3D {
    const obj = this.pools[spec].pop() ?? this.prototypes[spec].clone();
    obj.visible = true;
    if (!obj.parent) this.scene.add(obj);
    return obj;
  }

  sync(engine: Engine, dt: number): void {
    const running = engine.status === 'running';
    const ahead = running ? engine.leftover : 0;   // carry the unsimulated remainder so motion stays smooth
    if (running) { this.phase += dt * engine.speed * 1.55; this.scroll += dt * engine.speed; }
    this.lane.uniforms.uScroll.value = this.scroll % 2.6;

    const y = running && !engine.grounded ? Math.max(0, engine.y + engine.vy * ahead) : engine.y;
    this.runner.update({
      phase: this.phase, y, vy: engine.vy, grounded: engine.grounded,
      sinceLanding: engine.landedAt < 0 ? 9 : engine.time - engine.landedAt,
      crashedFor: running ? -1 : engine.time - engine.crashedAt + this.crashClock, time: engine.time,
    });
    if (!running) this.crashClock += dt; else this.crashClock = 0;

    const rs = this.runnerShadow, lift = Math.min(1, this.runner.root.position.y / PHYS.jumpHeight);
    rs.visible = true; rs.position.set(0, 0.012, this.runner.root.position.z);
    rs.scale.setScalar(0.95 - lift * 0.4); (rs.material as THREE.MeshBasicMaterial).opacity = 0.5 - lift * 0.25;

    engine.obstacles.forEach((o, i) => {
      const slot = this.slots[i];
      if (slot.obj && (!o.active || slot.serial !== o.serial)) {
        slot.obj.visible = false; this.pools[slot.spec].push(slot.obj); slot.obj = null; slot.shadow.visible = false;
      }
      if (!o.active) return;
      if (!slot.obj) { slot.obj = this.acquire(o.spec); slot.spec = o.spec; slot.serial = o.serial; }
      const s = this.specs[o.spec], z = o.z + engine.speed * ahead;
      const pop = easeOutBack(Math.min(1, (z - PHYS.spawnZ) / 6));     // obstacles pop up at the far end of the lane
      slot.obj.position.set(0, 0, z); slot.obj.scale.setScalar(pop);
      slot.shadow.visible = true; slot.shadow.position.set(0, 0.012, z);
      slot.shadow.scale.set((s.w + 0.35) * pop, (s.d + 0.35) * pop, 1);
    });

    this.renderer.render(this.scene, this.camera);
  }
  private crashClock = 0;

  dispose(): void {
    for (const p of this.prototypes) if (!p.parent) this.scene.add(p);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => x.dispose());
    });
    this.renderer.dispose();
  }
}

function easeOutBack(t: number): number { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

function makeShadowTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(59,42,74,0.55)'); grad.addColorStop(0.6, 'rgba(59,42,74,0.3)'); grad.addColorStop(1, 'rgba(59,42,74,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
