/** Booking emails (sent AFTER the transaction commits; failures are logged, never thrown). */
import { BOOKING_TYPE_LABELS, type BookingSource, type BookingType, type Customer } from '@sda/shared';
import { logger } from 'firebase-functions/v2';
import {
  BookingCancelledEmail,
  BookingConfirmedEmail,
  BookingNotificationEmail,
  BookingReminderEmail,
  BookingRescheduledEmail,
  renderEmail,
} from '../../emails';
import { notifyEmail } from '../core/config';
import { sendEmail } from '../core/email';
import { buildIcs } from '../core/ics';
import { emailContext, whenLabel, type EmailContext } from './context';

export interface BookingForEmail {
  id: string;
  carId: string;
  carTitle: string;
  carSlug?: string | null;
  stockNo: string;
  type: BookingType;
  startAt: Date;
  endAt: Date;
  customer: Customer;
  source: BookingSource;
  notes?: string;
}

export const manageUrl = (ctx: EmailContext, bookingId: string, token: string) =>
  `${ctx.siteUrl}/booking/${encodeURIComponent(bookingId)}?t=${encodeURIComponent(token)}`;

function ics(ctx: EmailContext, b: BookingForEmail, opts: { manage?: string; status?: 'CONFIRMED' | 'CANCELLED' } = {}) {
  const label = BOOKING_TYPE_LABELS[b.type];
  return {
    filename: 'booking.ics',
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    content: Buffer.from(
      buildIcs({
        uid: b.id,
        start: b.startAt,
        end: b.endAt,
        title: `${label}: ${b.carTitle} – ${ctx.business.name}`,
        description: `${label} of the ${b.carTitle} (${b.stockNo}) at ${ctx.business.name}.${opts.manage ? `\nChange or cancel: ${opts.manage}` : ''}\nPhone: ${ctx.business.phone}`,
        location: `${ctx.business.name}, ${ctx.business.address}`,
        url: opts.manage,
        organizer: { name: ctx.business.name, email: ctx.business.email },
        status: opts.status,
        sequence: Math.floor(Date.now() / 1000),
      }),
      'utf8',
    ),
  };
}

function base(ctx: EmailContext, b: BookingForEmail) {
  return {
    siteUrl: ctx.siteUrl,
    business: ctx.business,
    customerName: b.customer.name,
    carTitle: b.carTitle,
    stockNo: b.stockNo,
    typeLabel: BOOKING_TYPE_LABELS[b.type],
    whenLabel: whenLabel(b.startAt, ctx.tz),
    carUrl: b.carSlug ? `${ctx.siteUrl}/cars/${b.carSlug}` : undefined,
  };
}

async function safe(tag: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    logger.error(`Email "${tag}" failed`, err);
  }
}

export async function sendBookingCreatedEmails(b: BookingForEmail, token: string): Promise<void> {
  const ctx = await emailContext();
  const manage = manageUrl(ctx, b.id, token);
  const p = base(ctx, b);
  await Promise.all([
    safe('booking-confirmed', async () => {
      const r = await renderEmail(BookingConfirmedEmail({ ...p, manageUrl: manage, licenceRequired: b.type === 'test-drive' }));
      await sendEmail({
        to: b.customer.email,
        subject: `Booking confirmed: ${p.typeLabel} – ${p.whenLabel}`,
        ...r,
        replyTo: ctx.business.email,
        attachments: [ics(ctx, b, { manage })],
        tag: 'booking-confirmed',
      });
    }),
    safe('booking-notification', async () => {
      const r = await renderEmail(
        BookingNotificationEmail({
          ...p,
          customerEmail: b.customer.email,
          customerPhone: b.customer.phone,
          source: b.source,
          notes: b.notes,
          adminUrl: `${ctx.siteUrl}/admin/bookings`,
        }),
      );
      await sendEmail({
        to: notifyEmail(),
        subject: `New ${p.typeLabel.toLowerCase()}: ${b.carTitle} – ${p.whenLabel}`,
        ...r,
        replyTo: b.customer.email,
        tag: 'booking-notification',
      });
    }),
  ]);
}

export async function sendBookingCancelledEmails(b: BookingForEmail): Promise<void> {
  const ctx = await emailContext();
  const p = base(ctx, b);
  await Promise.all([
    safe('booking-cancelled', async () => {
      const r = await renderEmail(
        BookingCancelledEmail({ ...p, audience: 'customer', rebookUrl: p.carUrl ? `${p.carUrl}/book` : `${ctx.siteUrl}/cars` }),
      );
      await sendEmail({
        to: b.customer.email,
        subject: `Booking cancelled: ${p.typeLabel} – ${p.whenLabel}`,
        ...r,
        attachments: [ics(ctx, b, { status: 'CANCELLED' })],
        tag: 'booking-cancelled',
      });
    }),
    safe('booking-cancelled-dealer', async () => {
      const r = await renderEmail(
        BookingCancelledEmail({ ...p, audience: 'dealership', customerEmail: b.customer.email, customerPhone: b.customer.phone }),
      );
      await sendEmail({ to: notifyEmail(), subject: `Cancelled: ${b.carTitle} – ${p.whenLabel}`, ...r, tag: 'booking-cancelled-dealer' });
    }),
  ]);
}

export async function sendBookingRescheduledEmails(b: BookingForEmail, previousStart: Date, token: string): Promise<void> {
  const ctx = await emailContext();
  const p = base(ctx, b);
  const manage = manageUrl(ctx, b.id, token);
  const previousWhenLabel = whenLabel(previousStart, ctx.tz);
  await Promise.all([
    safe('booking-rescheduled', async () => {
      const r = await renderEmail(BookingRescheduledEmail({ ...p, audience: 'customer', previousWhenLabel, manageUrl: manage }));
      await sendEmail({
        to: b.customer.email,
        subject: `Booking moved: ${p.typeLabel} – ${p.whenLabel}`,
        ...r,
        attachments: [ics(ctx, b, { manage })],
        tag: 'booking-rescheduled',
      });
    }),
    safe('booking-rescheduled-dealer', async () => {
      const r = await renderEmail(BookingRescheduledEmail({ ...p, audience: 'dealership', previousWhenLabel }));
      await sendEmail({ to: notifyEmail(), subject: `Rescheduled: ${b.carTitle} – ${p.whenLabel}`, ...r, tag: 'booking-rescheduled-dealer' });
    }),
  ]);
}

/** Reminder email. The manage link can't be rebuilt (only the hash is stored), so it links to the car page/contact. */
export async function sendBookingReminderEmail(b: BookingForEmail): Promise<boolean> {
  const ctx = await emailContext();
  const p = base(ctx, b);
  try {
    const r = await renderEmail(
      BookingReminderEmail({ ...p, contactUrl: `${ctx.siteUrl}/contact`, licenceRequired: b.type === 'test-drive' }),
    );
    await sendEmail({
      to: b.customer.email,
      subject: `Reminder: ${p.typeLabel} tomorrow – ${p.whenLabel}`,
      ...r,
      replyTo: ctx.business.email,
      attachments: [ics(ctx, b)],
      tag: 'booking-reminder',
    });
    return true;
  } catch (err) {
    logger.error('Booking reminder failed', { bookingId: b.id, err });
    return false;
  }
}
