/**
 * Typed callable wrappers. Names, inputs and outputs come from @sda/shared (`callableSchemas`,
 * `CallableOutputs`), so they always match the functions.
 *
 *   import { callFunction, functionErrorMessage } from '@/lib/functions';
 *   const { slots } = await callFunction('getAvailability', { carId, date: '2026-10-27' });
 *
 * Inputs are validated client-side with the same zod schema before the network call
 * (throws `CallableValidationError` with field issues – map them onto react-hook-form errors).
 */
import {
  callableSchemas,
  type CallableInput,
  type CallableName,
  type CallableOutput,
} from '@sda/shared';
import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from './firebase';

export interface FieldIssue {
  path: string;
  message: string;
}

export class CallableValidationError extends Error {
  constructor(public readonly issues: FieldIssue[]) {
    super(issues[0]?.message ?? 'Invalid input');
    this.name = 'CallableValidationError';
  }
}

export async function callFunction<N extends CallableName>(
  name: N,
  input: CallableInput<N>,
  opts: { validate?: boolean; timeoutMs?: number } = {},
): Promise<CallableOutput<N>> {
  if (opts.validate !== false) {
    const parsed = callableSchemas[name].safeParse(input);
    if (!parsed.success) {
      throw new CallableValidationError(
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
  }
  const fn = httpsCallable<CallableInput<N>, CallableOutput<N>>(getFirebaseFunctions(), name, {
    timeout: opts.timeoutMs ?? 60_000,
  });
  const res = await fn(input);
  return res.data;
}

/** Field issues from a CallableValidationError or a server `invalid-argument` error (details.issues). */
export function functionFieldIssues(err: unknown): FieldIssue[] {
  if (err instanceof CallableValidationError) return err.issues;
  if (err instanceof FirebaseError && 'details' in err) {
    const details = (err as FirebaseError & { details?: { issues?: FieldIssue[] } }).details;
    if (Array.isArray(details?.issues)) return details.issues;
  }
  return [];
}

/** A user-facing message for any error thrown by callFunction. */
export function functionErrorMessage(err: unknown): string {
  if (err instanceof CallableValidationError) return err.message;
  if (err instanceof FirebaseError) {
    const code = err.code.replace(/^functions\//, '');
    switch (code) {
      case 'unauthenticated':
        return 'Please sign in again.';
      case 'permission-denied':
        return "You don't have access to do that.";
      case 'invalid-argument':
        return functionFieldIssues(err)[0]?.message ?? 'Please check the form and try again.';
      case 'failed-precondition':
      case 'already-exists':
      case 'not-found':
      case 'resource-exhausted':
        return err.message;
      case 'unimplemented':
        return 'This feature is not available yet.';
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Network problem. Please try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}
