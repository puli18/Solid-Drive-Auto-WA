import Link from '@/components/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { formatAUD, type GetDepositStatusOutput } from '@sda/shared';
import { actionErrorMessage, runAction } from '@/lib/data';

const POLL_MS = 2500;
const MAX_POLLS = 12;

/**
 * Stripe return page body. Never trusts the redirect: reads the deposit status from `getDepositStatus`
 * (polling briefly while the webhook lands).
 */
export function DepositStatus({ sessionId, demo, phone }: { sessionId: string; demo: boolean; phone: string }) {
  const [status, setStatus] = useState<GetDepositStatusOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let live = true;
    runAction('getDepositStatus', { sessionId })
      .then((s) => live && setStatus(s))
      .catch((e) => live && setError(actionErrorMessage(e)));
    return () => {
      live = false;
    };
  }, [sessionId, polls]);

  useEffect(() => {
    if (status?.status !== 'pending' || polls >= MAX_POLLS) return;
    const t = setTimeout(() => setPolls((p) => p + 1), POLL_MS);
    return () => clearTimeout(t);
  }, [status, polls]);

  if (!sessionId) {
    return <Panel icon={<AlertTriangle />} title="Missing payment reference" text="We couldn’t find a payment reference in this link." phone={phone} />;
  }
  if (error) {
    return <Panel icon={<AlertTriangle />} title="We couldn’t check your payment" text={error} phone={phone} />;
  }
  if (!status || (status.status === 'pending' && polls < MAX_POLLS)) {
    return (
      <div className="flex items-center gap-3 rounded-2xl p-8 ring-1 ring-black/10" aria-live="polite">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <p>Confirming your payment with the bank…</p>
      </div>
    );
  }

  const amount = status.amountCents ? formatAUD(status.amountCents) : 'Your';
  const carLink = status.carSlug ? (
    <Link href={`/cars/${status.carSlug}`} className="font-semibold underline underline-offset-4">
      {status.carTitle ?? 'your car'}
    </Link>
  ) : (
    (status.carTitle ?? 'your car')
  );

  switch (status.status) {
    case 'paid':
      return (
        <div role="status" className="bg-brand-stone rounded-2xl p-6 sm:p-10">
          {demo ? (
            <span className="bg-brand-red mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white">
              <ShieldAlert className="size-3.5" aria-hidden /> Demo – no payment taken
            </span>
          ) : null}
          <CheckCircle2 className="text-brand-red size-10" aria-hidden />
          <h2 className="font-display mt-5 text-3xl font-extrabold sm:text-4xl" style={{ fontStretch: '110%' }}>
            It’s reserved for you
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg">
            {amount} deposit received for {carLink}. We’ve emailed your receipt. The deposit is non-refundable and comes off the price when you
            complete the purchase. Our team will call you to arrange the next steps.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {status.carSlug ? (
              <Link href={`/cars/${status.carSlug}/book`} className="sda-press bg-brand-black inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white">
                Book a time to see it
              </Link>
            ) : null}
            <Link href="/" className="inline-flex h-12 items-center px-3 text-sm font-semibold underline underline-offset-4">
              Back to home
            </Link>
          </div>
        </div>
      );
    case 'conflict':
      return (
        <Panel
          icon={<AlertTriangle />}
          title="Payment received – we need to check one thing"
          text={`Another buyer reserved this car moments before your payment went through. Your payment is safe and our team will contact you shortly to sort it out.`}
          phone={phone}
        />
      );
    case 'expired':
      return (
        <Panel
          icon={<Clock />}
          title="This checkout has expired"
          text="No payment was taken. You can start a new reservation from the car’s page."
          phone={phone}
          href={status.carSlug ? `/cars/${status.carSlug}/reserve` : '/cars'}
          cta="Try again"
        />
      );
    case 'pending':
      return (
        <Panel
          icon={<Clock />}
          title="Still waiting on confirmation"
          text="Your payment is taking longer than usual to confirm. You’ll get an email as soon as it does – no need to pay again."
          phone={phone}
        />
      );
    default:
      return <Panel icon={<AlertTriangle />} title="We couldn’t find this payment" text="Check the link from Stripe, or get in touch." phone={phone} />;
  }
}

function Panel({ icon, title, text, phone, href, cta }: { icon: React.ReactNode; title: string; text: string; phone: string; href?: string; cta?: string }) {
  return (
    <div role="status" className="bg-brand-stone rounded-2xl p-6 sm:p-10">
      <span className="text-brand-red [&>svg]:size-9" aria-hidden>
        {icon}
      </span>
      <h2 className="font-display mt-4 text-2xl font-extrabold sm:text-3xl" style={{ fontStretch: '108%' }}>
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-lg">{text}</p>
      <p className="text-muted-foreground mt-2">
        Questions? Call <span className="text-foreground sda-num font-medium">{phone}</span>.
      </p>
      {href ? (
        <Link href={href} className="sda-press bg-brand-black mt-6 inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white">
          {cta}
        </Link>
      ) : null}
    </div>
  );
}
