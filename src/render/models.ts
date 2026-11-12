/**
 * Procedural toy models, one builder per object category.
 * Built in game units with the base on y = 0, centred on x/z, facing +z (the camera).
 * The detected dominant colour is softened to a pastel and used as the main colour.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const WOOD = '#C99B6B', CREAM = '#FFF4E4', INK = '#4A3B5C', METAL = '#C9CED6', GLASS = '#A9DCEB', LEAF = '#7CC48D',
  TERRA = '#E59A72', WHITE = '#FFFDF8', RED = '#F27D72', YELLOW = '#FFD76A', TOAST = '#E8B978';
const HALF = Math.PI / 2;

/** Soften a detected colour into the game's pastel range while keeping its hue. */
export function toyColor(hex: string): { main: string; dark: string; light: string; hue: number; sat: number } {
  const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const s = hsl.s < 0.12 ? hsl.s : THREE.MathUtils.clamp(hsl.s, 0.38, 0.68);
  const l = THREE.MathUtils.clamp(hsl.l, hsl.s < 0.12 ? 0.42 : 0.56, hsl.s < 0.12 ? 0.9 : 0.76);
  const out = (dl: number) => '#' + new THREE.Color().setHSL(hsl.h, s, THREE.MathUtils.clamp(l + dl, 0.2, 0.94)).getHexString();
  return { main: out(0), dark: out(-0.14), light: out(0.12), hue: hsl.h * 360, sat: hsl.s };
}

