import { logger } from 'firebase-functions/v2';
import type { Customer, TradeInVehicle } from '@sda/shared';
import { EnquiryNewEmail, EnquiryReceivedEmail, renderEmail } from '../../emails';
import { notifyEmail } from '../core/config';
import { sendEmail } from '../core/email';
import { emailContext } from './context';

export interface EnquiryForEmail {
  id: string;
  type: 'general' | 'trade-in';
  carTitle: string | null;
  customer: Customer;
  message: string;
  tradeInVehicle: TradeInVehicle | null;
}

export async function sendEnquiryEmails(e: EnquiryForEmail): Promise<void> {
  const ctx = await emailContext();
  const props = {
    siteUrl: ctx.siteUrl,
    business: ctx.business,
    customerName: e.customer.name,
    type: e.type,
    carTitle: e.carTitle,
    message: e.message,
    tradeIn: e.tradeInVehicle ? { ...e.tradeInVehicle, photoCount: e.tradeInVehicle.images.length } : null,
  };
  const label = e.type === 'trade-in' ? 'trade-in request' : 'enquiry';
  await Promise.all([
    (async () => {
      const r = await renderEmail(EnquiryReceivedEmail(props));
      await sendEmail({ to: e.customer.email, subject: `We've received your ${label}`, ...r, replyTo: ctx.business.email, tag: 'enquiry-received' });
    })().catch((err) => logger.error('enquiry-received email failed', err)),
    (async () => {
      const r = await renderEmail(
        EnquiryNewEmail({ ...props, customerEmail: e.customer.email, customerPhone: e.customer.phone, adminUrl: `${ctx.siteUrl}/admin/enquiries` }),
      );
      await sendEmail({
        to: notifyEmail(),
        subject: `New ${label} from ${e.customer.name}${e.carTitle ? ` – ${e.carTitle}` : ''}`,
        ...r,
        replyTo: e.customer.email,
        tag: 'enquiry-new',
      });
    })().catch((err) => logger.error('enquiry-new email failed', err)),
  ]);
}
