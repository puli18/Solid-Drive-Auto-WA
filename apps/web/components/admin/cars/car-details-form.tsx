/**
 * Car Details form (create + edit). Validated with a form schema derived from the shared
 * `carInputSchema` (money typed in dollars, stored in cents; features one per line).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  BODY_TYPE_LABELS,
  carInputSchema,
  type CarFormValues,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  zDateKey,
} from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { actionErrorMessage, type CarRecord } from '@/lib/data';
import { centsToInput, dateKey, inputToCents } from '../format';
import { FormSection, MoneyField, optionsFrom, SelectField, SwitchField, TextareaField, TextField } from '../fields';

const s = carInputSchema.shape;
const dollars = z
  .string()
  .trim()
  .refine((v) => v !== '' && Number.isFinite(inputToCents(v)) && inputToCents(v) >= 0, 'Enter an amount in dollars');
const intString = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v.replace(/,/g, '')) && +v.replace(/,/g, '') >= min && +v.replace(/,/g, '') <= max, `Enter a valid ${label}`);

export const carFormSchema = z.object({
  stockNo: s.stockNo,
  vin: s.vin,
  rego: s.rego,
  regoExpiry: zDateKey.or(z.literal('')),
  make: s.make,
  model: s.model,
  variant: s.variant,
  year: intString('year', 1950, new Date().getFullYear() + 1),
  bodyType: s.bodyType,
  transmission: s.transmission,
  fuel: s.fuel,
  engine: s.engine,
  colour: s.colour,
  km: intString('odometer reading', 0, 2_000_000),
  price: dollars,
  features: z.string().max(6000),
  description: s.description,
  published: z.boolean(),
  syndication: z.object({ carsales: z.boolean(), gumtree: z.boolean(), facebook: z.boolean() }),
});
export type CarFormInput = z.input<typeof carFormSchema>;

export function carToForm(car: CarRecord | null, stockNo = ''): CarFormInput {
  return {
    stockNo: car?.stockNo ?? stockNo,
    vin: car?.vin ?? '',
    rego: car?.rego ?? '',
    regoExpiry: car?.regoExpiry ? dateKey(car.regoExpiry) : '',
    make: car?.make ?? '',
    model: car?.model ?? '',
    variant: car?.variant ?? '',
    year: car ? String(car.year) : '',
    bodyType: car?.bodyType ?? ('' as never),
    transmission: car?.transmission ?? 'automatic',
    fuel: car?.fuel ?? 'petrol',
    engine: car?.engine ?? '',
    colour: car?.colour ?? '',
    km: car ? String(car.km) : '',
    price: car ? centsToInput(car.priceCents) : '',
    features: (car?.features ?? []).join('\n'),
    description: car?.description ?? '',
    published: car?.published ?? false,
    syndication: { carsales: car?.syndication?.carsales ?? false, gumtree: car?.syndication?.gumtree ?? false, facebook: car?.syndication?.facebook ?? false },
  };
}

export function formToCar(v: z.output<typeof carFormSchema>): Omit<CarFormValues, 'status' | 'images'> {
  return {
    stockNo: v.stockNo,
    vin: v.vin,
    rego: v.rego,
    regoExpiry: v.regoExpiry || null,
    make: v.make,
    model: v.model,
    variant: v.variant,
    year: Number(v.year),
    bodyType: v.bodyType,
    transmission: v.transmission,
    fuel: v.fuel,
    engine: v.engine,
    colour: v.colour,
    km: Number(v.km.replace(/,/g, '')),
    priceCents: inputToCents(v.price),
    features: v.features
      .split(/\n|,/)
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 80),
    description: v.description,
    published: v.published,
    syndication: v.syndication,
  };
}

export function CarDetailsForm({
  car,
  defaultStockNo,
  onSubmit,
  submitLabel,
  canPublish = true,
}: {
  car: CarRecord | null;
  defaultStockNo?: string;
  onSubmit: (values: Omit<CarFormValues, 'status' | 'images'>) => Promise<void>;
  submitLabel: string;
  canPublish?: boolean;
}) {
  const form = useForm<CarFormInput, unknown, z.output<typeof carFormSchema>>({
    resolver: zodResolver(carFormSchema),
    defaultValues: carToForm(car, defaultStockNo),
    mode: 'onTouched',
  });
  const { control, formState } = form;

  async function submit(v: z.output<typeof carFormSchema>) {
    try {
      await onSubmit(formToCar(v));
      form.reset(v as CarFormInput);
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submit, () => toast.error('Check the highlighted fields'))}
        className="space-y-6"
        noValidate
      >
        <FormSection title="Vehicle" description="What the customer sees in the listing title and specs.">
          <TextField control={control} name="make" label="Make" required autoComplete="off" placeholder="Toyota" />
          <TextField control={control} name="model" label="Model" required autoComplete="off" placeholder="Hilux" />
          <TextField control={control} name="variant" label="Variant" autoComplete="off" placeholder="SR5 Double Cab" />
          <TextField control={control} name="year" label="Year" required inputMode="numeric" placeholder="2021" />
          <SelectField control={control} name="bodyType" label="Body" required options={optionsFrom(BODY_TYPE_LABELS)} />
          <SelectField control={control} name="transmission" label="Transmission" required options={optionsFrom(TRANSMISSION_LABELS)} />
          <SelectField control={control} name="fuel" label="Fuel" required options={optionsFrom(FUEL_TYPE_LABELS)} />
          <TextField control={control} name="engine" label="Engine" placeholder="2.8L 4cyl turbo diesel" />
          <TextField control={control} name="colour" label="Colour" placeholder="Glacier White" />
          <TextField control={control} name="km" label="Odometer (km)" required inputMode="numeric" placeholder="64000" />
        </FormSection>

        <FormSection title="Identification" description="Stock no is used in the web address and on reports.">
          <TextField control={control} name="stockNo" label="Stock no" required className="font-mono" autoCapitalize="characters" />
          <TextField control={control} name="vin" label="VIN" autoCapitalize="characters" maxLength={17} />
          <TextField control={control} name="rego" label="Rego" autoCapitalize="characters" />
          <TextField control={control} name="regoExpiry" label="Rego expiry" type="date" />
        </FormSection>

        <FormSection title="Listing" description="Price is drive-away, including GST.">
          <MoneyField control={control} name="price" label="Price" required placeholder="42,990" />
          <div className="hidden sm:block" />
          <TextareaField control={control} name="description" label="Description" rows={5} className="sm:col-span-2" />
          <TextareaField control={control} name="features" label="Features" description="One per line" rows={5} className="sm:col-span-2" />
        </FormSection>

        <FormSection title="Visibility" description="Publishing a draft also marks it available (needs a photo, price, make, model and year).">
          <SwitchField control={control} name="published" label="Show on website" disabled={!canPublish} className="sm:col-span-2" />
          <SwitchField control={control} name="syndication.carsales" label="Carsales feed" description="Phase 3 – listing syndication" />
          <SwitchField control={control} name="syndication.gumtree" label="Gumtree feed" />
          <SwitchField control={control} name="syndication.facebook" label="Facebook Marketplace" />
        </FormSection>

        <div className="bg-background/95 fixed inset-x-0 bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] z-20 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          {formState.isDirty && car && (
            <Button type="button" variant="ghost" onClick={() => form.reset()}>
              Discard
            </Button>
          )}
          <Button type="submit" disabled={formState.isSubmitting || (!!car && !formState.isDirty)}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
