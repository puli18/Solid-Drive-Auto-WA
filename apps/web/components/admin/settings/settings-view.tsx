/**
 * /admin/settings (admin) – Business, Booking rules, Deposit, Finance, Legal text.
 * Each tab edits one settings doc locally and validates with the shared zod schema before saving.
 */
import { Loader2, Plus, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  appSettingsSchema,
  bookingSettingsSchema,
  businessSettingsSchema,
  depositSettingsSchema,
  financeSettingsSchema,
  formatInTz,
  legalSettingsSchema,
  WEEKDAYS,
} from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, getAdminRepo, type SettingsId, type SettingsMap } from '@/lib/data';
import { cn } from '@/lib/utils';
import { centsToInput, inputToCents, today, TZ } from '../format';
import { useRepo } from '../use-data';
import { AdminOnly, ErrorState, ListSkeleton, MoneyInput, PageHeader, Panel } from '../ui';

type Errors = Record<string, string>;
const DAY_LABEL: Record<(typeof WEEKDAYS)[number], string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

function F({ label, error, hint, children, className, htmlFor }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className={error ? 'text-destructive' : undefined}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-destructive text-xs" role="alert">{error}</p>}
    </div>
  );
}

/** Load one settings doc into local state; validate + save with its schema. */
function useSettingsDoc<K extends SettingsId>(id: K, schema: z.ZodType<SettingsMap[K]>) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useRepo((r) => r.getSettings(id), [id]);
  const [value, setValue] = useState<SettingsMap[K] | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setValue(structuredClone(data));
  }, [data]);
  const dirty = !!data && !!value && JSON.stringify(data) !== JSON.stringify(value);

  async function save(override?: SettingsMap[K]) {
    const v = override ?? value;
    if (!v) return false;
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) errs[i.path.join('.')] ??= i.message;
      setErrors(errs);
      toast.error('Check the highlighted fields');
      return false;
    }
    setErrors({});
    setSaving(true);
    try {
      await getAdminRepo().saveSettings(id, parsed.data, user!.uid);
      toast.success('Settings saved');
      void reload();
      return true;
    } catch (e) {
      toast.error(actionErrorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { value, setValue, errors, saving, dirty, save, error, loading, reload, reset: () => data && setValue(structuredClone(data)) };
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t pt-4">
      {dirty && <Button variant="ghost" onClick={onReset}>Discard</Button>}
      <Button onClick={onSave} disabled={!dirty || saving}>
        {saving && <Loader2 className="animate-spin" />}
        Save
      </Button>
    </div>
  );
}

const num = (v: string) => (v === '' ? NaN : Number(v));

