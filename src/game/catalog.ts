/**
 * Every object category the game can turn into a toy obstacle.
 * `type` is the detector's label with spaces replaced by underscores.
 * dims are [width, height, depth] in game units at "medium" size and match the
 * procedural model in render/models.ts (checked by `npm test`).
 */
export type Shape = 'boxy' | 'tall' | 'wide' | 'round' | 'flat';
export type Room = 'living_room' | 'kitchen' | 'office' | 'bedroom' | 'bathroom' | 'street' | 'outdoors';

export interface CatalogEntry { label: string; shape: Shape; dims: [number, number, number]; rooms: Room[]; }

export const CATALOG: Record<string, CatalogEntry> = {
  chair:         { label: 'chair',         shape: 'tall',  dims: [0.8, 0.9, 0.75],  rooms: ['living_room', 'office', 'kitchen'] },
  couch:         { label: 'sofa',          shape: 'wide',  dims: [2.0, 0.78, 0.9],  rooms: ['living_room'] },
  potted_plant:  { label: 'plant pot',     shape: 'tall',  dims: [0.7, 0.9, 0.7],   rooms: ['living_room', 'office', 'outdoors'] },
  bed:           { label: 'bed',           shape: 'wide',  dims: [1.7, 0.62, 1.2],  rooms: ['bedroom'] },
  dining_table:  { label: 'table',         shape: 'wide',  dims: [1.8, 0.78, 1.0],  rooms: ['kitchen', 'living_room', 'office'] },
  tv:            { label: 'TV',            shape: 'wide',  dims: [1.5, 0.9, 0.36],  rooms: ['living_room', 'bedroom'] },
  laptop:        { label: 'laptop',        shape: 'boxy',  dims: [1.0, 0.64, 0.74], rooms: ['office'] },
  book:          { label: 'books',         shape: 'boxy',  dims: [0.94, 0.47, 0.72], rooms: ['office', 'living_room', 'bedroom'] },
  clock:         { label: 'clock',         shape: 'round', dims: [0.7, 0.78, 0.34], rooms: ['bedroom', 'living_room', 'office'] },
  vase:          { label: 'vase',          shape: 'tall',  dims: [0.5, 0.93, 0.5],  rooms: ['living_room'] },
  bottle:        { label: 'bottle',        shape: 'tall',  dims: [0.4, 0.9, 0.4],   rooms: ['kitchen', 'office'] },
  cup:           { label: 'cup',           shape: 'round', dims: [0.7, 0.55, 0.5],  rooms: ['kitchen', 'office'] },
  wine_glass:    { label: 'glass',         shape: 'tall',  dims: [0.4, 0.8, 0.4],   rooms: ['kitchen'] },
  bowl:          { label: 'bowl',          shape: 'round', dims: [0.92, 0.56, 0.92], rooms: ['kitchen'] },
  bench:         { label: 'bench',         shape: 'wide',  dims: [1.9, 0.82, 0.64], rooms: ['outdoors', 'street'] },
  bicycle:       { label: 'bicycle',       shape: 'wide',  dims: [1.95, 0.9, 0.34], rooms: ['street', 'outdoors'] },
  motorcycle:    { label: 'motorbike',     shape: 'wide',  dims: [2.0, 0.95, 0.5],  rooms: ['street'] },
  car:           { label: 'car',           shape: 'wide',  dims: [2.1, 0.84, 1.1],  rooms: ['street'] },
  bus:           { label: 'bus',           shape: 'wide',  dims: [2.2, 0.97, 1.0],  rooms: ['street'] },
  truck:         { label: 'truck',         shape: 'wide',  dims: [2.2, 0.96, 1.0],  rooms: ['street'] },
  backpack:      { label: 'backpack',      shape: 'boxy',  dims: [0.72, 0.9, 0.48], rooms: ['office', 'bedroom'] },
  suitcase:      { label: 'suitcase',      shape: 'tall',  dims: [0.77, 0.98, 0.42], rooms: ['bedroom'] },
  handbag:       { label: 'bag',           shape: 'boxy',  dims: [0.84, 0.73, 0.4], rooms: ['bedroom', 'living_room'] },
  umbrella:      { label: 'umbrella',      shape: 'round', dims: [1.0, 0.94, 1.0],  rooms: ['outdoors', 'street'] },
  sports_ball:   { label: 'ball',          shape: 'round', dims: [0.62, 0.62, 0.62], rooms: ['outdoors'] },
  apple:         { label: 'apple',         shape: 'round', dims: [0.52, 0.62, 0.52], rooms: ['kitchen'] },
  orange:        { label: 'orange',        shape: 'round', dims: [0.52, 0.56, 0.52], rooms: ['kitchen'] },
  teddy_bear:    { label: 'teddy bear',    shape: 'round', dims: [0.75, 0.9, 0.66], rooms: ['bedroom'] },
  keyboard:      { label: 'keyboard',      shape: 'flat',  dims: [1.4, 0.24, 0.56], rooms: ['office'] },
  cell_phone:    { label: 'phone',         shape: 'tall',  dims: [0.46, 0.84, 0.3], rooms: ['office', 'living_room'] },
  remote:        { label: 'remote',        shape: 'tall',  dims: [0.3, 0.78, 0.3],  rooms: ['living_room'] },
  mouse:         { label: 'mouse',         shape: 'flat',  dims: [0.52, 0.3, 0.72], rooms: ['office'] },
  fire_hydrant:  { label: 'fire hydrant',  shape: 'tall',  dims: [0.6, 0.86, 0.56], rooms: ['street'] },
  skateboard:    { label: 'skateboard',    shape: 'flat',  dims: [1.6, 0.25, 0.5],  rooms: ['street', 'outdoors'] },
  microwave:     { label: 'microwave',     shape: 'boxy',  dims: [1.1, 0.68, 0.74], rooms: ['kitchen'] },
  oven:          { label: 'oven',          shape: 'boxy',  dims: [1.0, 0.94, 0.9],  rooms: ['kitchen'] },
  toaster:       { label: 'toaster',       shape: 'boxy',  dims: [0.86, 0.62, 0.46], rooms: ['kitchen'] },
  refrigerator:  { label: 'fridge',        shape: 'tall',  dims: [0.87, 1.0, 0.8],  rooms: ['kitchen'] },
  toilet:        { label: 'toilet',        shape: 'boxy',  dims: [0.7, 0.84, 0.9],  rooms: ['bathroom'] },
  sink:          { label: 'sink',          shape: 'boxy',  dims: [0.9, 0.94, 0.62], rooms: ['bathroom', 'kitchen'] },
  stop_sign:     { label: 'stop sign',     shape: 'tall',  dims: [0.7, 0.98, 0.3],  rooms: ['street'] },
  traffic_light: { label: 'traffic light', shape: 'tall',  dims: [0.42, 1.0, 0.3],  rooms: ['street'] },
};

/** Detector labels that are never stored at all. */
export const NEVER_STORE = new Set(['person']);
