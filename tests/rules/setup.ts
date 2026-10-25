import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setLogLevel } from 'firebase/firestore';

// Expected PERMISSION_DENIED errors are noisy; silence the client SDK logger.
setLogLevel('silent');

export const PROJECT_ID = 'demo-solid-drive';
export const ROOT = resolve(__dirname, '../..');

function hostPort(envVar: string, fallback: string) {
  const [host, port] = (process.env[envVar] ?? fallback).split(':');
  return { host: host!, port: Number(port) };
}

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8'),
      ...hostPort('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8188'),
    },
    storage: {
      rules: readFileSync(resolve(ROOT, 'storage.rules'), 'utf8'),
      ...hostPort('FIREBASE_STORAGE_EMULATOR_HOST', '127.0.0.1:9209'),
    },
  });
}

export interface Actors {
  anon: RulesTestContext;
  /** Signed in but no role claim (e.g. a deactivated user). */
  noRole: RulesTestContext;
  staff: RulesTestContext;
  admin: RulesTestContext;
}

export const STAFF_UID = 'staff-uid';
export const ADMIN_UID = 'admin-uid';

export function actors(env: RulesTestEnvironment): Actors {
  return {
    anon: env.unauthenticatedContext(),
    noRole: env.authenticatedContext('norole-uid', {}),
    staff: env.authenticatedContext(STAFF_UID, { role: 'staff' }),
    admin: env.authenticatedContext(ADMIN_UID, { role: 'admin' }),
  };
}
