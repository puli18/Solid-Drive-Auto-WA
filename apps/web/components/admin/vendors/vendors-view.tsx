/** /admin/vendors – vendor list with add / edit (shared vendorInputSchema). */
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Phone, Plus, Search, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { vendorInputSchema } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, getAdminRepo, type VendorRecord } from '@/lib/data';
import { money } from '../format';
import { TextField } from '../fields';
import { FormSheet } from '../form-sheet';
import { useRepo } from '../use-data';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../ui';

type Input_ = z.input<typeof vendorInputSchema>;

function VendorSheet({ open, vendor, onOpenChange, onSaved }: { open: boolean; vendor: VendorRecord | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { user } = useAuth();
  const form = useForm<Input_, unknown, z.output<typeof vendorInputSchema>>({ resolver: zodResolver(vendorInputSchema), mode: 'onTouched' });
  useEffect(() => {
    if (open) form.reset({ name: vendor?.name ?? '', phone: vendor?.phone ?? '', email: vendor?.email ?? '', abn: vendor?.abn ?? '' });
  }, [open, vendor, form]);

  async function submit(v: z.output<typeof vendorInputSchema>) {
    try {
      if (vendor) await getAdminRepo().updateVendor(vendor.id, v, user!.uid);
      else await getAdminRepo().createVendor(v, user!.uid);
      toast.success(vendor ? 'Vendor updated' : `${v.name} added`);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={vendor ? 'Edit vendor' : 'Add vendor'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="vendor-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id="vendor-form" onSubmit={form.handleSubmit(submit)} className="grid gap-4" noValidate>
          <TextField control={form.control} name="name" label="Business name" required />
          <TextField control={form.control} name="phone" label="Phone" type="tel" />
          <TextField control={form.control} name="email" label="Email" type="email" />
          <TextField control={form.control} name="abn" label="ABN" inputMode="numeric" description="11 digits – leave blank if not registered for GST" />
        </form>
      </Form>
    </FormSheet>
  );
}

export function VendorsView() {
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<{ open: boolean; vendor: VendorRecord | null }>({ open: false, vendor: null });
  const { data, error, loading, reload } = useRepo(async (r) => {
    const [vendors, expenses] = await Promise.all([r.listVendors(), r.listExpenses()]);
    const spend = new Map<string, { n: number; total: number }>();
    for (const e of expenses) if (e.vendorId) { const s = spend.get(e.vendorId) ?? { n: 0, total: 0 }; spend.set(e.vendorId, { n: s.n + 1, total: s.total + e.totalCents }); }
    return { vendors, spend };
  }, []);
  const rows = useMemo(() => (data?.vendors ?? []).filter((v) => !q || `${v.name} ${v.email} ${v.phone}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <>
      <PageHeader title="Vendors" description="Mechanics, detailers, auctions and other suppliers" actions={<Button onClick={() => setSheet({ open: true, vendor: null })}><Plus /> Add vendor</Button>} />
      <div className="relative mb-4">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors" className="pl-9" aria-label="Search vendors" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={Store} title={q ? 'No vendors match' : 'No vendors yet'}>Vendors can also be added straight from the expense form.</EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => {
            const s = data.spend.get(v.id);
            return (
              <li key={v.id}>
                <button type="button" onClick={() => setSheet({ open: true, vendor: v })} className="bg-card hover:bg-accent/40 h-full w-full rounded-xl border p-4 text-left transition-colors">
                  <p className="font-medium">{v.name}</p>
                  <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                    {v.phone && <p className="flex items-center gap-1.5"><Phone className="size-3" /> {v.phone}</p>}
                    {v.email && <p className="flex items-center gap-1.5 truncate"><Mail className="size-3" /> {v.email}</p>}
                    {v.abn && <p>ABN {v.abn}</p>}
                  </div>
                  <p className="text-muted-foreground mt-3 border-t pt-2 text-xs tabular-nums">
                    {s ? `${s.n} expense${s.n === 1 ? '' : 's'} · ${money(s.total)}` : 'No expenses yet'}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <VendorSheet open={sheet.open} vendor={sheet.vendor} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} onSaved={reload} />
    </>
  );
}
