import { describe, expect, it } from 'vitest';
import {
  BookingCancelledEmail,
  BookingConfirmedEmail,
  BookingNotificationEmail,
  BookingReminderEmail,
  BookingRescheduledEmail,
  DepositConflictEmail,
  DepositPaidEmail,
  DepositReceivedEmail,
  EnquiryNewEmail,
  EnquiryReceivedEmail,
  renderEmail,
  UserInviteEmail,
} from '../emails';
import { buildIcs } from '../src/core/ics';
import { carAuditAction, purgeUrlsFor } from '../src/cars/onCarWrite';

const base = {
  siteUrl: 'https://example.test',
  business: { name: 'Solid Drive Auto WA', phone: '(08) 9000 0000', email: 'sales@example.test', address: '1 Test St, Osborne Park WA 6017' },
};
const booking = { ...base, customerName: 'Liam', carTitle: '2021 Toyota Hilux SR5', stockNo: 'SDA1001', typeLabel: 'Test drive', whenLabel: 'Tue 27 Oct 2026, 9:00 am' };
const deposit = { ...base, customerName: 'Priya', carTitle: '2021 Toyota RAV4', stockNo: 'SDA1005', amountLabel: '$500.00' };
const who = { customerEmail: 'c@example.com', customerPhone: '0400 000 000' };

describe('email templates', () => {
  it('render every planned email to html + text with SDA branding', async () => {
    const all = [
      BookingConfirmedEmail({ ...booking, manageUrl: 'https://example.test/booking/1?t=x', licenceRequired: true }),
      BookingNotificationEmail({ ...booking, ...who, source: 'web', adminUrl: 'https://example.test/admin/bookings' }),
      BookingReminderEmail({ ...booking, contactUrl: 'https://example.test/contact', licenceRequired: false }),
      BookingCancelledEmail({ ...booking, audience: 'customer', rebookUrl: 'https://example.test/cars' }),
      BookingRescheduledEmail({ ...booking, audience: 'dealership', previousWhenLabel: 'Mon 26 Oct 2026, 9:00 am' }),
      EnquiryReceivedEmail({ ...base, customerName: 'Mia', type: 'general', message: 'Is it available?' }),
      EnquiryNewEmail({ ...base, ...who, customerName: 'Mia', type: 'trade-in', message: 'Trade', adminUrl: 'x', tradeIn: { rego: '1ABC', make: 'Toyota', model: 'Corolla', year: 2016, km: 1000, condition: 'good', photoCount: 2 } }),
      DepositPaidEmail({ ...deposit, paidAtLabel: 'now', reference: 'pi_1', termsText: 'Terms.' }),
      DepositReceivedEmail({ ...deposit, ...who, paidAtLabel: 'now', adminUrl: 'x' }),
      DepositConflictEmail({ ...deposit, ...who, depositId: 'd1', sessionId: 'cs_1', carStatus: 'reserved', adminUrl: 'x' }),
      UserInviteEmail({ ...base, name: 'Sam', roleLabel: 'Staff', link: 'https://example.test/reset' }),
    ];
    for (const el of all) {
      const r = await renderEmail(el);
      expect(r.html).toContain('#D7261E');
      expect(r.html).toContain('/brand/logo-full-transparent.png');
      expect(r.text.length).toBeGreaterThan(50);
    }
    const paid = await renderEmail(all[7]!);
    expect(paid.text.toLowerCase()).toContain('non-refundable');
  });

  it('builds a valid .ics', () => {
    const ics = buildIcs({
      uid: 'b1',
      start: new Date('2026-10-27T01:00:00Z'),
      end: new Date('2026-10-27T01:45:00Z'),
      title: 'Test drive',
      description: 'd',
      location: 'l',
      organizer: { name: 'SDA', email: 'sales@example.test' },
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261027T010000Z');
    expect(ics).toContain('UID:b1@soliddriveautowa');
  });
});

describe('onCarWrite helpers', () => {
  it('classifies audit actions and purge URLs', () => {
    expect(carAuditAction(undefined, { status: 'draft' })).toBe('create');
    expect(carAuditAction({ status: 'available' }, { status: 'reserved' })).toBe('status-change');
    expect(carAuditAction({ published: false }, { published: true })).toBe('publish');
    expect(carAuditAction({ deletedAt: null }, { deletedAt: new Date() })).toBe('delete');
    expect(purgeUrlsFor({ published: false }, { published: false }, 'https://s')).toEqual([]);
    expect(purgeUrlsFor({ published: true, slug: 'a' }, { published: true, slug: 'b' }, 'https://s')).toEqual(
      expect.arrayContaining(['https://s/cars/a', 'https://s/cars/b', 'https://s/cars']),
    );
  });
});
