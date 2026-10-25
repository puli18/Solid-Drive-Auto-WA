/**
 * Data-source switch. VITE_DEMO_MODE=true → bundled demo fixtures (client preview deploy,
 * no Firebase needed). Never enable in production (vite.config.ts refuses to build that combination).
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
export type DataMode = 'firebase' | 'demo';
export const DATA_MODE: DataMode = DEMO_MODE ? 'demo' : 'firebase';
