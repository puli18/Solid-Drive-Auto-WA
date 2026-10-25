/**
 * Demo data store: the shared fixtures (`buildDemoDataset`) plus, in the browser, a localStorage
 * overlay holding the viewer's edits. Server code (SSR) only ever sees the pristine fixtures.
 */
import { buildDemoDataset, type DemoDataset, type DemoDoc } from '@sda/shared/demo';

export const DEMO_STORAGE_KEY = 'sda-demo-overlay-v1';

export type DemoCollection = Exclude<keyof DemoDataset, 'settings'>;

interface Overlay {
  /** collection → id → doc (null = removed; never used, soft delete only) */
  docs: Partial<Record<DemoCollection, Record<string, DemoDoc | null>>>;
  settings: Partial<DemoDataset['settings']>;
}

let base: DemoDataset | null = null;
let overlay: Overlay | null = null;
const listeners = new Set<() => void>();

export function demoBase(): DemoDataset {
  base ??= buildDemoDataset();
  return base;
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

const clone = <T>(v: T): T => structuredClone(v);

/** All docs of a collection (fixtures + overlay), cloned. */
export function demoList(col: DemoCollection): DemoDoc[] {
  const ov = loadOverlay().docs[col] ?? {};
  const rows = new Map(demoBase()[col].map((d) => [d.id, d]));
  for (const [id, d] of Object.entries(ov)) {
    if (d) rows.set(id, d);
    else rows.delete(id);
  }
  return [...rows.values()].map(clone);
}

export function demoGet(col: DemoCollection, id: string): DemoDoc | null {
  const ov = loadOverlay().docs[col];
  if (ov && id in ov) return ov[id] ? clone(ov[id]!) : null;
  const d = demoBase()[col].find((x) => x.id === id);
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

/** Discard every change made in this browser and return to the fixtures. */
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
