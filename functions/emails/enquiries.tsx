/** Enquiry emails: received (customer) and new enquiry (dealership). */
import { type BaseEmailProps, Cta, Details, Layout, P, Title } from './components';

export interface EnquiryEmailBase extends BaseEmailProps {
  customerName: string;
  type: 'general' | 'trade-in';
  carTitle?: string | null;
  message: string;
  tradeIn?: { rego: string; make: string; model: string; year: number; km: number; condition: string; photoCount: number } | null;
}

export function EnquiryReceivedEmail(p: EnquiryEmailBase) {
  const tradeIn = p.type === 'trade-in';
  return (
    <Layout preview={`Thanks ${p.customerName} – we've got your ${tradeIn ? 'trade-in request' : 'enquiry'}`} siteUrl={p.siteUrl} business={p.business}>
      <Title>Thanks, we&apos;ve got it</Title>
      <P>
        Hi {p.customerName}, thanks for {tradeIn ? 'your trade-in valuation request' : 'getting in touch'}. One of our team will
        contact you shortly{p.business.phone ? ` – or call us any time on ${p.business.phone}` : ''}.
      </P>
      <Details
        rows={[
          ['About', p.carTitle ?? (tradeIn ? 'Trade-in valuation' : 'General enquiry')],
          ...(p.tradeIn
            ? ([
                ['Your vehicle', `${p.tradeIn.year} ${p.tradeIn.make} ${p.tradeIn.model}`],
                ['Kilometres', `${p.tradeIn.km.toLocaleString('en-AU')} km`],
              ] as [string, string][])
            : []),
          ['Your message', p.message],
        ]}
      />
      <P muted>Please don&apos;t reply with sensitive information such as card or licence numbers.</P>
    </Layout>
  );
}

export function EnquiryNewEmail(p: EnquiryEmailBase & { customerEmail: string; customerPhone: string; adminUrl: string }) {
  const tradeIn = p.type === 'trade-in';
  return (
    <Layout preview={`New ${tradeIn ? 'trade-in' : 'enquiry'} from ${p.customerName}`} siteUrl={p.siteUrl} business={p.business}>
      <Title>New {tradeIn ? 'trade-in request' : 'enquiry'}</Title>
      <Details
        rows={[
          ['Customer', p.customerName],
          ['Phone', p.customerPhone],
          ['Email', p.customerEmail],
          ['Car', p.carTitle],
          ...(p.tradeIn
            ? ([
                ['Trade-in', `${p.tradeIn.year} ${p.tradeIn.make} ${p.tradeIn.model}`],
                ['Rego', p.tradeIn.rego],
                ['Kilometres', `${p.tradeIn.km.toLocaleString('en-AU')} km`],
                ['Condition', p.tradeIn.condition],
                ['Photos', String(p.tradeIn.photoCount)],
              ] as [string, string][])
            : []),
          ['Message', p.message],
        ]}
      />
      <Cta href={p.adminUrl}>Open in admin</Cta>
    </Layout>
  );
}
