import Link from '@/components/link';
import { useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { BOOKING_STATUS_LABELS, BOOKING_TYPE_LABELS, type BookingSettings, formatInTz, type GetManagedBookingOutput } from '@sda/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { actionErrorMessage, DEMO_MODE, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';
import { DemoNote, FormAlert } from '../forms/form-kit';
import { downloadIcs } from '../lib/ics';
import { SlotPicker } from './slot-picker';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; booking: GetManagedBookingOutput };

/** Customer view of a booking via the emailed manage link (/booking/[id]?t=token): details, reschedule, cancel. */
export function ManageBooking({
  bookingId,
  token,
  settings,
  timezone,
  location,
  phone,
}: {
  bookingId: string;
  token: string;
  settings: BookingSettings;
  timezone: string;
  location: string;
  phone: string;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [newStart, setNewStart] = useState<string | undefined>();
  const [busy, setBusy] = useState<'cancel' | 'reschedule' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token.length < 16) {
      setState({ kind: 'error', message: 'This link is incomplete. Please open the link from your confirmation email again.' });
      return;
    }
    let live = true;
    runAction('getManagedBooking', { bookingId, token })
      .then((booking) => live && setState({ kind: 'ready', booking }))
      .catch((e) => live && setState({ kind: 'error', message: actionErrorMessage(e) }));
    return () => {
      live = false;
    };
  }, [bookingId, token]);

  if (state.kind === 'loading') {
    return (
      <p className="text-muted-foreground flex items-center gap-2" aria-live="polite">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading your booking…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="bg-brand-stone rounded-2xl p-8">
        <h2 className="font-display text-2xl font-extrabold">We couldn’t open this booking</h2>
        <p className="text-muted-foreground mt-2">{state.message}</p>
        <p className="text-muted-foreground mt-2">
          Call us on <span className="text-foreground font-medium">{phone}</span> and we’ll sort it out.
        </p>
      </div>
    );
  }

  const b = state.booking;
  const label = BOOKING_TYPE_LABELS[b.type];
  const active = b.status === 'confirmed' && new Date(b.startAt).getTime() > Date.now();

  async function cancel() {
    setBusy('cancel');
    setError(null);
    try {
      await runAction('cancelBooking', { bookingId, token });
      setState({ kind: 'ready', booking: { ...b, status: 'cancelled' } });
      setNotice('Your booking has been cancelled. We’ve emailed you a confirmation.');
    } catch (e) {
      setError(actionErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function reschedule() {
    if (!newStart) return setError('Choose a new time first.');
    setBusy('reschedule');
    setError(null);
    try {
      const r = await runAction('rescheduleBooking', { bookingId, token, startAt: newStart });
      setState({ kind: 'ready', booking: { ...b, startAt: r.startAt, endAt: r.endAt } });
      setMode('view');
      setNewStart(undefined);
      setNotice('Done – your booking has moved. We’ve emailed you the new time.');
    } catch (e) {
      setError(actionErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {notice ? (
        <div role="status" className="bg-brand-stone flex items-start gap-3 rounded-xl p-4 text-sm">
          <CheckCircle2 className="text-brand-red mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{notice}</p>
        </div>
      ) : null}

      <div className="rounded-2xl p-6 ring-1 ring-black/10 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
            {label}
          </p>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              b.status === 'confirmed' ? 'bg-brand-black text-white' : 'bg-brand-stone text-black/70',
            )}
          >
            {BOOKING_STATUS_LABELS[b.status]}
          </span>
        </div>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <Item label="Car">
            {b.carSlug ? (
              <Link href={`/cars/${b.carSlug}`} className="underline underline-offset-4">
                {b.carTitle}
              </Link>
            ) : (
              b.carTitle
            )}
          </Item>
          <Item label="When">{formatInTz(b.startAt, 'EEEE d MMMM yyyy, h:mm a', timezone)}</Item>
          <Item label="Where">{location}</Item>
          <Item label="Booked for">
            {b.customer.name} · {b.customer.email}
          </Item>
        </dl>

        {active ? (
          <div className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                downloadIcs({ uid: `${b.bookingId}@soliddrive`, start: b.startAt, end: b.endAt, summary: `${label}: ${b.carTitle}`, location }, 'booking.ics')
              }
              className="sda-press bg-brand-black inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
            >
              <CalendarPlus className="size-4" aria-hidden /> Add to calendar
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'reschedule' ? 'view' : 'reschedule')}
              aria-expanded={mode === 'reschedule'}
              className="sda-press inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold ring-1 ring-black/15"
            >
              Change time
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="text-destructive inline-flex h-12 items-center justify-center px-3 text-sm font-semibold underline-offset-4 hover:underline">
                  Cancel booking
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Cancel this {label.toLowerCase()}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your time on {formatInTz(b.startAt, 'EEE d MMM, h:mm a', timezone)} will be released. You can book again any time.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep booking</AlertDialogCancel>
                  <AlertDialogAction onClick={cancel} className="bg-destructive hover:bg-destructive/90 text-white">
                    {busy === 'cancel' ? 'Cancelling…' : 'Cancel booking'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : b.status === 'confirmed' ? null : (
          <p className="text-muted-foreground mt-8 border-t pt-6 text-sm">
            This booking is {BOOKING_STATUS_LABELS[b.status].toLowerCase()}.{' '}
            {b.carSlug ? (
              <Link href={`/cars/${b.carSlug}/book`} className="text-foreground font-medium underline underline-offset-4">
                Make a new booking
              </Link>
            ) : null}
          </p>
        )}
      </div>

      {active && mode === 'reschedule' ? (
        <div className="rounded-2xl p-6 ring-1 ring-black/10 sm:p-8">
          <h2 className="font-display text-xl font-extrabold">Choose a new time</h2>
          <div className="mt-5">
            <SlotPicker carId={b.carId} settings={settings} timezone={timezone} value={newStart} onChange={setNewStart} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={reschedule}
              disabled={busy === 'reschedule' || !newStart}
              className="sda-press bg-brand-red inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === 'reschedule' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {newStart ? `Move to ${formatInTz(newStart, 'EEE d MMM, h:mm a', timezone)}` : 'Move booking'}
            </button>
            <button type="button" onClick={() => setMode('view')} className="h-12 px-3 text-sm font-semibold underline underline-offset-4">
              Never mind
            </button>
          </div>
        </div>
      ) : null}

      <FormAlert message={error} />
      {DEMO_MODE ? <DemoNote>Preview mode – changes are simulated and no emails are sent.</DemoNote> : null}
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
