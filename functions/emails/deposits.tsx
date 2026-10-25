/** Deposit emails: paid (customer, non-refundable receipt), received (dealership), conflict (admin). */
import { type BaseEmailProps, Cta, Details, Layout, Notice, P, Title } from './components';

export interface DepositEmailBase extends BaseEmailProps {
  customerName: string;
  carTitle: string;
  stockNo: string;
  /** Formatted, e.g. "$500.00" */
  amountLabel: string;
}

export function DepositPaidEmail(
  p: DepositEmailBase & { paidAtLabel: string; reference: string; termsText: string; carUrl?: string },
) {
  return (
    <Layout preview={`Deposit received – ${p.carTitle} is reserved for you`} siteUrl={p.siteUrl} business={p.business}>
      <Title>Your car is reserved</Title>
      <P>
        Hi {p.customerName}, thanks for your deposit. The {p.carTitle} is now reserved for you and has been taken off sale. We&apos;ll be
        in touch to arrange the next steps.
      </P>
      <Details
        rows={[
          ['Vehicle', `${p.carTitle} (${p.stockNo})`],
          ['Deposit paid', p.amountLabel],
          ['Paid', p.paidAtLabel],
          ['Reference', p.reference],
          ['Paid to', `${p.business.name}${p.business.abn ? ` (ABN ${p.business.abn})` : ''}`],
        ]}
      />
      <Notice>
        <strong>This deposit is non-refundable.</strong> {p.termsText}
      </Notice>
      <P muted>This email is your payment confirmation, not a tax invoice.</P>
      {p.carUrl ? <Cta href={p.carUrl}>View the car</Cta> : null}
    </Layout>
  );
}

export function DepositReceivedEmail(
  p: DepositEmailBase & { customerEmail: string; customerPhone: string; paidAtLabel: string; adminUrl: string },
) {
  return (
    <Layout preview={`Deposit paid: ${p.carTitle} (${p.stockNo}) is now Reserved`} siteUrl={p.siteUrl} business={p.business}>
      <Title>Deposit received</Title>
      <P>The car has been set to Reserved automatically.</P>
      <Details
        rows={[
          ['Vehicle', `${p.carTitle} (${p.stockNo})`],
          ['Amount', p.amountLabel],
          ['Paid', p.paidAtLabel],
          ['Customer', p.customerName],
          ['Phone', p.customerPhone],
          ['Email', p.customerEmail],
        ]}
      />
      <Cta href={p.adminUrl}>Open deposits</Cta>
    </Layout>
  );
}

export function DepositConflictEmail(
  p: DepositEmailBase & {
    customerEmail: string;
    customerPhone: string;
    depositId: string;
    sessionId: string;
    paymentIntentId?: string | null;
    carStatus: string;
    adminUrl: string;
  },
) {
  return (
    <Layout preview={`Action needed: deposit conflict on ${p.carTitle} (${p.stockNo})`} siteUrl={p.siteUrl} business={p.business}>
      <Title>Deposit conflict – action needed</Title>
      <Notice>
        A customer paid a deposit for a car that was no longer available (status: <strong>{p.carStatus}</strong>). The car was NOT
        reserved for them. Please resolve this manually in the Stripe dashboard, contact the customer, then mark the conflict resolved in
        admin.
      </Notice>
      <Details
        rows={[
          ['Vehicle', `${p.carTitle} (${p.stockNo})`],
          ['Amount', p.amountLabel],
          ['Customer', p.customerName],
          ['Phone', p.customerPhone],
          ['Email', p.customerEmail],
          ['Deposit id', p.depositId],
          ['Checkout session', p.sessionId],
          ['Payment intent', p.paymentIntentId],
        ]}
      />
      <Cta href={p.adminUrl}>Open deposits</Cta>
    </Layout>
  );
}
