import { logger } from 'firebase-functions/v2';
import { renderEmail, UserInviteEmail } from '../../emails';
import { sendEmail } from '../core/email';
import { emailContext } from './context';

/** Returns true when the email was actually sent (false when logged or failed). */
export async function sendInviteEmail(to: string, name: string, roleLabel: string, link: string, invitedBy?: string): Promise<boolean> {
  try {
    const ctx = await emailContext();
    const r = await renderEmail(UserInviteEmail({ siteUrl: ctx.siteUrl, business: ctx.business, name, roleLabel, link, invitedBy }));
    const res = await sendEmail({ to, subject: `You're invited to the ${ctx.business.name} dashboard`, ...r, tag: 'user-invite' });
    return !res.logged;
  } catch (err) {
    logger.error('Invite email failed', err);
    return false;
  }
}
