import { HttpsError } from 'firebase-functions/v2/https';
import type { ZodError } from 'zod';

export { HttpsError };

/** Stub marker for handlers not built yet (Functions agent replaces these). */
export function notImplemented(name: string): never {
  throw new HttpsError('unimplemented', `${name} is not implemented yet`);
}

export function invalidArgument(error: ZodError): HttpsError {
  return new HttpsError('invalid-argument', 'Invalid input', {
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
