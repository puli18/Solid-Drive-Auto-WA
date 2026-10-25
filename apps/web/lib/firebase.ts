/**
 * Firebase CLIENT SDK (browser). Use only from client components / hooks:
 *
 *   import { getFirebaseAuth, getFirebaseStorage, getFirebaseFunctions } from '@/lib/firebase';
 *
 * Connects to the local Emulator Suite when VITE_USE_EMULATORS=true (ports from @sda/shared
 * EMULATOR_PORTS, matching firebase.json). App Check is initialised when VITE_APPCHECK_SITE_KEY is set.
 * Firestore lives in `./firebase-db` (getDb) and is only loaded lazily by the data layer: its Node build
 * (protobufjs codegen) cannot run on Cloudflare Workers during SSR.
 * Pages/components should use `@/lib/data` rather than these getters.
 */
import { EMULATOR_HOST, EMULATOR_PORTS } from '@sda/shared/constants';
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, type Functions, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, type FirebaseStorage, getStorage } from 'firebase/storage';
import { publicEnv } from './env';

type Connected = { auth?: boolean; db?: boolean; storage?: boolean; functions?: boolean; appCheck?: boolean };
const g = globalThis as unknown as { __sdaFirebaseConnected?: Connected };
export const connected: Connected = (g.__sdaFirebaseConnected ??= {});

export function getFirebaseApp(): FirebaseApp {
  const app = getApps().length ? getApp() : initializeApp(publicEnv.firebase);
  if (typeof window !== 'undefined' && publicEnv.appCheckSiteKey && !connected.appCheck && !publicEnv.useEmulators) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(publicEnv.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    connected.appCheck = true;
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  if (publicEnv.useEmulators && !connected.auth) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connected.auth = true;
  }
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  const storage = getStorage(getFirebaseApp());
  if (publicEnv.useEmulators && !connected.storage) {
    connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
    connected.storage = true;
  }
  return storage;
}

export function getFirebaseFunctions(): Functions {
  const functions = getFunctions(getFirebaseApp(), publicEnv.functionsRegion);
  if (publicEnv.useEmulators && !connected.functions) {
    connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_PORTS.functions);
    connected.functions = true;
  }
  return functions;
}
