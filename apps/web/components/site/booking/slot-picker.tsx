import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import {
  addDaysToDateKey,
  type BookingSettings,
  formatInTz,
  isDateBookable,
  todayInTz,
  weekdayOfDateKey,
} from '@sda/shared';
import { Calendar } from '@/components/ui/calendar';
import { actionErrorMessage, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';

const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const dateToKey = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Date picker + live time slots. Days come from settings/booking (weekly hours, blackout dates, max days
 * ahead); slots come from `getAvailability` (Cloud Function, or the shared helpers in demo mode).
 */
export function SlotPicker({
  carId,
  settings,
  timezone,
  value,
  onChange,
  invalid,
}: {
  carId: string;
  settings: BookingSettings;
  timezone: string;
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  invalid?: boolean;
}) {
  const today = todayInTz(timezone);
  const lastDay = addDaysToDateKey(today, settings.maxDaysAhead);
  const firstOpen = useMemo(() => {
    for (let i = 0; i <= settings.maxDaysAhead; i++) {
      const k = addDaysToDateKey(today, i);
      if (
        isDateBookable(settings, k, new Date(), timezone) &&
        (settings.weeklyHours[weekdayOfDateKey(k)]?.length ?? 0) > 0
      )
        return k;
    }
    return undefined;
  }, [settings, today, timezone]);

  const [date, setDate] = useState<string | undefined>(firstOpen);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The calendar depends on "today" and the browser locale – render it on the client only (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    runAction('getAvailability', { carId, date })
      .then((r) => live && setSlots(r.slots))
      .catch((e) => live && (setSlots([]), setError(actionErrorMessage(e))))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [carId, date]);

  const isOpenDay = (d: Date) => {
    const k = dateToKey(d);
    return (
      isDateBookable(settings, k, new Date(), timezone) &&
      (settings.weeklyHours[weekdayOfDateKey(k)]?.length ?? 0) > 0
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
      <div className="bg-background min-h-[22rem] w-full rounded-xl ring-1 ring-black/10 sm:w-fit sm:min-w-[19rem]">
        {mounted ? (
          <Calendar
            mode="single"
            selected={date ? keyToDate(date) : undefined}
            onSelect={(d) => {
              if (!d) return;
              setDate(dateToKey(d));
              onChange(undefined);
            }}
            defaultMonth={date ? keyToDate(date) : keyToDate(today)}
            startMonth={keyToDate(today)}
            endMonth={keyToDate(lastDay)}
            disabled={(d) => !isOpenDay(d)}
            weekStartsOn={1}
            className="w-full rounded-xl [--cell-size:--spacing(10)] sm:w-fit"
            classNames={{ root: 'w-full sm:w-fit' }}
          />
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium">
          {date ? formatInTz(`${date}T12:00:00Z`, 'EEEE d MMMM', 'UTC') : 'Choose a day'}
          <span className="text-muted-foreground font-normal">
            {' '}
            · {(timezone.split('/').pop() ?? timezone).replace('_', ' ')} time
          </span>
        </p>
        <div className="mt-3 min-h-28" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Checking available times…
            </p>
          ) : error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : slots && slots.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No times left on this day. Please pick another day.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label="Available times"
              className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2"
            >
              {(slots ?? []).map((iso) => (
                <button
                  key={iso}
                  type="button"
                  role="radio"
                  aria-checked={value === iso}
                  onClick={() => onChange(iso)}
                  className={cn(
                    'sda-press sda-num h-11 whitespace-nowrap rounded-lg text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                    value === iso
                      ? 'bg-brand-black text-white'
                      : 'bg-background ring-black/12 ring-1 hover:ring-black/40',
                    invalid && !value && 'ring-destructive/60',
                  )}
                >
                  {formatInTz(iso, 'h:mm a', timezone)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
