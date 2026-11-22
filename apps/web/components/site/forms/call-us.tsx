/**
 * Shown instead of a form on the public domain while the site runs the demo build (FORMS_OFFLINE): the
 * forms can't deliver anything until Cloud Functions are live, so customers get the phone number instead.
 */
import { MessageSquare, Phone } from 'lucide-react';
import { DEFAULT_BUSINESS_SETTINGS } from '@sda/shared';
import { cn } from '@/lib/utils';
import { hoursRows, smsHref, telHref } from '../lib/format';

const TOPIC = {
  enquiry: { title: 'Call or text us', body: 'Ask about any car, finance or a trade-in. We’ll answer straight away during opening hours.' },
  tradeIn: { title: 'Get a trade-in price', body: 'Call or text us the make, model, year and kilometres of your car, and we’ll give you a price.' },
  booking: { title: 'Book a test drive', body: 'Call or text us and we’ll line up a time that suits you, usually the same day.' },
  reserve: { title: 'Hold this car', body: 'Call us to talk about a holding deposit and we’ll take the car off sale for you.' },
} as const;

export function CallUs({
  topic = 'enquiry',
  carTitle,
  tone = 'light',
  className,
}: {
  topic?: keyof typeof TOPIC;
  carTitle?: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const b = DEFAULT_BUSINESS_SETTINGS;
  const t = TOPIC[topic];
  const sms = smsHref(b.phone, carTitle ? `Hi, I’m interested in the ${carTitle}.` : undefined);
  const dark = tone === 'dark';
  return (
    <div className={cn('rounded-2xl p-6 sm:p-8', dark ? 'bg-white/[0.06] text-white' : 'bg-brand-stone', className)}>
      <h3 className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
        {t.title}
      </h3>
      <p className={cn('mt-2 text-sm', dark ? 'text-white/70' : 'text-muted-foreground')}>
        {carTitle ? `${carTitle}. ` : ''}
        {t.body}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={telHref(b.phone)}
          className="sda-press bg-brand-red hover:bg-brand-red-hover flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-white"
        >
          <Phone className="size-5" aria-hidden />
          <span className="sda-num">{b.phone}</span>
        </a>
        <a
          href={sms}
          className="sda-press flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold ring-1 ring-current/25 hover:ring-current/60"
        >
          <MessageSquare className="size-5" aria-hidden />
          Send a text
        </a>
      </div>
      <ul className={cn('mt-5 space-y-0.5 text-sm', dark ? 'text-white/70' : 'text-muted-foreground')}>
        {hoursRows(b.hours).map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
