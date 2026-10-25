import { COLLECTIONS } from '@sda/shared';
import { auth, db, defineCallable, FieldValue, HttpsError, writeAudit } from '../core';

/** setUserRole (admin) – sets the `role` custom claim and mirrors it on users/{uid} (also reactivates a deactivated user). */
export const setUserRole = defineCallable('setUserRole', async (input, ctx) => {
  if (input.uid === ctx.uid && input.role !== 'admin') {
    throw new HttpsError('failed-precondition', "You can't remove your own admin role.");
  }
  const user = await auth.getUser(input.uid).catch(() => null);
  if (!user) throw new HttpsError('not-found', 'User not found');
  const ref = db.collection(COLLECTIONS.users).doc(input.uid);
  const before = (await ref.get()).data();
  // Setting a role on a deactivated user reactivates them.
  const reactivate = before?.active === false || user.disabled;
  if (user.disabled) await auth.updateUser(input.uid, { disabled: false });
  await auth.setCustomUserClaims(input.uid, { ...(user.customClaims ?? {}), role: input.role });
  const now = FieldValue.serverTimestamp();
  await ref.set(
    {
      name: before?.name ?? user.displayName ?? user.email ?? '',
      email: before?.email ?? user.email ?? '',
      role: input.role,
      active: true,
      ...(before ? {} : { createdAt: now, createdBy: ctx.uid, deletedAt: null }),
      updatedAt: now,
      updatedBy: ctx.uid,
    },
    { merge: true },
  );
  await writeAudit({ actorUid: ctx.uid!, action: 'role-change', entity: 'user', entityId: input.uid, before: { role: before?.role ?? null }, after: { role: input.role, ...(reactivate ? { active: true } : {}) } });
  return { ok: true as const };
});
