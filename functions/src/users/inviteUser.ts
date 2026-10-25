import { COLLECTIONS } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { auth, bindSecrets, db, defineCallable, FieldValue, HttpsError, isEmulator, siteUrl, writeAudit } from '../core';
import { sendInviteEmail } from '../notify/users';

/**
 * inviteUser (admin) – creates the Firebase Auth user (no password), sets the role claim, writes users/{uid},
 * and emails a password-setup link. The link is also returned when the email could not be sent
 * (no RESEND_API_KEY), so the admin can pass it on.
 */
export const inviteUser = defineCallable(
  'inviteUser',
  async (input, ctx) => {
    const existing = await auth.getUserByEmail(input.email).catch(() => null);
    if (existing) throw new HttpsError('already-exists', 'A user with that email already exists.');
    const user = await auth.createUser({ email: input.email, displayName: input.name, emailVerified: false, disabled: false });
    await auth.setCustomUserClaims(user.uid, { role: input.role });
    const now = FieldValue.serverTimestamp();
    await db.collection(COLLECTIONS.users).doc(user.uid).set({
      name: input.name,
      email: input.email,
      role: input.role,
      active: true,
      invitedAt: now,
      lastLoginAt: null,
      createdAt: now,
      createdBy: ctx.uid,
      updatedAt: now,
      updatedBy: ctx.uid,
      deletedAt: null,
    });
    await writeAudit({ actorUid: ctx.uid!, action: 'invite', entity: 'user', entityId: user.uid, after: { email: input.email, role: input.role } });

    let link: string | undefined;
    try {
      link = await auth.generatePasswordResetLink(input.email, { url: `${siteUrl()}/admin/login` });
    } catch (err) {
      logger.error('Could not generate the password setup link', err);
    }
    const inviter = ctx.uid ? (await db.collection(COLLECTIONS.users).doc(ctx.uid).get()).data()?.name : undefined;
    const sent = link ? await sendInviteEmail(input.email, input.name, input.role === 'admin' ? 'Admin' : 'Staff', link, inviter) : false;
    return { uid: user.uid, ...(link && (!sent || isEmulator) ? { resetLink: link } : {}) };
  },
  { secrets: bindSecrets('RESEND_API_KEY') },
);
