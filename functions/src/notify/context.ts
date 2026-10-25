/** Shared email context: business block, site URL, date labels. */
import { formatInTz } from '@sda/shared';
import type { EmailBusiness } from '../../emails';
import { getBusinessSettings, type BusinessInfo } from '../core/settings';
import { siteUrl } from '../core/config';

export interface EmailContext {
  siteUrl: string;
  business: EmailBusiness;
  raw: BusinessInfo;
  tz: string;
}

export function oneLineAddress(a: BusinessInfo['address'] | undefined): string {
  if (!a) return '';
  return [a.line1, a.line2, [a.suburb, a.state, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export async function emailContext(): Promise<EmailContext> {
  const b = await getBusinessSettings();
  return {
    siteUrl: siteUrl(),
    raw: b,
    tz: b.timezone,
    business: {
      name: b.name,
      phone: b.phone,
      email: b.email,
      address: oneLineAddress(b.address),
      dealerLicenceNo: b.dealerLicenceNo,
      abn: b.abn,
    },
  };
}

/** "Tue 27 Oct 2026, 9:00 am" in the dealership zone. */
export const whenLabel = (d: Date, tz: string) => formatInTz(d, 'EEE d MMM yyyy, h:mm a', tz);
