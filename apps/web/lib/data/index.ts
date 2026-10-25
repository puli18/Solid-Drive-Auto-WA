/**
 * Repository layer – the ONLY data entry point for pages and components (never import firebase/* directly).
 *
 * Client (admin + public forms):
 *   import { getAdminRepo, runAction, DEMO_MODE, resetDemoData, onDemoDataChange } from '@/lib/data';
 * Public site (route loaders):
 *   import { getPublishedCars, getCarBySlug, getPublicSettings } from '@/lib/data/public';
 */
import { demoAdminRepo } from './demo/admin';
import { DEMO_MODE } from './mode';
import type { AdminRepository } from './types';

export { DATA_MODE, DEMO_MODE, type DataMode } from './mode';
export * from './types';
export {
  actionErrorMessage,
  actionFieldIssues,
  CallableValidationError,
  DemoUnsupportedError,
  runAction,
  type FieldIssue,
} from './actions';
export { hasDemoChanges, onDemoDataChange, resetDemoData } from './demo/store';

/** Firebase adapter, loaded lazily on first call (keeps firebase/firestore out of the initial bundle and out of demo mode). */
const lazyFirebaseRepo = new Proxy({} as AdminRepository, {
  get(_t, prop: string | symbol) {
    if (prop === 'mode') return 'firebase';
    if (prop === 'then') return undefined;
    return async (...args: unknown[]) => {
      const { firebaseAdminRepo } = await import('./firebase/admin');
      const fn = firebaseAdminRepo[prop as keyof AdminRepository] as unknown as (...a: unknown[]) => unknown;
      return fn.apply(firebaseAdminRepo, args);
    };
  },
});

/** The admin repository for the current mode (Firebase client SDK, or demo fixtures + localStorage). */
export function getAdminRepo(): AdminRepository {
  return DEMO_MODE ? demoAdminRepo : lazyFirebaseRepo;
}