function BusinessTab() {
  const s = useSettingsDoc('business', businessSettingsSchema as never);
  const app = useSettingsDoc('app', appSettingsSchema as never);
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.value || !app.value) return <ListSkeleton rows={4} />;
  const v = s.value;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  const setAddr = (patch: Partial<typeof v.address>) => set({ address: { ...v.address, ...patch } });
  const e = s.errors;
  return (
    <div className="space-y-4">
      <Panel title="Business details" description="Shown in the website footer, emails and reports.">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Business name" error={e.name}><Input value={v.name} onChange={(x) => set({ name: x.target.value })} /></F>
          <F label="Short name" error={e.shortName}><Input value={v.shortName} onChange={(x) => set({ shortName: x.target.value })} /></F>
          <F label="ABN" error={e.abn}><Input value={v.abn} onChange={(x) => set({ abn: x.target.value })} inputMode="numeric" /></F>
          <F label="Dealer licence no" error={e.dealerLicenceNo}><Input value={v.dealerLicenceNo} onChange={(x) => set({ dealerLicenceNo: x.target.value })} /></F>
          <F label="Phone" error={e.phone}><Input type="tel" value={v.phone} onChange={(x) => set({ phone: x.target.value })} /></F>
          <F label="Email" error={e.email}><Input type="email" value={v.email} onChange={(x) => set({ email: x.target.value })} /></F>
          <F label="Street address" error={e['address.line1']} className="sm:col-span-2"><Input value={v.address.line1} onChange={(x) => setAddr({ line1: x.target.value })} /></F>
          <F label="Suburb" error={e['address.suburb']}><Input value={v.address.suburb} onChange={(x) => setAddr({ suburb: x.target.value })} /></F>
          <div className="grid grid-cols-2 gap-4">
            <F label="State" error={e['address.state']}><Input value={v.address.state} onChange={(x) => setAddr({ state: x.target.value })} /></F>
            <F label="Postcode" error={e['address.postcode']}><Input value={v.address.postcode} inputMode="numeric" onChange={(x) => setAddr({ postcode: x.target.value })} /></F>
          </div>
          <F label="Opening hours (display text)" error={e.hours} className="sm:col-span-2" hint="Bookable hours are set under Booking rules.">
            <Input value={v.hours} onChange={(x) => set({ hours: x.target.value })} />
          </F>
          <F label="GST rate (%)" error={e.gstRate} hint="Used to split GST on expenses and sales.">
            <Input type="number" inputMode="decimal" step="0.1" value={Number.isNaN(v.gstRate) ? '' : v.gstRate} onChange={(x) => set({ gstRate: num(x.target.value) })} />
          </F>
          <F label="Time zone" hint="All times are shown in this zone."><Input value={v.timezone} disabled /></F>
        </div>
        <div className="mt-4"><SaveBar dirty={s.dirty} saving={s.saving} onSave={() => void s.save()} onReset={s.reset} /></div>
      </Panel>
      <Panel title="Dashboard" description="Internal settings (not shown publicly).">
        <F label="Aged stock after (days)" error={app.errors.agedStockDays} hint="Cars in stock longer than this are flagged on the overview." className="max-w-xs">
          <Input type="number" inputMode="numeric" value={Number.isNaN(app.value.agedStockDays) ? '' : app.value.agedStockDays} onChange={(x) => app.setValue({ ...app.value!, agedStockDays: num(x.target.value) })} />
        </F>
        <div className="mt-4"><SaveBar dirty={app.dirty} saving={app.saving} onSave={() => void app.save()} onReset={app.reset} /></div>
      </Panel>
    </div>
  );
}

