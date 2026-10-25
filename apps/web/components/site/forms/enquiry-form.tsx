import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2 } from 'lucide-react';
import { createEnquiryInput, type CallableInput } from '@sda/shared';
import { Form } from '@/components/ui/form';
import { DEMO_MODE, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';
import { applyActionError, DemoNote, FormAlert, sharedResolver, SubmitButton, TextField } from './form-kit';
import { Turnstile, type TurnstileHandle } from './turnstile';

type Values = CallableInput<'createEnquiry'>;

/**
 * General enquiry (optionally about one car). Validates with the shared `createEnquiryInput` schema and
 * calls `createEnquiry` (simulated in demo mode – nothing is sent).
 */
export function EnquiryForm({
  carId,
  carTitle,
  defaultMessage = '',
  tone = 'light',
  submitLabel = 'Send enquiry',
  compact = false,
  className,
  onDone,
}: {
  carId?: string;
  carTitle?: string;
  defaultMessage?: string;
  tone?: 'light' | 'dark';
  submitLabel?: string;
  compact?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const ts = useRef<TurnstileHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: sharedResolver(createEnquiryInput),
    defaultValues: {
      type: 'general',
      carId: carId ?? null,
      customer: { name: '', phone: '', email: '' },
      message: defaultMessage,
      tradeInVehicle: null,
      turnstileToken: '',
    },
  });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const turnstileToken = await ts.current!.consume().catch(() => values.turnstileToken);
      await runAction('createEnquiry', { ...values, turnstileToken });
      setSentTo(values.customer.email);
      form.reset();
    } catch (err) {
      setError(applyActionError(form, err));
    }
  }

  if (sentTo) {
    return (
      <div role="status" className={cn('rounded-2xl p-6', tone === 'dark' ? 'bg-white/[0.06] text-white' : 'bg-brand-stone', className)}>
        <CheckCircle2 className="text-brand-red size-8" aria-hidden />
        <p className="font-display mt-4 text-2xl font-extrabold" style={{ fontStretch: '110%' }}>
          Enquiry sent
        </p>
        <p className={cn('mt-2 text-sm', tone === 'dark' ? 'text-white/70' : 'text-muted-foreground')}>
          Thanks – our team will get back to you shortly{carTitle ? ` about the ${carTitle}` : ''}. A copy is on its way to{' '}
          <span className="font-medium">{sentTo}</span>.
        </p>
        {DEMO_MODE ? <DemoNote className="mt-4">Preview mode – nothing was actually sent.</DemoNote> : null}
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            onDone?.();
          }}
          className="mt-5 text-sm font-semibold underline underline-offset-4"
        >
          {onDone ? 'Close' : 'Send another enquiry'}
        </button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={cn(tone === 'dark' && 'dark', 'space-y-4', className)}>
        <div className={cn('grid gap-4', !compact && 'sm:grid-cols-2')}>
          <TextField form={form} name="customer.name" label="Name" autoComplete="name" required className={compact ? undefined : 'sm:col-span-2'} />
          <TextField form={form} name="customer.phone" label="Phone" type="tel" autoComplete="tel" inputMode="tel" required />
          <TextField form={form} name="customer.email" label="Email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <TextField
          form={form}
          name="message"
          label="Message"
          multiline
          required
          placeholder={carTitle ? 'Questions about history, inspection, finance…' : 'What are you looking for?'}
        />
        <Turnstile ref={ts} onToken={(t) => form.setValue('turnstileToken', t, { shouldValidate: form.formState.isSubmitted })} />
        {form.formState.errors.turnstileToken ? (
          <p className="text-destructive text-sm">{form.formState.errors.turnstileToken.message}</p>
        ) : null}
        <FormAlert message={error} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton pending={form.formState.isSubmitting}>{submitLabel}</SubmitButton>
          {DEMO_MODE ? <DemoNote>Preview – enquiries aren’t sent.</DemoNote> : null}
        </div>
      </form>
    </Form>
  );
}
