/** Activity tab: audit log entries for this car (admin – auditLog is admin-read). */
import { History } from 'lucide-react';
import { CAR_STATUS_LABELS, type CarStatus } from '@sda/shared';
import { dateTimeAU, money, relativeDays } from '../format';
import { useRepo } from '../use-data';
import { EmptyState, ErrorState, ListSkeleton } from '../ui';

const ACTION_LABEL: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  restore: 'restored',
  'status-change': 'changed status',
  publish: 'published',
  unpublish: 'unpublished',
  export: 'exported',
  'deposit-paid': 'deposit paid',
  'deposit-conflict': 'deposit conflict',
  'booking-created': 'booking created',
  'booking-cancelled': 'booking cancelled',
};

function describe(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!after) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(after)) {
    const b = before?.[k];
    if (b === v) continue;
    const fmt = (x: unknown) =>
      k === 'status' ? CAR_STATUS_LABELS[x as CarStatus] ?? String(x) : k.endsWith('Cents') && typeof x === 'number' ? money(x) : x == null ? '–' : String(x);
    const label = k.replace(/Cents$/, '').replace(/([A-Z])/g, ' $1').toLowerCase();
    out.push(before && k in before ? `${label}: ${fmt(b)} → ${fmt(v)}` : `${label}: ${fmt(v)}`);
  }
  return out;
}

export function CarActivity({ carId }: { carId: string }) {
  const { data, error, loading, reload } = useRepo(
    async (r) => {
      const [log, users] = await Promise.all([r.listAuditLog({ carId, limit: 200 }), r.listUsers().catch(() => [])]);
      return { log, names: new Map(users.map((u) => [u.id, u.name])) };
    },
    [carId],
  );
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <ListSkeleton rows={4} />;
  if (!data.log.length) return <EmptyState icon={History} title="No activity yet">Changes to this car, its expenses and its sale are listed here.</EmptyState>;

  return (
    <ol className="relative space-y-0 border-l pl-5">
      {data.log.map((a) => {
        const who = data.names.get(a.actorUid) ?? (a.actorUid === 'system' ? 'System' : a.actorUid === 'seed' ? 'Import' : a.actorUid);
        const lines = describe(a.before as Record<string, unknown> | null, a.after as Record<string, unknown> | null);
        return (
          <li key={a.id} className="relative pb-5 last:pb-0">
            <span className="bg-background border-foreground/40 absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">{who}</span> {ACTION_LABEL[a.action] ?? a.action} <span className="text-muted-foreground">{a.entity === 'car' ? 'the car' : a.entity}</span>
            </p>
            {lines.length > 0 && (
              <ul className="text-muted-foreground mt-0.5 text-xs">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <time className="text-muted-foreground text-xs" title={dateTimeAU(a.at)}>
              {relativeDays(a.at)} · {dateTimeAU(a.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
