/**
 * Create a booking for a phone / walk-in customer (staffCreateBooking). Slots come from getAvailability,
 * so the same rules as the website apply (hours, buffer, notice, blackout dates, capacity, locks).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarX2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { BOOKING_TYPE_LABELS, bookingTypeSchema, carTitle, customerSchema, formatInTz, zDateKey } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { actionErrorMessage, actionFieldIssues, type CarRecord, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';
import { today, TZ } from '../format';
import { optionsFrom, SelectField, TextareaField, TextField } from '../fields';
import { FormSheet } from '../form-sheet';

const schema = z
  .object({
    carId: z.string().min(1, 'Choose a car'),
    type: bookingTypeSchema,
    date: zDateKey,
    startAt: z.string().min(1, 'Pick a time'),
    name: customerSchema.shape.name,
    phone: customerSchema.shape.phone,
    email: customerSchema.shape.email,
    licenceConfirmed: z.boolean(),
    notes: z.string().trim().max(1000),
  })
  .refine((v) => v.type !== 'test-drive' || v.licenceConfirmed, { path: ['licenceConfirmed'], message: 'Confirm the customer holds a current licence' });
type Input = z.input<typeof schema>;

export interface BookingPrefill {
  carId?: string | null;
  customer?: { name: string; phone: string; email: string };
  notes?: string;
  type?: 'test-drive' | 'inspection';
}

export function CreateBookingSheet({
  open,
  onOpenChange,
  cars,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cars: CarRecord[];
  prefill?: BookingPrefill;
  onCreated?: (bookingId: string) => void;
}) {
  const bookable = cars.filter((c) => c.status === 'available' && c.published);
  const form = useForm<Input, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.reset({
      carId: prefill?.carId && bookable.some((c) => c.id === prefill.carId) ? prefill.carId : '',
      type: prefill?.type ?? 'test-drive',
      date: today(),
      startAt: '',
      name: prefill?.customer?.name ?? '',
      phone: prefill?.customer?.phone ?? '',
      email: prefill?.customer?.email ?? '',
      licenceConfirmed: false,
      notes: prefill?.notes ?? 'Booked over the phone.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [carId, date, type] = useWatch({ control: form.control, name: ['carId', 'date', 'type'] });

  useEffect(() => {
    if (!open || !carId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSlots(null);
      return;
    }
    let live = true;
    setSlotsLoading(true);
    form.setValue('startAt', '');
    runAction('getAvailability', { carId, date })
      .then((r) => live && setSlots(r.slots))
      .catch((e) => live && (toast.error(actionErrorMessage(e)), setSlots([])))
      .finally(() => live && setSlotsLoading(false));
    return () => {
      live = false;
    };
  }, [open, carId, date, form]);

  async function submit(v: z.output<typeof schema>) {
    try {
      const res = await runAction('staffCreateBooking', {
        carId: v.carId,
        type: v.type,
        startAt: v.startAt,
        customer: { name: v.name, phone: v.phone, email: v.email },
        licenceConfirmed: v.licenceConfirmed,
        notes: v.notes,
      });
      toast.success(`Booked ${v.name} for ${formatInTz(new Date(res.startAt), 'EEE d MMM, h:mm a', TZ)}`);
      onCreated?.(res.bookingId);
      onOpenChange(false);
    } catch (e) {
      const issues = actionFieldIssues(e);
      if (issues.length) issues.forEach((i) => form.setError((i.path.replace('customer.', '') || 'root') as keyof Input, { message: i.message }));
      toast.error(actionErrorMessage(e));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New booking"
      description="For phone and walk-in customers. The customer gets the same confirmation email as web bookings."
      wide
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="booking-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Book
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id="booking-form" onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <SelectField
            control={form.control}
            name="carId"
            label="Car"
            required
            className="sm:col-span-2"
            placeholder={bookable.length ? 'Choose a car' : 'No published, available cars'}
            options={bookable.map((c) => ({ value: c.id, label: `${carTitle(c)} · ${c.stockNo}` }))}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <ToggleGroup type="single" variant="outline" value={field.value} onValueChange={(v) => v && field.onChange(v)} className="w-full">
                    {optionsFrom(BOOKING_TYPE_LABELS).map((o) => (
                      <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
                        {o.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
              </FormItem>
            )}
          />
          <TextField control={form.control} name="date" label="Date" type="date" min={today()} required />
          <FormField
            control={form.control}
            name="startAt"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Time</FormLabel>
                {!carId ? (
                  <p className="text-muted-foreground text-sm">Choose a car to see open times.</p>
                ) : slotsLoading ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" /> Checking availability…
                  </p>
                ) : slots && slots.length === 0 ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CalendarX2 className="size-4" /> No open times that day. Try another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Open times">
                    {slots?.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={field.value === s}
                        onClick={() => field.onChange(s)}
                        className={cn(
                          'h-10 rounded-md border text-sm tabular-nums transition-colors',
                          field.value === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                        )}
                      >
                        {formatInTz(new Date(s), 'h:mm a', TZ)}
                      </button>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <TextField control={form.control} name="name" label="Customer name" required autoComplete="off" />
          <TextField control={form.control} name="phone" label="Phone" type="tel" required autoComplete="off" />
          <TextField control={form.control} name="email" label="Email" type="email" required autoComplete="off" className="sm:col-span-2" />
          {type === 'test-drive' && (
            <FormField
              control={form.control}
              name="licenceConfirmed"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <label className="flex items-start gap-2 text-sm">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} className="mt-0.5" />
                    </FormControl>
                    Customer confirmed they hold a current, full driver licence
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <TextareaField control={form.control} name="notes" label="Notes" rows={2} className="sm:col-span-2" />
        </form>
      </Form>
    </FormSheet>
  );
}