class Kit {
  group = new THREE.Group();
  private target: THREE.Object3D = this.group;
  private mats = new Map<string, THREE.MeshLambertMaterial>();
  mat(color: string): THREE.MeshLambertMaterial {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshLambertMaterial({ color }); this.mats.set(color, m); }
    return m;
  }
  add(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, this.mat(color));
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    this.target.add(mesh);
    return mesh;
  }
  /** Soft-cornered box centred on (x, y, z). */
  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, r = 0.04, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    return this.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.98), color, x, y, z, rx, ry, rz);
  }
  cyl(rTop: number, rBottom: number, h: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 20): THREE.Mesh {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, x, y, z, rx, ry, rz);
  }
  ball(r: number, color: string, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): THREE.Mesh {
    const m = this.add(new THREE.SphereGeometry(r, 20, 14), color, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  /** Upper (top = true) or lower half of a sphere, flat side on y. */
  dome(r: number, color: string, x: number, y: number, z: number, top = true, sx = 1, sy = 1, sz = 1): THREE.Mesh {
    const m = this.add(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, top ? 0 : HALF, HALF), color, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  /** Ring standing in the x-y plane unless rotated. */
  ring(R: number, r: number, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2): THREE.Mesh {
    return this.add(new THREE.TorusGeometry(R, r, 10, 28, arc), color, x, y, z, rx, ry, rz);
  }
  /** Tube between two points in the x-y plane. */
  tube(ax: number, ay: number, bx: number, by: number, r: number, color: string, z = 0): THREE.Mesh {
    const len = Math.hypot(bx - ax, by - ay);
    return this.cyl(r, r, len, color, (ax + bx) / 2, (ay + by) / 2, z, 0, 0, Math.atan2(by - ay, bx - ax) - HALF, 10);
  }
  /** Build several parts inside a sub-group that can be moved as one. */
  sub(x: number, y: number, z: number, ry: number, build: () => void): void {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry;
    this.group.add(g);
    const previous = this.target;
    this.target = g; build(); this.target = previous;
  }
}

type C = ReturnType<typeof toyColor>;
type Builder = (k: Kit, c: C) => void;

const wheels = (k: Kit, xs: number[], r: number, z: number, y = r) => {
  for (const x of xs) for (const s of [-1, 1]) {
    k.cyl(r, r, 0.14, INK, x, y, s * z, HALF);
    k.cyl(r * 0.45, r * 0.45, 0.15, METAL, x, y, s * z, HALF);
  }
};

const BUILDERS: Record<string, Builder> = {
  chair(k, c) {
    for (const x of [-0.32, 0.32]) for (const z of [-0.29, 0.29]) k.cyl(0.04, 0.035, 0.42, WOOD, x, 0.21, z);
    k.box(0.8, 0.1, 0.75, c.main, 0, 0.46, 0, 0.04);
    k.box(0.8, 0.42, 0.1, c.main, 0, 0.69, -0.325, 0.05);
    k.box(0.62, 0.26, 0.03, c.light, 0, 0.7, -0.27, 0.03);
  },
  couch(k, c) {
    for (const x of [-0.88, 0.88]) for (const z of [-0.36, 0.36]) k.cyl(0.05, 0.04, 0.06, WOOD, x, 0.03, z);
    k.box(2.0, 0.28, 0.9, c.dark, 0, 0.2, 0, 0.08);
    for (const x of [-0.44, 0.44]) k.box(0.84, 0.16, 0.62, c.light, x, 0.42, 0.08, 0.07);
    k.box(1.76, 0.46, 0.24, c.main, 0, 0.55, -0.33, 0.1);
    for (const x of [-0.9, 0.9]) k.box(0.2, 0.44, 0.9, c.main, x, 0.46, 0, 0.09);
  },
  potted_plant(k, c) {
    const green = c.hue > 70 && c.hue < 170 && c.sat > 0.15;
    const leaf = green ? c.main : LEAF, leafDark = green ? c.dark : '#5FAE78', pot = green ? TERRA : c.main;
    k.cyl(0.26, 0.19, 0.34, pot, 0, 0.17, 0);
    k.cyl(0.29, 0.29, 0.06, pot, 0, 0.34, 0);
    k.ball(0.26, leaf, 0, 0.62, 0);
    k.ball(0.17, leafDark, -0.17, 0.5, 0.06);
    k.ball(0.17, leafDark, 0.18, 0.52, -0.04);
    k.ball(0.12, leaf, 0.02, 0.77, 0.02);
  },
  bed(k, c) {
    for (const x of [-0.78, 0.78]) for (const z of [-0.52, 0.52]) k.cyl(0.05, 0.05, 0.08, WOOD, x, 0.04, z);
    k.box(1.7, 0.22, 1.2, WOOD, 0, 0.17, 0, 0.05);
    k.box(1.62, 0.16, 1.12, CREAM, 0, 0.36, 0, 0.06);
    k.box(1.66, 0.18, 0.7, c.main, 0, 0.38, 0.23, 0.07);
    for (const x of [-0.38, 0.38]) k.box(0.6, 0.1, 0.3, WHITE, x, 0.49, -0.36, 0.05);
    k.box(1.7, 0.62, 0.1, '#B5855A', 0, 0.31, -0.55, 0.06);
  },
  dining_table(k, c) {
    for (const x of [-0.78, 0.78]) for (const z of [-0.4, 0.4]) k.cyl(0.05, 0.04, 0.68, c.dark, x, 0.34, z);
    k.box(1.8, 0.1, 1.0, c.main, 0, 0.73, 0, 0.04);
  },
  tv(k, c) {
    k.box(0.6, 0.05, 0.36, INK, 0, 0.025, 0, 0.02);
    k.box(0.12, 0.14, 0.1, INK, 0, 0.12, 0, 0.02);
    k.box(1.5, 0.72, 0.1, c.sat < 0.12 ? INK : c.dark, 0, 0.54, 0, 0.05);
    k.box(1.38, 0.6, 0.02, GLASS, 0, 0.54, 0.05, 0.01);
    k.box(0.3, 0.04, 0.01, WHITE, -0.38, 0.72, 0.062, 0.01, 0, 0, 0.5);
  },
  laptop(k, c) {
    k.box(1.0, 0.06, 0.66, c.main, 0, 0.03, 0.03, 0.03);
    k.box(0.8, 0.012, 0.3, INK, 0, 0.064, -0.04, 0.005);
    k.box(0.26, 0.012, 0.14, c.light, 0, 0.064, 0.24, 0.005);
    k.box(1.0, 0.6, 0.05, c.main, 0, 0.33, -0.3, 0.025, -0.18);
    k.box(0.88, 0.5, 0.012, GLASS, 0, 0.335, -0.272, 0.005, -0.18);
  },
  book(k, c) {
    const one = (w: number, d: number, y: number, ry: number, color: string) => k.sub(0, y, 0, ry, () => {
      k.box(w, 0.14, d, color, 0, 0, 0, 0.015);
      k.box(w - 0.05, 0.09, d + 0.012, CREAM, 0.035, 0, 0, 0.005);
    });
    one(0.9, 0.66, 0.08, 0, c.main);
    one(0.8, 0.6, 0.23, 0.12, c.light);
    one(0.72, 0.56, 0.38, -0.1, c.dark);
  },
  clock(k, c) {
    for (const x of [-0.2, 0.2]) k.cyl(0.04, 0.04, 0.12, INK, x, 0.06, 0);
    k.cyl(0.33, 0.33, 0.3, c.main, 0, 0.42, 0, HALF, 0, 0, 28);
    k.cyl(0.28, 0.28, 0.31, CREAM, 0, 0.42, 0, HALF, 0, 0, 28);
    k.box(0.03, 0.18, 0.02, INK, 0, 0.5, 0.16, 0.01);
    k.box(0.14, 0.03, 0.02, INK, 0.06, 0.42, 0.16, 0.01);
    for (const x of [-0.2, 0.2]) k.ball(0.09, c.dark, x, 0.68, 0);
  },
  vase(k, c) {
    k.ball(0.24, c.main, 0, 0.26, 0, 1, 1.05, 1);
    k.cyl(0.1, 0.15, 0.22, c.main, 0, 0.56, 0);
    k.cyl(0.14, 0.1, 0.05, c.dark, 0, 0.69, 0);
    [[-0.05, RED], [0.01, YELLOW], [0.07, WHITE]].forEach(([x, col], i) => {
      k.cyl(0.012, 0.012, 0.2, LEAF, x as number, 0.78, 0, 0, 0, 0, 6);
      k.ball(0.06, col as string, x as number, 0.86, i === 1 ? 0.03 : -0.02);
    });
  },
  bottle(k, c) {
    k.cyl(0.18, 0.18, 0.52, c.main, 0, 0.26, 0);
    k.cyl(0.185, 0.185, 0.2, CREAM, 0, 0.28, 0);
    k.cyl(0.07, 0.18, 0.14, c.main, 0, 0.59, 0);
    k.cyl(0.07, 0.07, 0.14, c.main, 0, 0.73, 0);
    k.cyl(0.085, 0.085, 0.08, INK, 0, 0.84, 0);
  },
  cup(k, c) {
    k.cyl(0.24, 0.19, 0.52, c.main, -0.09, 0.26, 0, 0, 0, 0, 24);
    k.cyl(0.21, 0.21, 0.02, '#8A5A3C', -0.09, 0.515, 0, 0, 0, 0, 24);
    k.ring(0.13, 0.04, c.main, 0.17, 0.27, 0);
  },
  wine_glass(k) {
    k.cyl(0.15, 0.16, 0.03, GLASS, 0, 0.015, 0);
    k.cyl(0.025, 0.025, 0.36, GLASS, 0, 0.21, 0, 0, 0, 0, 8);
    k.cyl(0.13, 0.08, 0.19, '#D97B8F', 0, 0.485, 0);
    k.cyl(0.18, 0.13, 0.19, GLASS, 0, 0.675, 0);
  },
  bowl(k, c) {
    k.cyl(0.2, 0.22, 0.05, c.dark, 0, 0.025, 0);
    k.dome(0.45, c.main, 0, 0.45, 0, false, 1, 0.88, 1);
    k.cyl(0.42, 0.42, 0.02, CREAM, 0, 0.44, 0, 0, 0, 0, 24);
    k.ball(0.09, RED, -0.12, 0.46, 0.06); k.ball(0.09, YELLOW, 0.1, 0.46, 0.1); k.ball(0.09, LEAF, 0.02, 0.46, -0.14);
  },
  bench(k, c) {
    for (const x of [-0.8, 0.8]) {
      k.box(0.08, 0.42, 0.5, INK, x, 0.21, 0.03, 0.03);
      k.box(0.08, 0.38, 0.06, INK, x, 0.61, -0.28, 0.02);
    }
    k.box(1.9, 0.08, 0.56, c.main, 0, 0.46, 0.03, 0.03);
    k.box(1.9, 0.12, 0.05, c.main, 0, 0.58, -0.28, 0.02);
    k.box(1.9, 0.12, 0.05, c.light, 0, 0.74, -0.28, 0.02);
  },
  bicycle(k, c) {
    for (const x of [-0.62, 0.62]) { k.ring(0.3, 0.04, INK, x, 0.34, 0); k.cyl(0.04, 0.04, 0.1, METAL, x, 0.34, 0, HALF); }
    k.tube(-0.15, 0.34, -0.25, 0.72, 0.03, c.main);
    k.tube(-0.25, 0.68, 0.42, 0.7, 0.03, c.main);
    k.tube(-0.15, 0.34, 0.42, 0.68, 0.03, c.main);
    k.tube(-0.62, 0.34, -0.15, 0.34, 0.025, c.main);
    k.tube(-0.62, 0.34, -0.25, 0.68, 0.025, c.main);
    k.tube(0.62, 0.34, 0.42, 0.8, 0.03, METAL);
    k.box(0.06, 0.05, 0.3, INK, 0.42, 0.82, 0, 0.02);
    k.box(0.24, 0.06, 0.12, INK, -0.27, 0.76, 0, 0.03);
  },
  motorcycle(k, c) {
    for (const x of [-0.66, 0.66]) { k.ring(0.26, 0.09, INK, x, 0.35, 0); k.cyl(0.1, 0.1, 0.2, METAL, x, 0.35, 0, HALF); }
    k.box(1.0, 0.3, 0.3, c.main, -0.04, 0.5, 0, 0.1);
    k.ball(0.2, c.main, 0.16, 0.68, 0, 1.3, 0.8, 0.8);
    k.box(0.5, 0.1, 0.26, INK, -0.36, 0.7, 0, 0.05);
    k.tube(0.66, 0.35, 0.44, 0.84, 0.035, METAL, 0.1); k.tube(0.66, 0.35, 0.44, 0.84, 0.035, METAL, -0.1);
    k.box(0.06, 0.05, 0.48, INK, 0.42, 0.88, 0, 0.02);
    k.ball(0.09, YELLOW, 0.56, 0.72, 0);
  },
  car(k, c) {
    k.box(2.1, 0.38, 1.0, c.main, 0, 0.34, 0, 0.12);
    k.box(1.15, 0.34, 0.9, c.main, -0.08, 0.65, 0, 0.12);
    k.box(1.0, 0.22, 0.92, GLASS, -0.08, 0.66, 0, 0.06);
    k.box(0.07, 0.26, 0.93, c.main, -0.08, 0.66, 0, 0.02);
    wheels(k, [-0.66, 0.66], 0.2, 0.47);
    k.ball(0.06, YELLOW, 1.0, 0.36, 0.3); k.ball(0.06, YELLOW, 1.0, 0.36, -0.3);
  },
  bus(k, c) {
    k.box(2.2, 0.78, 0.9, c.main, 0, 0.56, 0, 0.1);
    k.box(1.94, 0.26, 0.92, GLASS, 0, 0.7, 0, 0.04);
    for (const x of [-0.5, 0, 0.5]) k.box(0.06, 0.3, 0.93, c.main, x, 0.7, 0, 0.02);
    k.box(2.21, 0.06, 0.91, CREAM, 0, 0.4, 0, 0.02);
    wheels(k, [-0.7, 0.7], 0.17, 0.42);
  },
  truck(k, c) {
    k.box(1.4, 0.74, 0.9, CREAM, -0.38, 0.57, 0, 0.06);
    k.box(0.7, 0.6, 0.9, c.main, 0.72, 0.5, 0, 0.1);
    k.box(0.5, 0.24, 0.92, GLASS, 0.78, 0.62, 0, 0.05);
    wheels(k, [-0.7, 0.1, 0.76], 0.17, 0.42);
  },
  backpack(k, c) {
    k.box(0.7, 0.74, 0.36, c.main, 0, 0.37, -0.03, 0.14);
    k.box(0.5, 0.34, 0.12, c.dark, 0, 0.25, 0.17, 0.06);
    k.box(0.5, 0.025, 0.02, CREAM, 0, 0.52, 0.155, 0.01);
    k.ring(0.09, 0.025, INK, 0, 0.76, -0.03);
  },
  suitcase(k, c) {
    for (const x of [-0.25, 0.25]) k.cyl(0.05, 0.05, 0.08, INK, x, 0.05, 0, HALF);
    k.box(0.75, 0.66, 0.36, c.main, 0, 0.43, 0, 0.08);
    for (const x of [-0.18, 0.18]) k.box(0.04, 0.6, 0.38, c.dark, x, 0.43, 0, 0.02);
    for (const x of [-0.14, 0.14]) k.cyl(0.02, 0.02, 0.2, METAL, x, 0.85, -0.1, 0, 0, 0, 8);
    k.box(0.34, 0.05, 0.05, INK, 0, 0.94, -0.1, 0.02);
  },
  handbag(k, c) {
    k.box(0.8, 0.46, 0.36, c.main, 0, 0.23, 0, 0.1);
    k.box(0.82, 0.16, 0.38, c.dark, 0, 0.4, 0, 0.07);
    k.ball(0.045, YELLOW, 0, 0.33, 0.19);
    k.ring(0.22, 0.03, c.dark, 0, 0.46, 0, 0, 0, 0, Math.PI);
  },
  umbrella(k, c) {
    k.cyl(0.02, 0.02, 0.82, INK, 0, 0.41, 0, 0, 0, 0, 8);
    k.ring(0.05, 0.02, INK, 0.05, 0.075, 0, 0, 0, Math.PI, Math.PI);
    const canopy = k.dome(0.5, c.main, 0, 0.62, 0, true, 1, 0.5, 1);
    canopy.geometry = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, HALF);
    canopy.material = new THREE.MeshLambertMaterial({ color: c.main, flatShading: true });
    k.cyl(0.02, 0.03, 0.06, INK, 0, 0.9, 0, 0, 0, 0, 8);
  },
  sports_ball(k, c) {
    k.ball(0.3, c.main, 0, 0.3, 0);
    k.ring(0.3, 0.014, CREAM, 0, 0.3, 0, 0, 0.5, 0); k.ring(0.3, 0.014, CREAM, 0, 0.3, 0, HALF, 0, 0.4);
  },
  apple(k, c) {
    k.ball(0.25, c.main, 0, 0.24, 0, 1, 0.95, 1);
    k.cyl(0.015, 0.02, 0.12, '#7A5236', 0, 0.52, 0, 0, 0, 0.2, 6);
    k.ball(0.07, LEAF, 0.08, 0.54, 0, 1.3, 0.4, 0.8);
  },
  orange(k, c) {
    k.ball(0.25, c.main, 0, 0.25, 0);
    k.cyl(0.03, 0.03, 0.03, '#6FA86B', 0, 0.5, 0, 0, 0, 0, 6);
  },
  teddy_bear(k, c) {
    k.ball(0.25, c.main, 0, 0.27, 0, 1, 1.05, 0.95);
    k.ball(0.14, c.light, 0, 0.27, 0.14, 1, 1, 0.6);
    k.ball(0.2, c.main, 0, 0.64, 0);
    for (const x of [-0.15, 0.15]) { k.ball(0.07, c.main, x, 0.8, 0); k.ball(0.04, c.light, x, 0.8, 0.045); }
    k.ball(0.08, CREAM, 0, 0.6, 0.16); k.ball(0.028, INK, 0, 0.63, 0.235);
    for (const x of [-0.08, 0.08]) k.ball(0.025, INK, x, 0.69, 0.175);
    for (const x of [-0.27, 0.27]) k.ball(0.09, c.dark, x, 0.36, 0.05);
    for (const x of [-0.16, 0.16]) k.ball(0.11, c.dark, x, 0.1, 0.2);
  },
  keyboard(k, c) {
    k.box(1.4, 0.16, 0.55, c.main, 0, 0.08, 0, 0.05);
    for (const z of [-0.18, -0.06, 0.06, 0.18]) k.box(1.24, 0.06, 0.08, CREAM, 0, 0.18, z, 0.02);
  },
  cell_phone(k) {
    k.box(0.42, 0.8, 0.07, INK, 0, 0.42, -0.02, 0.05, -0.14);
    k.box(0.36, 0.68, 0.012, GLASS, 0, 0.43, 0.02, 0.005, -0.14);
    k.box(0.2, 0.3, 0.2, INK, 0, 0.16, -0.03, 0.04);
  },
  remote(k, c) {
    k.box(0.26, 0.72, 0.08, c.sat < 0.12 ? INK : c.main, 0, 0.38, -0.02, 0.05, -0.14);
    k.ball(0.04, RED, 0, 0.66, -0.0); k.ball(0.035, YELLOW, -0.05, 0.5, 0.025); k.ball(0.035, GLASS, 0.05, 0.5, 0.025);
    k.ball(0.035, CREAM, 0, 0.38, 0.04);
    k.box(0.16, 0.26, 0.2, INK, 0, 0.14, -0.04, 0.04);
  },
  mouse(k, c) {
    k.dome(0.25, c.main, 0, 0, 0, true, 1, 1.1, 1.4);
    k.box(0.012, 0.02, 0.26, INK, 0, 0.24, 0.14, 0.004, 0.55);
    k.cyl(0.03, 0.03, 0.03, METAL, 0, 0.255, 0.1, 0, 0, HALF, 10);
  },
  fire_hydrant(k, c) {
    k.cyl(0.2, 0.22, 0.08, c.dark, 0, 0.04, 0);
    k.cyl(0.16, 0.17, 0.5, c.main, 0, 0.33, 0);
    k.cyl(0.2, 0.2, 0.05, c.dark, 0, 0.58, 0);
    k.dome(0.17, c.main, 0, 0.6, 0);
    k.cyl(0.05, 0.05, 0.08, c.dark, 0, 0.8, 0, 0, 0, 0, 8);
    for (const x of [-0.22, 0.22]) k.cyl(0.07, 0.07, 0.14, c.dark, x, 0.4, 0, 0, 0, HALF, 10);
    k.cyl(0.08, 0.08, 0.14, c.dark, 0, 0.4, 0.2, HALF, 0, 0, 10);
  },
  skateboard(k, c) {
    k.box(1.6, 0.06, 0.46, c.main, 0, 0.2, 0, 0.03);
    k.box(1.0, 0.065, 0.1, c.light, 0, 0.2, 0, 0.02);
    for (const x of [-0.52, 0.52]) {
      k.box(0.1, 0.06, 0.36, METAL, x, 0.14, 0, 0.02);
      for (const z of [-0.2, 0.2]) k.cyl(0.08, 0.08, 0.08, CREAM, x, 0.08, z, HALF, 0, 0, 14);
    }
  },
  microwave(k, c) {
    for (const x of [-0.45, 0.45]) k.cyl(0.04, 0.04, 0.05, INK, x, 0.025, 0.25);
    k.box(1.1, 0.6, 0.7, c.main, 0, 0.36, 0, 0.05);
    k.box(0.66, 0.4, 0.02, INK, -0.14, 0.36, 0.35, 0.02);
    k.box(0.2, 0.44, 0.02, CREAM, 0.38, 0.36, 0.35, 0.02);
    k.ball(0.04, RED, 0.38, 0.46, 0.36); k.ball(0.04, INK, 0.38, 0.3, 0.36);
  },
  oven(k, c) {
    k.box(1.0, 0.9, 0.8, c.sat < 0.12 ? WHITE : c.main, 0, 0.45, 0, 0.04);
    k.box(0.7, 0.36, 0.02, INK, 0, 0.36, 0.4, 0.03);
    k.box(0.7, 0.04, 0.05, METAL, 0, 0.62, 0.43, 0.02);
    for (const x of [-0.3, -0.1, 0.1, 0.3]) k.ball(0.04, INK, x, 0.78, 0.4);
    for (const x of [-0.24, 0.24]) for (const z of [-0.18, 0.18]) k.cyl(0.12, 0.12, 0.02, INK, x, 0.91, z);
  },
  toaster(k, c) {
    k.box(0.8, 0.44, 0.45, c.main, 0, 0.22, 0, 0.1);
    for (const z of [-0.08, 0.08]) k.box(0.5, 0.2, 0.06, TOAST, 0, 0.5, z, 0.03);
    k.box(0.05, 0.1, 0.06, INK, 0.42, 0.3, 0, 0.02);
  },
  refrigerator(k, c) {
    k.box(0.85, 0.98, 0.7, c.sat < 0.12 ? WHITE : c.main, 0, 0.49, 0, 0.05);
    k.box(0.86, 0.015, 0.72, c.dark, 0, 0.64, 0, 0.005);
    k.box(0.04, 0.2, 0.05, METAL, -0.3, 0.78, 0.37, 0.02); k.box(0.04, 0.2, 0.05, METAL, -0.3, 0.46, 0.37, 0.02);
  },
  toilet(k, c) {
    const col = c.sat < 0.12 ? WHITE : c.main;
    k.box(0.6, 0.4, 0.24, col, 0, 0.62, -0.3, 0.06);
    k.ball(0.035, METAL, 0, 0.83, -0.3);
    const bowl = k.cyl(0.26, 0.18, 0.36, col, 0, 0.2, 0.08, 0, 0, 0, 24); bowl.scale.z = 1.25;
    const seat = k.ring(0.22, 0.05, CREAM, 0, 0.4, 0.08, HALF); seat.scale.y = 1.25;
  },
  sink(k, c) {
    const col = c.sat < 0.12 ? WHITE : c.main;
    k.cyl(0.12, 0.16, 0.6, col, 0, 0.3, 0);
    k.dome(0.4, col, 0, 0.8, 0, false, 1.1, 0.5, 0.72);
    k.cyl(0.36, 0.36, 0.02, GLASS, 0, 0.79, 0, 0, 0, 0, 24).scale.set(1.1, 1, 0.72);
    k.cyl(0.03, 0.03, 0.12, METAL, 0, 0.86, -0.2, 0, 0, 0, 8);
    k.cyl(0.025, 0.025, 0.14, METAL, 0, 0.9, -0.14, HALF, 0, 0, 8);
  },
  stop_sign(k, c) {
    k.cyl(0.12, 0.14, 0.05, INK, 0, 0.025, 0);
    k.cyl(0.03, 0.03, 0.6, METAL, 0, 0.3, 0, 0, 0, 0, 8);
    k.cyl(0.33, 0.33, 0.05, c.sat < 0.12 ? RED : c.main, 0, 0.63, 0, HALF, Math.PI / 8, 0, 8);
    k.box(0.36, 0.08, 0.06, WHITE, 0, 0.63, 0, 0.02);
  },
  traffic_light(k) {
    k.cyl(0.12, 0.14, 0.05, INK, 0, 0.025, 0);
    k.cyl(0.035, 0.035, 0.42, METAL, 0, 0.24, 0, 0, 0, 0, 8);
    k.box(0.3, 0.56, 0.22, INK, 0, 0.72, 0, 0.05);
    k.ball(0.07, RED, 0, 0.9, 0.08); k.ball(0.07, YELLOW, 0, 0.72, 0.08); k.ball(0.07, '#8FDFA5', 0, 0.54, 0.08);
  },
};

export const MODEL_TYPES = Object.keys(BUILDERS);

/** Build the toy for one category at "medium" size. Returns null for categories without a model. */
export function buildModel(type: string, colorHex: string): THREE.Group | null {
  const build = BUILDERS[type];
  if (!build) return null;
  const kit = new Kit();
  build(kit, toyColor(colorHex));
  return kit.group;
}
