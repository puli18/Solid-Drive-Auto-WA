import Link from '@/components/link';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CalendarPlus, CheckCircle2, Search, Wrench } from 'lucide-react';
import {
  BOOKING_TYPE_LABELS,
  type BookingSettings,
  type CallableInput,
  type CreateBookingOutput,
  createBookingInput,
  formatInTz,
} from '@sda/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DEMO_MODE, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';
import { applyActionError, DemoNote, FormAlert, sharedResolver, SubmitButton, TextField } from '../forms/form-kit';
import { Turnstile, type TurnstileHandle } from '../forms/turnstile';
import { downloadIcs } from '../lib/ics';
import { SlotPicker } from './slot-picker';

type Values = CallableInput<'createBooking'>;

const TYPES = [
  { value: 'test-drive', icon: Search, title: 'Test drive', text: 'Take it on the road with one of our team. Bring your driver licence.' },
  { value: 'inspection', icon: Wrench, title: 'Inspection', text: 'Look it over at the yard, bring a mechanic, ask all the questions.' },
] as const;

export function BookingFlow({
  car,
  settings,
  timezone,
  location,
  siteUrl,
}: {
  car: { id: string; slug: string; title: string };
  settings: BookingSettings;
  timezone: string;
  location: string;
  siteUrl: string;
}) {
  const ts = useRef<TurnstileHandle>(null);
  const topRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<(CreateBookingOutput & { type: Values['type']; email: string }) | null>(null);
  const form = useForm<Values>({
    resolver: sharedResolver(createBookingInput),
    defaultValues: {
      carId: car.id,
      type: 'test-drive',
      startAt: '',
      customer: { name: '', phone: '', email: '' },
      licenceConfirmed: false,
      notes: '',
      turnstileToken: '',
    },
  });
  const type = useWatch({ control: form.control, name: 'type' });
  const startAt = useWatch({ control: form.control, name: 'startAt' });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const turnstileToken = await ts.current!.consume().catch(() => values.turnstileToken);
      const res = await runAction('createBooking', { ...values, turnstileToken });
      setDone({ ...res, type: values.type, email: values.customer.email });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(applyActionError(form, err));
      if (form.getFieldState('startAt').error) goTo(2);
    }
  }

  if (done) {
    const manageHref = `/booking/${encodeURIComponent(done.bookingId)}?t=${encodeURIComponent(done.manageToken)}`;
    const label = BOOKING_TYPE_LABELS[done.type];
    return (
      <div role="status" className="bg-brand-stone rounded-2xl p-6 sm:p-10">
        <CheckCircle2 className="text-brand-red size-10" aria-hidden />
        <h2 className="font-display mt-5 text-3xl font-extrabold sm:text-4xl" style={{ fontStretch: '110%' }}>
          You’re booked in
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg">
          {label} of the {car.title}. We’ve sent a confirmation to <span className="text-foreground font-medium">{done.email}</span> with a
          link to change or cancel.
        </p>
        <dl className="bg-background mt-6 grid gap-px overflow-hidden rounded-xl ring-1 ring-black/10 sm:grid-cols-2">
          <div className="p-4">
            <dt className="text-muted-foreground text-xs">When</dt>
            <dd className="mt-1 font-semibold">{formatInTz(done.startAt, 'EEEE d MMMM, h:mm a', timezone)}</dd>
          </div>
          <div className="p-4">
            <dt className="text-muted-foreground text-xs">Where</dt>
            <dd className="mt-1 font-semibold">{location}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              downloadIcs(
                {
                  uid: `${done.bookingId}@soliddrive`,
                  start: done.startAt,
                  end: done.endAt,
                  summary: `${label}: ${car.title}`,
                  location,
                  description: `Manage your booking: ${siteUrl}${manageHref}`,
                  url: `${siteUrl}${manageHref}`,
                },
                `sda-${done.type}-${done.startAt.slice(0, 10)}.ics`,
              )
            }
            className="sda-press bg-brand-black inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Add to calendar (.ics)
          </button>
          <Link href={manageHref} className="sda-press inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold ring-1 ring-black/15">
            Manage booking
          </Link>
          <Link href={`/cars/${car.slug}`} className="inline-flex h-12 items-center justify-center px-2 text-sm font-semibold underline underline-offset-4">
            Back to the car
          </Link>
        </div>
        {DEMO_MODE ? <DemoNote className="mt-6">Preview mode – no email was sent; the booking is saved in this browser only.</DemoNote> : null}
      </div>
    );
  }

  function goTo(next: 1 | 2 | 3) {
    setStep(next);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      topRef.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true });
    });
  }

  const typeLabel = TYPES.find((t) => t.value === type)?.title ?? '';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="scroll-mt-28" ref={topRef}>
        <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
          Step {step} of 3
        </p>
        <ol aria-hidden className="mb-8 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => (
            <li key={n} className={cn('h-1 rounded-full transition-colors duration-300', n <= step ? 'bg-brand-red' : 'bg-black/10')} />
          ))}
        </ol>

        {step > 1 ? (
          <dl className="mb-8 divide-y rounded-xl ring-1 ring-black/10">
            <Done label="Booking" value={typeLabel} onChange={() => goTo(1)} />
            {step > 2 && startAt ? <Done label="When" value={formatInTz(startAt, 'EEE d MMM, h:mm a', timezone)} onChange={() => goTo(2)} /> : null}
          </dl>
        ) : null}

        {step === 1 ? (
          <Step key="s1" n={1} title="What would you like to book?">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Booking type" className="grid gap-3 sm:grid-cols-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === t.value}
                      onClick={() => {
                        field.onChange(t.value);
                        goTo(2);
                      }}
                      className={cn(
                        'sda-press flex gap-4 rounded-xl p-5 text-left ring-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                        field.value === t.value ? 'bg-brand-black text-white ring-transparent' : 'bg-background ring-black/12 hover:ring-black/35',
                      )}
                    >
                      <t.icon className={cn('mt-0.5 size-5 shrink-0', field.value === t.value ? 'text-brand-red' : 'text-black/60')} aria-hidden />
                      <span>
                        <span className="block font-semibold">{t.title}</span>
                        <span className={cn('mt-1 block text-sm', field.value === t.value ? 'text-white/70' : 'text-muted-foreground')}>{t.text}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            />
          </Step>
        ) : null}

        {step === 2 ? (
          <Step key="s2" n={2} title="Pick a day and time">
            <SlotPicker
              carId={car.id}
              settings={settings}
              timezone={timezone}
              value={startAt || undefined}
              invalid={!!form.formState.errors.startAt}
              onChange={(iso) => form.setValue('startAt', iso ?? '', { shouldValidate: form.formState.isSubmitted })}
            />
            {form.formState.errors.startAt ? (
              <p className="text-destructive mt-3 text-sm">{form.formState.errors.startAt.message}</p>
            ) : null}
            <p className="text-muted-foreground mt-3 text-xs">
              Each booking is {settings.slotMinutes} minutes. Times shown are open right now and are held for you when you confirm.
            </p>
            <StepNav onBack={() => goTo(1)}>
              <button
                type="button"
                disabled={!startAt}
                onClick={() => goTo(3)}
                className="sda-press bg-brand-black inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-semibold text-white disabled:opacity-40"
              >
                Continue
              </button>
            </StepNav>
          </Step>
        ) : null}

        {step === 3 ? (
          <Step key="s3" n={3} title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="customer.name" label="Full name" autoComplete="name" required className="sm:col-span-2" />
              <TextField form={form} name="customer.phone" label="Mobile" type="tel" autoComplete="tel" inputMode="tel" required />
              <TextField form={form} name="customer.email" label="Email" type="email" autoComplete="email" inputMode="email" required />
              <TextField form={form} name="notes" label="Anything we should know? (optional)" multiline className="sm:col-span-2" />
            </div>
            {type === 'test-drive' ? (
              <FormField
                control={form.control}
                name="licenceConfirmed"
                render={({ field }) => (
                  <FormItem className="mt-5 flex flex-row items-start gap-3 rounded-xl p-4 ring-1 ring-black/10">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5 size-5" />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-sm leading-snug font-medium">I hold a current, full or provisional driver licence and will bring it with me.</FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            ) : null}

            <div className="mt-8 space-y-4 border-t pt-8">
              <Turnstile ref={ts} onToken={(t) => form.setValue('turnstileToken', t, { shouldValidate: form.formState.isSubmitted })} />
              {form.formState.errors.turnstileToken ? (
                <p className="text-destructive text-sm">{form.formState.errors.turnstileToken.message}</p>
              ) : null}
              <FormAlert message={error} />
              <StepNav onBack={() => goTo(2)}>
                <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Booking…">
                  Confirm {type === 'inspection' ? 'inspection' : 'test drive'}
                </SubmitButton>
              </StepNav>
              {DEMO_MODE ? <DemoNote>Preview – bookings are simulated and nothing is sent.</DemoNote> : null}
            </div>
          </Step>
        ) : null}
      </form>
    </Form>
  );
}

/** A completed step, collapsed to one line with a way back. */
function Done({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="truncate font-semibold">{value}</dd>
      </div>
      <button type="button" onClick={onChange} className="shrink-0 text-sm font-semibold underline underline-offset-4">
        Change
      </button>
    </div>
  );
}

function StepNav({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
      <button type="button" onClick={onBack} className="inline-flex h-12 items-center justify-center px-4 text-sm font-semibold">
        Back
      </button>
      {children}
    </div>
  );
}

/** A numbered step – the order is real (type → time → details). */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      <legend data-step-heading tabIndex={-1} className="flex items-center gap-3 outline-none">
        <span className="bg-brand-black sda-num grid size-8 place-items-center rounded-full text-sm font-bold text-white">{n}</span>
        <span className="font-display text-xl font-extrabold sm:text-2xl" style={{ fontStretch: '108%' }}>
          {title}
        </span>
      </legend>
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}
