import { COLLECTIONS } from '@sda/shared';
import { auth, db, defineCallable, FieldValue, HttpsError, writeAudit } from '../core';

/**
 * deactivateUser (admin) – removes the role claim, disables the account, revokes refresh tokens
 * (signed-in sessions end at the next token refresh) and sets users/{uid}.active = false.
 */
export const deactivateUser = defineCallable('deactivateUser', async (input, ctx) => {
  if (input.uid === ctx.uid) throw new HttpsError('failed-precondition', "You can't deactivate your own account.");
  const user = await auth.getUser(input.uid).catch(() => null);
  if (!user) throw new HttpsError('not-found', 'User not found');
  const { role: _role, ...otherClaims } = (user.customClaims ?? {}) as Record<string, unknown>;
  await auth.setCustomUserClaims(input.uid, Object.keys(otherClaims).length ? otherClaims : null);
  await auth.updateUser(input.uid, { disabled: true });
  await auth.revokeRefreshTokens(input.uid);
  const ref = db.collection(COLLECTIONS.users).doc(input.uid);
  const before = (await ref.get()).data();
  await ref.set({ active: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid }, { merge: true });
  await writeAudit({
    actorUid: ctx.uid!,
    action: 'deactivate',
    entity: 'user',
    entityId: input.uid,
    before: { active: before?.active ?? true, role: before?.role ?? (user.customClaims?.role as string | undefined) ?? null },
    after: { active: false, role: null },
  });
  return { ok: true as const };
});
