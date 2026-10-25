/**
 * React Email templates (rendered with @react-email/render). Each `render*` returns { subject, html, text }.
 * Templates: booking confirmed / notification / reminder / cancelled / rescheduled, enquiry received / new,
 * deposit paid / received / conflict, user invite.
 */
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export * from './components';
export * from './bookings';
export * from './enquiries';
export * from './deposits';
export * from './users';

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderEmail(element: ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}
