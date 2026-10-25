/** Booking emails: confirmed (customer, with .ics), notification (dealership), reminder, cancelled, rescheduled. */
import { Link } from '@react-email/components';
import { type BaseEmailProps, Cta, Details, Layout, Notice, P, Title } from './components';

export interface BookingEmailBase extends BaseEmailProps {
  customerName: string;
  carTitle: string;
  stockNo?: string;
  /** "Test drive" / "Inspection" */
  typeLabel: string;
  /** e.g. "Tue 27 Oct 2026, 9:00 am" (dealership time) */
  whenLabel: string;
  carUrl?: string;
}

export function BookingConfirmedEmail(p: BookingEmailBase & { manageUrl: string; licenceRequired: boolean }) {
  return (
    <Layout preview={`Your ${p.typeLabel.toLowerCase()} is booked for ${p.whenLabel}`} siteUrl={p.siteUrl} business={p.business}>
      <Title>You&apos;re booked in</Title>
      <P>Hi {p.customerName}, thanks for booking with {p.business.name}. Here are your details:</P>
      <Details
        rows={[
          ['Booking', p.typeLabel],
          ['Car', p.carUrl ? <Link href={p.carUrl}>{p.carTitle}</Link> : p.carTitle],
          ['Stock no', p.stockNo],
          ['When', p.whenLabel],
          ['Where', p.business.address],
        ]}
      />
      {p.licenceRequired ? (
        <Notice tone="grey">Please bring your current driver licence – we need to sight it before the test drive.</Notice>
      ) : null}
      <P>A calendar invite is attached. Need to change or cancel? Use the link below.</P>
      <Cta href={p.manageUrl}>Manage booking</Cta>
      <P muted>Questions? Call us on {p.business.phone}.</P>
    </Layout>
  );
}

export function BookingNotificationEmail(
  p: BookingEmailBase & { customerEmail: string; customerPhone: string; source: 'web' | 'staff'; notes?: string; adminUrl: string },
) {
  return (
    <Layout preview={`New ${p.typeLabel.toLowerCase()}: ${p.carTitle} – ${p.whenLabel}`} siteUrl={p.siteUrl} business={p.business}>
      <Title>New booking</Title>
      <Details
        rows={[
          ['Type', p.typeLabel],
          ['When', p.whenLabel],
          ['Car', `${p.carTitle}${p.stockNo ? ` (${p.stockNo})` : ''}`],
          ['Customer', p.customerName],
          ['Phone', p.customerPhone],
          ['Email', p.customerEmail],
          ['Source', p.source === 'staff' ? 'Staff (phone booking)' : 'Website'],
          ['Notes', p.notes],
        ]}
      />
      <Cta href={p.adminUrl}>Open bookings</Cta>
    </Layout>
  );
}

/** Only the token hash is stored, so the reminder points to the confirmation email's manage link (or contact page). */
export function BookingReminderEmail(p: BookingEmailBase & { contactUrl: string; licenceRequired: boolean }) {
  return (
    <Layout preview={`Reminder: your ${p.typeLabel.toLowerCase()} is tomorrow`} siteUrl={p.siteUrl} business={p.business}>
      <Title>See you tomorrow</Title>
      <P>Hi {p.customerName}, this is a reminder of your booking with {p.business.name}.</P>
      <Details
        rows={[
          ['Booking', p.typeLabel],
          ['Car', p.carTitle],
          ['When', p.whenLabel],
          ['Where', p.business.address],
        ]}
      />
      {p.licenceRequired ? <Notice tone="grey">Don&apos;t forget your driver licence.</Notice> : null}
      <P>
        Can&apos;t make it? Use the Manage booking link in your confirmation email, or call us on {p.business.phone}, so we can offer the
        time to someone else.
      </P>
      <Cta href={p.contactUrl}>Contact us</Cta>
    </Layout>
  );
}

export function BookingCancelledEmail(p: BookingEmailBase & { audience: 'customer' | 'dealership'; rebookUrl?: string; customerEmail?: string; customerPhone?: string }) {
  const dealer = p.audience === 'dealership';
  return (
    <Layout preview={`${dealer ? 'Booking cancelled' : 'Your booking is cancelled'}: ${p.whenLabel}`} siteUrl={p.siteUrl} business={p.business}>
      <Title>{dealer ? 'Booking cancelled' : 'Your booking is cancelled'}</Title>
      {dealer ? (
        <P>{p.customerName} cancelled their booking via the manage link. The slot is open again.</P>
      ) : (
        <P>Hi {p.customerName}, your booking has been cancelled. We hope to see you another time.</P>
      )}
      <Details
        rows={[
          ['Booking', p.typeLabel],
          ['Car', `${p.carTitle}${p.stockNo ? ` (${p.stockNo})` : ''}`],
          ['Was', p.whenLabel],
          ...(dealer ? ([['Phone', p.customerPhone], ['Email', p.customerEmail]] as [string, string | undefined][]) : []),
        ]}
      />
      {!dealer && p.rebookUrl ? <Cta href={p.rebookUrl}>Book another time</Cta> : null}
    </Layout>
  );
}

export function BookingRescheduledEmail(
  p: BookingEmailBase & { audience: 'customer' | 'dealership'; previousWhenLabel: string; manageUrl?: string },
) {
  const dealer = p.audience === 'dealership';
  return (
    <Layout preview={`Booking moved to ${p.whenLabel}`} siteUrl={p.siteUrl} business={p.business}>
      <Title>{dealer ? 'Booking rescheduled' : 'Your booking has moved'}</Title>
      <P>{dealer ? `${p.customerName} moved their booking.` : `Hi ${p.customerName}, your booking has been updated.`}</P>
      <Details
        rows={[
          ['Booking', p.typeLabel],
          ['Car', `${p.carTitle}${p.stockNo ? ` (${p.stockNo})` : ''}`],
          ['New time', p.whenLabel],
          ['Previous time', p.previousWhenLabel],
          ...(dealer ? [] : ([['Where', p.business.address]] as [string, string][])),
        ]}
      />
      {!dealer && p.manageUrl ? (
        <>
          <P>An updated calendar invite is attached.</P>
          <Cta href={p.manageUrl}>Manage booking</Cta>
        </>
      ) : null}
    </Layout>
  );
}
