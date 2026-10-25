import { COLLECTIONS, formatAUD } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import { DepositConflictEmail, DepositPaidEmail, DepositReceivedEmail, renderEmail } from '../../emails';
import { db } from '../core/admin';
import { notifyEmail } from '../core/config';
import { sendEmail } from '../core/email';
import { getDepositSettings } from '../core/settings';
import { emailContext, whenLabel } from './context';

export interface DepositForEmail {
  id: string;
  carTitle: string;
  carSlug?: string | null;
  stockNo: string;
  amountCents: number;
  customer: { name: string; email: string; phone: string };
  paidAt: Date;
  sessionId: string;
  paymentIntentId?: string | null;
  carStatus?: string;
}

const amount = (c: number) => formatAUD(c, { cents: true });

/** Active admin users' emails (+ the dealership notify address) for the conflict email. */
async function adminEmails(): Promise<string[]> {
  const snap = await db.collection(COLLECTIONS.users).where('role', '==', 'admin').get();
  const emails = snap.docs.filter((d) => d.data().active !== false).map((d) => String(d.data().email ?? '')).filter(Boolean);
  return [...new Set([...emails, notifyEmail()])];
}

export async function sendDepositPaidEmails(d: DepositForEmail): Promise<void> {
  const [ctx, settings] = await Promise.all([emailContext(), getDepositSettings()]);
  const base = { siteUrl: ctx.siteUrl, business: ctx.business, customerName: d.customer.name, carTitle: d.carTitle, stockNo: d.stockNo, amountLabel: amount(d.amountCents) };
  const paidAtLabel = whenLabel(d.paidAt, ctx.tz);
  await Promise.all([
    (async () => {
      const r = await renderEmail(
        DepositPaidEmail({
          ...base,
          paidAtLabel,
          reference: d.paymentIntentId ?? d.sessionId,
          termsText: settings.termsText,
          carUrl: d.carSlug ? `${ctx.siteUrl}/cars/${d.carSlug}` : undefined,
        }),
      );
      await sendEmail({ to: d.customer.email, subject: `Deposit received – ${d.carTitle} is reserved (non-refundable)`, ...r, replyTo: ctx.business.email, tag: 'deposit-paid' });
    })().catch((err) => logger.error('deposit-paid email failed', err)),
    (async () => {
      const r = await renderEmail(
        DepositReceivedEmail({ ...base, customerEmail: d.customer.email, customerPhone: d.customer.phone, paidAtLabel, adminUrl: `${ctx.siteUrl}/admin/deposits` }),
      );
      await sendEmail({ to: notifyEmail(), subject: `Deposit paid: ${d.carTitle} (${d.stockNo}) now Reserved`, ...r, replyTo: d.customer.email, tag: 'deposit-received' });
    })().catch((err) => logger.error('deposit-received email failed', err)),
  ]);
}

export async function sendDepositConflictEmail(d: DepositForEmail): Promise<void> {
  try {
    const ctx = await emailContext();
    const r = await renderEmail(
      DepositConflictEmail({
        siteUrl: ctx.siteUrl,
        business: ctx.business,
        customerName: d.customer.name,
        carTitle: d.carTitle,
        stockNo: d.stockNo,
        amountLabel: amount(d.amountCents),
        customerEmail: d.customer.email,
        customerPhone: d.customer.phone,
        depositId: d.id,
        sessionId: d.sessionId,
        paymentIntentId: d.paymentIntentId,
        carStatus: d.carStatus ?? 'unknown',
        adminUrl: `${ctx.siteUrl}/admin/deposits`,
      }),
    );
    await sendEmail({ to: await adminEmails(), subject: `ACTION NEEDED: deposit conflict – ${d.carTitle} (${d.stockNo})`, ...r, tag: 'deposit-conflict' });
  } catch (err) {
    logger.error('deposit-conflict email failed', err);
  }
}
