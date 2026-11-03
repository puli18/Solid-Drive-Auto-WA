/**
 * Demo data store: the shared fixtures (`buildDemoDataset`: users + settings, no cars), the live cars
 * read from Firestore (`setDemoLiveCars`, filled by ./live-cars.ts when DEMO_LIVE_CARS) and, in the
 * browser, a localStorage overlay holding the viewer's edits. Nothing here ever writes to Firestore.
 */
import { buildDemoDataset, type DemoDataset, type DemoDoc } from '@sda/shared/demo';

/** v3: cars moved out of the bundle into Firestore, so older overlays (bundled car copies) are discarded. */
export const DEMO_STORAGE_KEY = 'sda-demo-overlay-v3';

export type DemoCollection = Exclude<keyof DemoDataset, 'settings'>;

interface Overlay {
  /** collection → id → doc (null = removed; never used, soft delete only) */
  docs: Partial<Record<DemoCollection, Record<string, DemoDoc | null>>>;
  settings: Partial<DemoDataset['settings']>;
}

const clone = <T>(v: T): T => structuredClone(v);

let base: DemoDataset | null = null;
/** Published cars read from the live project (read-only base layer under the overlay). */
let liveCars: DemoDoc[] = [];
let overlay: Overlay | null = null;
const listeners = new Set<() => void>();

export function demoBase(): DemoDataset {
  base ??= buildDemoDataset();
  return base;
}

/** Replace the live-cars base layer (called by ./live-cars.ts after reading Firestore). */
export function setDemoLiveCars(rows: DemoDoc[]) {
  liveCars = rows.map(clone);
}

/** Base docs of a collection: bundled fixtures, plus the live cars for `cars`. */
function baseRows(col: DemoCollection): DemoDoc[] {
  return col === 'cars' ? [...liveCars, ...demoBase().cars] : demoBase()[col];
}

const isBrowser = () => typeof window !== 'undefined';

function replacer(this: Record<string, unknown>, key: string, value: unknown) {
  const raw = this[key];
  return raw instanceof Date ? { $date: raw.toISOString() } : value;
}
function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object' && '$date' in value && Object.keys(value).length === 1) {
    return new Date((value as { $date: string }).$date);
  }
  return value;
}

function loadOverlay(): Overlay {
  if (overlay) return overlay;
  overlay = { docs: {}, settings: {} };
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) overlay = JSON.parse(raw, reviver) as Overlay;
    } catch {
      /* storage unavailable – edits live in memory only */
    }
  }
  return overlay;
}

function persist() {
  if (!isBrowser() || !overlay) return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(overlay, replacer));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** All docs of a collection (fixtures + live cars + overlay), cloned. */
export function demoList(col: DemoCollection): DemoDoc[] {
  const ov = loadOverlay().docs[col] ?? {};
  const rows = new Map(baseRows(col).map((d) => [d.id, d]));
  for (const [id, d] of Object.entries(ov)) {
    if (d) rows.set(id, d);
    else rows.delete(id);
  }
  return [...rows.values()].map(clone);
}

export function demoGet(col: DemoCollection, id: string): DemoDoc | null {
  const ov = loadOverlay().docs[col];
  if (ov && id in ov) return ov[id] ? clone(ov[id]!) : null;
  const d = baseRows(col).find((x) => x.id === id);
  return d ? clone(d) : null;
}

export function demoPut(col: DemoCollection, doc: DemoDoc) {
  const ov = loadOverlay();
  (ov.docs[col] ??= {})[doc.id] = clone(doc);
  persist();
}

export function demoGetSettings(id: keyof DemoDataset['settings']): Record<string, unknown> {
  return clone(loadOverlay().settings[id] ?? demoBase().settings[id]);
}

export function demoPutSettings(id: keyof DemoDataset['settings'], data: Record<string, unknown>) {
  loadOverlay().settings[id] = clone(data);
  persist();
}

export function demoNewId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Discard every change made in this browser and return to the fixtures (and the live cars). */
export function resetDemoData() {
  overlay = { docs: {}, settings: {} };
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

/** True when the viewer has local edits. */
export function hasDemoChanges(): boolean {
  const ov = loadOverlay();
  return Object.keys(ov.settings).length > 0 || Object.values(ov.docs).some((m) => m && Object.keys(m).length > 0);
}

/** Subscribe to demo data changes (writes and resets). Returns an unsubscribe function. */
export function onDemoDataChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
