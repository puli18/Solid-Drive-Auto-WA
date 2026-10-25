/** /admin/users (admin) – invite, set role, deactivate. All via callables (setUserRole / inviteUser / deactivateUser). */
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Loader2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { inviteUserInput, type Role } from '@sda/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, runAction, type UserRecord } from '@/lib/data';
import { useConfirm } from '../confirm';
import { dateAU, initials } from '../format';
import { SelectField, TextField } from '../fields';
import { FormSheet } from '../form-sheet';
import { useRepo } from '../use-data';
import { AdminOnly, EmptyState, ErrorState, ListSkeleton, PageHeader, ToneBadge } from '../ui';

const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff – cars, bookings, enquiries, sales' },
  { value: 'admin', label: 'Admin – everything incl. financials & settings' },
];

function InviteSheet({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  type I = z.input<typeof inviteUserInput>;
  const form = useForm<I, unknown, z.output<typeof inviteUserInput>>({ resolver: zodResolver(inviteUserInput), mode: 'onTouched' });
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      form.reset({ name: '', email: '', role: 'staff' });
      setLink(null);
    }
  }, [open, form]);

  async function submit(v: z.output<typeof inviteUserInput>) {
    try {
      const res = await runAction('inviteUser', v);
      toast.success(`Invite sent to ${v.email}`);
      onDone();
      if (res.resetLink) setLink(res.resetLink);
      else onOpenChange(false);
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a user"
      description="They get an email with a link to set their password. Admins must set up two-step verification on first sign-in."
      footer={
        link ? (
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="invite-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Send invite
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-3 text-sm">
          <p>Email isn’t configured yet, so share this password-setup link with them directly:</p>
          <div className="bg-muted flex items-center gap-2 rounded-md p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
            <Button size="icon-sm" variant="ghost" aria-label="Copy link" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success('Copied'))}>
              <Copy />
            </Button>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form id="invite-form" onSubmit={form.handleSubmit(submit)} className="grid gap-4" noValidate>
            <TextField control={form.control} name="name" label="Name" required autoComplete="off" />
            <TextField control={form.control} name="email" label="Email" type="email" required autoComplete="off" />
            <SelectField control={form.control} name="role" label="Role" required options={ROLE_OPTIONS} />
          </form>
        </Form>
      )}
    </FormSheet>
  );
}

function UsersList() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, error, loading, reload } = useRepo((r) => r.listUsers(), []);

  async function setRole(u: UserRecord, role: Role) {
    if (role === 'admin' && !(await confirm({ title: `Make ${u.name} an admin?`, description: 'Admins can see purchase prices, profit, deposits, exports, users and settings.', confirmLabel: 'Make admin' }))) return;
    setBusy(u.id);
    try {
      await runAction('setUserRole', { uid: u.id, role });
      toast.success(`${u.name} is now ${role}`);
      void reload();
    } catch (e) {
      toast.error(actionErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function deactivate(u: UserRecord) {
    if (!(await confirm({ title: `Deactivate ${u.name}?`, description: 'They are signed out within the hour and can’t sign in again until re-invited.', confirmLabel: 'Deactivate', destructive: true }))) return;
    setBusy(u.id);
    try {
      await runAction('deactivateUser', { uid: u.id });
      toast.success(`${u.name} deactivated`);
      void reload();
    } catch (e) {
      toast.error(actionErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const rows = [...(data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Users" description="Dealership staff who can sign in to this dashboard" actions={<Button onClick={() => setInviting(true)}><UserPlus /> Invite user</Button>} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No users" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {rows.map((u) => {
            const self = u.id === user?.uid;
            return (
              <li key={u.id} className="bg-card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs font-semibold">{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{u.name}</span>
                      {self && <span className="text-muted-foreground text-xs font-normal">(you)</span>}
                      {!u.active && <ToneBadge tone="neutral">Deactivated</ToneBadge>}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {u.email} · {u.invitedAt ? `Invited ${dateAU(u.invitedAt)}` : `Added ${dateAU(u.createdAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={u.role} onValueChange={(v) => void setRole(u, v as Role)} disabled={self || !u.active || busy === u.id}>
                    <SelectTrigger className="w-32" aria-label={`Role for ${u.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {u.active && !self && (
                    <Button variant="ghost" className="text-destructive" onClick={() => void deactivate(u)} disabled={busy === u.id}>
                      {busy === u.id ? <Loader2 className="animate-spin" /> : null}
                      Deactivate
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <InviteSheet open={inviting} onOpenChange={setInviting} onDone={reload} />
    </>
  );
}

export function UsersView() {
  return (
    <AdminOnly>
      <UsersList />
    </AdminOnly>
  );
}
