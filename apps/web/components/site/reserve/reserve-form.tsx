import Link from '@/components/link';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowRight, Lock, ShieldAlert } from 'lucide-react';
import { type CallableInput, createDepositCheckoutInput, formatAUD } from '@sda/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DEMO_MODE, runAction } from '@/lib/data';
import { applyActionError, FormAlert, sharedResolver, SubmitButton, TextField } from '../forms/form-kit';
import { Turnstile, type TurnstileHandle } from '../forms/turnstile';
import { paragraphs } from '../lib/format';

type Values = CallableInput<'createDepositCheckout'>;

/**
 * Reserve with a fixed, non-refundable deposit. Validates with `createDepositCheckoutInput`, then
 * `createDepositCheckout` returns the Stripe Checkout URL. In demo mode a "no payment taken" step is shown first.
 */
export function ReserveForm({
  carId,
  carTitle,
  amountCents,
  termsText,
  termsVersion,
}: {
  carId: string;
  carTitle: string;
  amountCents: number;
  termsText: string;
  termsVersion: string;
}) {
  const ts = useRef<TurnstileHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const amount = formatAUD(amountCents);
  const form = useForm<Values>({
    resolver: sharedResolver(createDepositCheckoutInput),
    defaultValues: {
      carId,
      customer: { name: '', phone: '', email: '' },
      termsAccepted: false as unknown as true,
      termsVersion,
      turnstileToken: '',
    },
  });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const turnstileToken = await ts.current!.consume().catch(() => values.turnstileToken);
      const { url } = await runAction('createDepositCheckout', { ...values, turnstileToken });
      if (DEMO_MODE) {
        setDemoUrl(url);
        return;
      }
      setRedirecting(true);
      window.location.assign(url);
    } catch (err) {
      setError(applyActionError(form, err));
    }
  }

  if (demoUrl) {
    return (
      <div role="status" className="dark bg-brand-black text-foreground rounded-2xl p-6 sm:p-10">
        <span className="bg-brand-red inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white">
          <ShieldAlert className="size-3.5" aria-hidden /> Demo – no payment taken
        </span>
        <h2 className="font-display mt-5 text-3xl font-extrabold text-white" style={{ fontStretch: '110%' }}>
          This is where Stripe Checkout opens
        </h2>
        <p className="text-muted-foreground mt-3 max-w-lg">
          On the live site you’d now pay the {amount} deposit on Stripe’s secure checkout page (card, Apple Pay or Google Pay). In this preview no
          card is asked for and nothing is charged.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={demoUrl}
            className="sda-press bg-brand-red hover:bg-brand-red-hover inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
          >
            Continue to confirmation <ArrowRight className="size-4" aria-hidden />
          </Link>
          <button type="button" onClick={() => setDemoUrl(null)} className="h-12 px-3 text-sm font-semibold text-white underline underline-offset-4">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-10">
        <fieldset>
          <legend className="font-display text-xl font-extrabold sm:text-2xl" style={{ fontStretch: '108%' }}>
            Your details
          </legend>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="customer.name" label="Full name" autoComplete="name" required className="sm:col-span-2" />
            <TextField form={form} name="customer.phone" label="Mobile" type="tel" autoComplete="tel" inputMode="tel" required />
            <TextField form={form} name="customer.email" label="Email" type="email" autoComplete="email" inputMode="email" required hint="Your receipt goes here." />
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-extrabold sm:text-2xl" style={{ fontStretch: '108%' }}>
            Deposit terms
          </legend>
          <div className="bg-brand-stone mt-5 max-h-64 overflow-y-auto rounded-xl p-5 text-sm leading-relaxed" tabIndex={0} aria-label="Deposit terms">
            {paragraphs(termsText).map((p) => (
              <p key={p.slice(0, 40)} className="mt-3 first:mt-0">
                {p}
              </p>
            ))}
          </div>
          <FormField
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem className="mt-4 flex flex-row items-start gap-3 rounded-xl p-4 ring-1 ring-black/12">
                <FormControl>
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5 size-5" />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel className="text-sm leading-snug font-medium">
                    I understand the {amount} deposit is <strong>non-refundable</strong> and agree to the{' '}
                    <Link href="/deposit-terms" target="_blank" className="underline underline-offset-4">
                      deposit terms
                    </Link>
                    .
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </fieldset>

        <div className="space-y-4 border-t pt-8">
          <Turnstile ref={ts} onToken={(t) => form.setValue('turnstileToken', t, { shouldValidate: form.formState.isSubmitted })} />
          {form.formState.errors.turnstileToken ? <p className="text-destructive text-sm">{form.formState.errors.turnstileToken.message}</p> : null}
          <FormAlert message={error} />
          <SubmitButton pending={form.formState.isSubmitting || redirecting} pendingLabel={redirecting ? 'Opening secure checkout…' : 'Preparing…'}>
            <Lock className="size-4" aria-hidden />
            Pay {amount} deposit
          </SubmitButton>
          <p className="text-muted-foreground text-xs">
            Payment is handled by Stripe. {carTitle} comes off the market as soon as the payment is confirmed. We never add a card surcharge.
          </p>
        </div>
      </form>
    </Form>
  );
}
