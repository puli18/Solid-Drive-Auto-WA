/**
 * Firestore client getter. Import only from the data layer (lib/data/*), which loads it lazily.
 */
import { EMULATOR_HOST, EMULATOR_PORTS } from '@sda/shared/constants';
import { connectFirestoreEmulator, type Firestore, getFirestore } from 'firebase/firestore';
import { publicEnv } from './env';
import { connected, getFirebaseApp } from './firebase';

export function getDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  if (publicEnv.useEmulators && !connected.db) {
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
    connected.db = true;
  }
  return db;
}