function BookingTab() {
  const s = useSettingsDoc('booking', bookingSettingsSchema as never);
  const [blackout, setBlackout] = useState('');
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.value) return <ListSkeleton rows={4} />;
  const v = s.value;
  const e = s.errors;
  const set = (patch: Partial<typeof v>) => s.setValue({ ...v, ...patch });
  const setDay = (d: (typeof WEEKDAYS)[number], ranges: { start: string; end: string }[]) => set({ weeklyHours: { ...v.weeklyHours, [d]: ranges } });
  const n = (k: 'slotMinutes' | 'bufferMinutes' | 'maxPerSlot' | 'minNoticeHours' | 'maxDaysAhead') => ({
    value: Number.isNaN(v[k]) ? '' : v[k],
    onChange: (x: React.ChangeEvent<HTMLInputElement>) => set({ [k]: num(x.target.value) } as Partial<typeof v>),
    type: 'number',
    inputMode: 'numeric' as const,
  });
  return (
    <div className="space-y-4">
      <Panel title="Slots" description="Each slot is followed by the buffer before the next one can start.">
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="Slot length (min)" error={e.slotMinutes}><Input {...n('slotMinutes')} /></F>
          <F label="Buffer (min)" error={e.bufferMinutes}><Input {...n('bufferMinutes')} /></F>
          <F label="Bookings per slot" error={e.maxPerSlot} hint="Across all cars"><Input {...n('maxPerSlot')} /></F>
          <F label="Minimum notice (hours)" error={e.minNoticeHours}><Input {...n('minNoticeHours')} /></F>
          <F label="Book up to (days ahead)" error={e.maxDaysAhead}><Input {...n('maxDaysAhead')} /></F>
        </div>
      </Panel>
      <Panel title="Weekly hours" description="Times customers can book. Add a second range for a lunch break.">
        <ul className="divide-y">
          {WEEKDAYS.map((d) => {
            const ranges = v.weeklyHours[d] ?? [];
            const open = ranges.length > 0;
            return (
              <li key={d} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <label className="flex w-40 shrink-0 items-center gap-3 pt-1.5 text-sm font-medium">
                  <Switch checked={open} onCheckedChange={(c) => setDay(d, c ? [{ start: '09:00', end: '17:00' }] : [])} aria-label={`${DAY_LABEL[d]} open`} />
                  {DAY_LABEL[d]}
                </label>
                {open ? (
                  <div className="flex-1 space-y-2">
                    {ranges.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input type="time" className="w-32" value={r.start} aria-label={`${DAY_LABEL[d]} opens`} onChange={(x) => setDay(d, ranges.map((y, j) => (j === i ? { ...y, start: x.target.value } : y)))} />
                        <span className="text-muted-foreground text-sm">to</span>
                        <Input type="time" className="w-32" value={r.end} aria-label={`${DAY_LABEL[d]} closes`} onChange={(x) => setDay(d, ranges.map((y, j) => (j === i ? { ...y, end: x.target.value } : y)))} />
                        {ranges.length > 1 && (
                          <Button variant="ghost" size="icon-sm" aria-label="Remove range" onClick={() => setDay(d, ranges.filter((_, j) => j !== i))}><X /></Button>
                        )}
                        {i === ranges.length - 1 && ranges.length < 4 && (
                          <Button variant="ghost" size="icon-sm" aria-label="Add range" onClick={() => setDay(d, [...ranges, { start: '13:00', end: '17:00' }])}><Plus /></Button>
                        )}
                      </div>
                    ))}
                    {Object.entries(e).filter(([k]) => k.startsWith(`weeklyHours.${d}`)).slice(0, 1).map(([k, m]) => <p key={k} className="text-destructive text-xs">{m}</p>)}
                  </div>
                ) : (
                  <span className="text-muted-foreground pt-1.5 text-sm">Closed</span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="Blackout dates" description="Public holidays and days off – no bookings on these dates.">
        <div className="flex gap-2">
          <Input type="date" value={blackout} min={today()} onChange={(x) => setBlackout(x.target.value)} className="max-w-48" aria-label="Blackout date" />
          <Button variant="outline" disabled={!blackout || v.blackoutDates.includes(blackout)} onClick={() => { set({ blackoutDates: [...v.blackoutDates, blackout].sort() }); setBlackout(''); }}>
            <Plus /> Add
          </Button>
        </div>
        {v.blackoutDates.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {v.blackoutDates.map((d) => (
              <li key={d} className="bg-muted inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs tabular-nums">
                {formatInTz(new Date(`${d}T12:00:00+08:00`), 'EEE d MMM yyyy', TZ)}
                <button type="button" aria-label={`Remove ${d}`} className="hover:bg-background rounded-full p-1" onClick={() => set({ blackoutDates: v.blackoutDates.filter((x) => x !== d) })}>
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">No blackout dates.</p>
        )}
      </Panel>
      <SaveBar dirty={s.dirty} saving={s.saving} onSave={() => void s.save()} onReset={s.reset} />
    </div>
  );
}

function DepositTab() {
  const s = useSettingsDoc('deposit', depositSettingsSchema as never);
  const [amount, setAmount] = useState<string | null>(null);
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.value) return <ListSkeleton rows={3} />;
  const v = s.value;
  const amountStr = amount ?? centsToInput(v.amountCents);
  return (
    <Panel title="Holding deposit" description="Charged in full through Stripe. Non-refundable. Card fees are absorbed – never surcharged.">
      <div className="grid gap-4">
        <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5 text-sm">
          <span>
            <span className="block font-medium">Take deposits online</span>
            <span className="text-muted-foreground text-xs">Shows “Reserve with deposit” on available cars.</span>
          </span>
          <Switch checked={v.enabled} onCheckedChange={(c) => s.setValue({ ...v, enabled: c })} />
        </label>
        <F label="Deposit amount" error={s.errors.amountCents} className="max-w-48">
          <MoneyInput value={amountStr} onChange={(x) => { setAmount(x.target.value); s.setValue({ ...v, amountCents: inputToCents(x.target.value) }); }} />
        </F>
        <F label="Deposit terms (shown on the reserve page and at checkout)" error={s.errors.termsText} hint={`Version ${v.termsVersion}. Changing the text creates a new version, stored with each deposit.`}>
          <Textarea rows={8} value={v.termsText} onChange={(x) => s.setValue({ ...v, termsText: x.target.value })} />
        </F>
        <SaveBar
          dirty={s.dirty}
          saving={s.saving}
          onReset={() => { s.reset(); setAmount(null); }}
          onSave={async () => {
            const original = (await getAdminRepo().getSettings('deposit')).termsText;
            const next = original !== v.termsText ? { ...v, termsVersion: `${today()}-${Date.now().toString(36).slice(-4)}` } : v;
            if (await s.save(next)) setAmount(null);
          }}
        />
      </div>
    </Panel>
  );
}

function FinanceTab() {
  const s = useSettingsDoc('finance', financeSettingsSchema as never);
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.value) return <ListSkeleton rows={2} />;
  const v = s.value;
  return (
    <Panel title="Finance calculator" description="Used by the calculator on the website and car pages.">
      <div className="grid gap-4">
        <F label="Indicative rate (% p.a.)" error={s.errors.indicativeRatePct} className="max-w-48">
          <Input type="number" step="0.01" inputMode="decimal" value={Number.isNaN(v.indicativeRatePct) ? '' : v.indicativeRatePct} onChange={(x) => s.setValue({ ...v, indicativeRatePct: num(x.target.value) })} />
        </F>
        <F label="Disclaimer (always shown next to estimates)" error={s.errors.disclaimer}>
          <Textarea rows={4} value={v.disclaimer} onChange={(x) => s.setValue({ ...v, disclaimer: x.target.value })} />
        </F>
        <SaveBar dirty={s.dirty} saving={s.saving} onSave={() => void s.save()} onReset={s.reset} />
      </div>
    </Panel>
  );
}

function LegalTab() {
  const s = useSettingsDoc('legal', legalSettingsSchema as never);
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.value) return <ListSkeleton rows={4} />;
  const v = s.value;
  const fields: [keyof typeof v, string, string][] = [
    ['privacyText', 'Privacy policy', '/privacy'],
    ['termsText', 'Website terms', '/terms'],
    ['depositTermsText', 'Deposit terms page', '/deposit-terms'],
    ['warrantyText', 'Warranty information', '/warranty'],
  ];
  return (
    <Panel title="Legal text" description="Plain text; blank lines start new paragraphs. Have these reviewed before launch.">
      <div className="grid gap-5">
        {fields.map(([k, label, path]) => (
          <F key={k} label={label} error={s.errors[k]} hint={<>Shown on <a href={path} target="_blank" rel="noreferrer" className="underline underline-offset-4">{path}</a></>}>
            <Textarea rows={6} value={v[k]} onChange={(x) => s.setValue({ ...v, [k]: x.target.value })} />
          </F>
        ))}
        <SaveBar dirty={s.dirty} saving={s.saving} onSave={() => void s.save()} onReset={s.reset} />
      </div>
    </Panel>
  );
}

const TABS = [
  ['business', 'Business', BusinessTab],
  ['booking', 'Booking rules', BookingTab],
  ['deposit', 'Deposit', DepositTab],
  ['finance', 'Finance', FinanceTab],
  ['legal', 'Legal text', LegalTab],
] as const;

function Settings() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab')! : 'business';
  return (
    <>
      <PageHeader title="Settings" description="Changes apply to the website straight away." />
      <Tabs value={tab} onValueChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })}>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
          <TabsList className="w-max">
            {TABS.map(([k, label]) => <TabsTrigger key={k} value={k}>{label}</TabsTrigger>)}
          </TabsList>
        </div>
        {TABS.map(([k, , C]) => (
          <TabsContent key={k} value={k} className="pt-3">
            <C />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

export function SettingsView() {
  return (
    <AdminOnly>
      <Settings />
    </AdminOnly>
  );
}
