/** Small shared building blocks for admin pages. */
import { AlertTriangle, Lock, type LucideIcon } from 'lucide-react';
import Link from '@/components/link';
import type { ReactNode } from 'react';
import type { CarStatus } from '@sda/shared';
import { CAR_STATUS_LABELS } from '@sda/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage } from '@/lib/data';
import { cn } from '@/lib/utils';
import { STATUS_TONE } from './format';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="text-muted-foreground hover:text-foreground mb-1 inline-block text-xs font-medium">
            ← {back.label}
          </Link>
        )}
        <h1 className="page-title text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CarStatusBadge({ status, className }: { status: CarStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', STATUS_TONE[status], className)}>
      {CAR_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ToneBadge({ tone, children }: { tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'strong'; children: ReactNode }) {
  const cls = {
    neutral: 'bg-muted text-muted-foreground border-transparent',
    success: 'bg-success/12 text-success border-success/25',
    warning: 'bg-warning/12 text-warning border-warning/25',
    danger: 'bg-destructive/10 text-destructive border-destructive/30',
    info: 'bg-foreground/5 text-foreground border-border',
    strong: 'bg-foreground text-background border-transparent',
  }[tone];
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', cls)}>
      {children}
    </Badge>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
      <Icon className="text-muted-foreground mb-3 size-8" strokeWidth={1.5} />
      <p className="font-medium">{title}</p>
      {children && <div className="text-muted-foreground mt-1 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="border-destructive/30 bg-destructive/5 flex flex-col items-start gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center">
      <AlertTriangle className="text-destructive size-5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Couldn&apos;t load this data</p>
        <p className="text-muted-foreground">{actionErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/**
 * Route guard for admin-only pages. Staff get an explanation instead of the page, and the children
 * (which fetch admin-only data) are never mounted for them.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <ListSkeleton />;
  if (role !== 'admin')
    return (
      <EmptyState icon={Lock} title="Admins only" action={<Button asChild variant="outline"><Link href="/admin">Back to overview</Link></Button>}>
        This area is restricted to admin accounts. Ask an admin if you need something from here.
      </EmptyState>
    );
  return <>{children}</>;
}

/** Dollar input – the user types dollars; the form field holds a dollars string (convert with inputToCents). */
export function MoneyInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className={cn('relative', className)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">$</span>
      <Input inputMode="decimal" autoComplete="off" className="pl-6 tabular-nums" {...props} />
    </div>
  );
}

/** Label/value line used in summaries. */
export function Stat({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5 text-sm', className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-right font-medium">{value}</dd>
    </div>
  );
}

/** Bordered section with a compact header (the admin's main grouping surface – not nested). */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('bg-card rounded-xl border', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="font-sans text-sm font-semibold">{title}</h2>}
            {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
