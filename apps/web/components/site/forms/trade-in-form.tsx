import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, CheckCircle2, ImagePlus, X } from 'lucide-react';
import { type CallableInput, createEnquiryInput, MAX_TRADE_IN_PHOTOS, TRADE_IN_CONDITIONS } from '@sda/shared';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DEMO_MODE, DemoUnsupportedError, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';
import { applyActionError, DemoNote, FormAlert, sharedResolver, SubmitButton, TextField } from './form-kit';
import { Turnstile, type TurnstileHandle } from './turnstile';

type Values = CallableInput<'createEnquiry'>;
type Photo = { id: string; file: File; url: string };

const CONDITION_COPY: Record<(typeof TRADE_IN_CONDITIONS)[number], string> = {
  excellent: 'Like new, no marks',
  good: 'Minor wear for its age',
  fair: 'Some dents or issues',
  poor: 'Needs work',
};
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Trade-in valuation request: vehicle details + up to 6 photos.
 * Photos go to Cloudflare Images via `getTradeInUploadUrls` (direct creator upload). In demo mode that call
 * throws DemoUnsupportedError – we keep the local previews, skip the upload, and still send the enquiry.
 */
export function TradeInForm() {
  const ts = useRef<TurnstileHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; uploaded: number; skippedPhotos: boolean } | null>(null);

  const form = useForm<Values>({
    resolver: sharedResolver(createEnquiryInput),
    defaultValues: {
      type: 'trade-in',
      carId: null,
      customer: { name: '', phone: '', email: '' },
      message: '',
      tradeInVehicle: { rego: '', make: '', model: '', year: undefined as unknown as number, km: undefined as unknown as number, condition: 'good', images: [] },
      turnstileToken: '',
    },
  });

  // Revoke preview URLs on unmount.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setPhotoError(null);
    const room = MAX_TRADE_IN_PHOTOS - photos.length;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/'));
    const tooBig = files.filter((f) => f.size > MAX_BYTES);
    const ok = files.filter((f) => f.size <= MAX_BYTES).slice(0, Math.max(0, room));
    if (tooBig.length) setPhotoError('Photos must be under 15 MB each.');
    else if (files.length > room) setPhotoError(`You can add up to ${MAX_TRADE_IN_PHOTOS} photos.`);
    setPhotos((prev) => [...prev, ...ok.map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) }))]);
    if (fileInput.current) fileInput.current.value = '';
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  async function uploadPhotos(): Promise<{ ids: string[]; skipped: boolean }> {
    if (!photos.length) return { ids: [], skipped: false };
    setStage('Uploading photos…');
    try {
      const turnstileToken = await ts.current!.consume();
      const { uploads } = await runAction('getTradeInUploadUrls', { count: photos.length, turnstileToken });
      const ids: string[] = [];
      for (const [i, u] of uploads.entries()) {
        const body = new FormData();
        body.append('file', photos[i]!.file);
        const res = await fetch(u.uploadURL, { method: 'POST', body });
        if (!res.ok) throw new Error('A photo failed to upload. Please try again.');
        ids.push(u.imageId);
      }
      return { ids, skipped: false };
    } catch (e) {
      if (e instanceof DemoUnsupportedError) return { ids: [], skipped: true };
      throw e;
    }
  }

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const { ids, skipped } = await uploadPhotos();
      setStage('Sending…');
      const turnstileToken = await ts.current!.consume().catch(() => values.turnstileToken);
      await runAction('createEnquiry', {
        ...values,
        tradeInVehicle: { ...values.tradeInVehicle!, images: ids },
        turnstileToken,
      });
      setDone({ email: values.customer.email, uploaded: ids.length, skippedPhotos: skipped });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(applyActionError(form, err));
    } finally {
      setStage(null);
    }
  }

  if (done) {
    return (
      <div role="status" className="bg-brand-stone rounded-2xl p-6 sm:p-10">
        <CheckCircle2 className="text-brand-red size-10" aria-hidden />
        <h2 className="font-display mt-5 text-3xl font-extrabold sm:text-4xl" style={{ fontStretch: '110%' }}>
          Valuation request sent
        </h2>
        <p className="text-muted-foreground mt-3 max-w-lg">
          Thanks – our buyer will look over the details{done.uploaded ? ` and ${done.uploaded} photo${done.uploaded === 1 ? '' : 's'}` : ''} and get back
          to you. A copy is on its way to <span className="text-foreground font-medium">{done.email}</span>.
        </p>
        {done.skippedPhotos ? (
          <DemoNote className="mt-5">Preview mode – photos aren’t uploaded and nothing was sent. On the live site they go with your request.</DemoNote>
        ) : DEMO_MODE ? (
          <DemoNote className="mt-5">Preview mode – nothing was sent.</DemoNote>
        ) : null}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-12">
        <fieldset>
          <legend className="font-display text-xl font-extrabold sm:text-2xl" style={{ fontStretch: '108%' }}>
            Your car
          </legend>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="tradeInVehicle.make" label="Make" placeholder="e.g. Toyota" required />
            <TextField form={form} name="tradeInVehicle.model" label="Model" placeholder="e.g. Hilux SR5" required />
            <TextField form={form} name="tradeInVehicle.year" label="Year" inputMode="numeric" asNumber placeholder="e.g. 2017" required />
            <TextField form={form} name="tradeInVehicle.km" label="Odometer (km)" inputMode="numeric" asNumber placeholder="e.g. 120000" required />
            <TextField form={form} name="tradeInVehicle.rego" label="Rego (optional)" placeholder="e.g. 1ABC234" className="sm:col-span-2" />
          </div>
          <FormField
            control={form.control}
            name="tradeInVehicle.condition"
            render={({ field }) => (
              <FormItem className="mt-6">
                <FormLabel>Overall condition</FormLabel>
                <div role="radiogroup" aria-label="Overall condition" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRADE_IN_CONDITIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={field.value === c}
                      onClick={() => field.onChange(c)}
                      className={cn(
                        'sda-press rounded-xl p-3 text-left ring-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                        field.value === c ? 'bg-brand-black text-white ring-transparent' : 'ring-black/12 hover:ring-black/35',
                      )}
                    >
                      <span className="block text-sm font-semibold capitalize">{c}</span>
                      <span className={cn('block text-xs', field.value === c ? 'text-white/70' : 'text-muted-foreground')}>{CONDITION_COPY[c]}</span>
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-extrabold sm:text-2xl" style={{ fontStretch: '108%' }}>
            Photos <span className="text-muted-foreground text-base font-medium">(up to {MAX_TRADE_IN_PHOTOS})</span>
          </legend>
          <p className="text-muted-foreground mt-2 text-sm">Front, back, both sides, the interior and the odometer give us the best picture.</p>
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {photos.map((p) => (
              <li key={p.id} className="bg-brand-stone relative aspect-square overflow-hidden rounded-lg">
                <img src={p.url} alt={p.file.name} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  aria-label={`Remove ${p.file.name}`}
                  className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
            {photos.length < MAX_TRADE_IN_PHOTOS ? (
              <li>
                <label className="text-muted-foreground hover:text-foreground flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-black/15 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-[var(--ring)] hover:border-black/40">
                  {photos.length ? <ImagePlus className="size-5" aria-hidden /> : <Camera className="size-5" aria-hidden />}
                  Add photo
                  <input ref={fileInput} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                </label>
              </li>
            ) : null}
          </ul>
          {photoError ? (
            <p role="alert" className="text-destructive mt-2 text-sm">
              {photoError}
            </p>
          ) : null}
          {DEMO_MODE && photos.length ? <DemoNote className="mt-3">Preview mode – photos stay on your device and aren’t uploaded.</DemoNote> : null}
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-extrabold sm:text-2xl" style={{ fontStretch: '108%' }}>
            Your details
          </legend>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="customer.name" label="Full name" autoComplete="name" required className="sm:col-span-2" />
            <TextField form={form} name="customer.phone" label="Mobile" type="tel" autoComplete="tel" inputMode="tel" required />
            <TextField form={form} name="customer.email" label="Email" type="email" autoComplete="email" inputMode="email" required />
            <TextField
              form={form}
              name="message"
              label="Anything else? (optional)"
              multiline
              placeholder="Service history, modifications, finance owing, the car you’re interested in…"
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        <div className="space-y-4 border-t pt-8">
          <Turnstile ref={ts} onToken={(t) => form.setValue('turnstileToken', t, { shouldValidate: form.formState.isSubmitted })} />
          {form.formState.errors.turnstileToken ? <p className="text-destructive text-sm">{form.formState.errors.turnstileToken.message}</p> : null}
          <FormAlert message={error} />
          <SubmitButton pending={form.formState.isSubmitting} pendingLabel={stage ?? 'Sending…'}>
            Get my valuation
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}
