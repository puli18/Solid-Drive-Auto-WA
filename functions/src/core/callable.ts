/**
 * `defineCallable` – the ONE way to declare a callable function.
 * It applies region/App Check, validates input with the shared zod schema from `callableSchemas`,
 * enforces the access level from `CALLABLE_ACCESS`, and types the handler's input/output.
 *
 *   export const getAvailability = defineCallable('getAvailability', async (input, ctx) => { ... });
 */
import {
  CALLABLE_ACCESS,
  callableSchemas,
  type CallableName,
  type CallableOutput,
  type CallableParsedInput,
  type Role,
} from '@sda/shared';
import { type CallableOptions, type CallableRequest, onCall } from 'firebase-functions/v2/https';
import { hasAccess, roleOf } from './auth';
import { enforceAppCheck, REGION } from './config';
import { HttpsError, invalidArgument } from './errors';

export interface CallContext {
  uid: string | null;
  role: Role | null;
  email: string | null;
  ip: string | undefined;
  request: CallableRequest;
}

export type CallableHandler<N extends CallableName> = (
  input: CallableParsedInput<N>,
  ctx: CallContext,
) => Promise<CallableOutput<N>>;

export function defineCallable<N extends CallableName>(
  name: N,
  handler: CallableHandler<N>,
  options: Omit<CallableOptions, 'region'> = {},
) {
  const access = CALLABLE_ACCESS[name];
  const schema = callableSchemas[name];
  return onCall({ region: REGION, enforceAppCheck, cors: true, ...options }, async (request) => {
    const role = roleOf(request.auth?.token as Record<string, unknown> | undefined);
    if (access !== 'public') {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
      if (!hasAccess(role, access)) throw new HttpsError('permission-denied', 'You do not have access to this action');
    }
    const parsed = schema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    return handler(parsed.data as CallableParsedInput<N>, {
      uid: request.auth?.uid ?? null,
      role,
      email: (request.auth?.token.email as string | undefined) ?? null,
      ip: request.rawRequest?.ip,
      request,
    });
  });
}
