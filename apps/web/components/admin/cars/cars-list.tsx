import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, CarFront, Globe, Plus, Search } from 'lucide-react';
import Link from '@/components/link';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import { useMemo, useState } from 'react';
import { CAR_STATUS_LABELS, CAR_STATUSES, type CarStatus, carTitle, daysBetween } from '@sda/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CarRecord } from '@/lib/data';
import { cn } from '@/lib/utils';
import { money, relativeDays } from '../format';
import { useRepo } from '../use-data';
import { CarStatusBadge, EmptyState, ErrorState, ListSkeleton, PageHeader } from '../ui';
import { CarActionsMenu } from './car-actions';
import { CarThumb } from './car-thumb';

type Row = CarRecord & { days: number; title: string };
const IN_STOCK: CarStatus[] = ['draft', 'available', 'reserved'];

export function CarsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (params.get('status') ?? 'all') as CarStatus | 'all' | 'stock';
  const aged = params.get('aged') === '1';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, error, loading, reload } = useRepo(async (r) => {
    const [cars, app] = await Promise.all([r.listCars(), r.getSettings('app')]);
    return { cars, agedDays: app.agedStockDays };
  }, []);

  const setParam = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v == null) sp.delete(k);
    else sp.set(k, v);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`, { scroll: false });
  };

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.cars
      .map((c) => ({ ...c, days: daysBetween(c.createdAt, new Date()), title: carTitle(c) }))
      .filter((c) => (status === 'all' ? true : status === 'stock' ? IN_STOCK.includes(c.status) : c.status === status))
      .filter((c) => !aged || (IN_STOCK.includes(c.status) && c.days > data.agedDays))
      .filter(
        (c) =>
          !needle ||
          [c.searchText, c.stockNo, c.rego, c.vin, c.title, c.colour].filter(Boolean).join(' ').toLowerCase().includes(needle),
      );
  }, [data, q, status, aged]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data?.cars ?? []) m.set(c.status, (m.get(c.status) ?? 0) + 1);
    return m;
  }, [data]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'car',
        header: 'Car',
        accessorFn: (r) => r.title,
        cell: ({ row: { original: c } }) => (
          <Link href={`/admin/cars/${c.id}`} className="flex items-center gap-3 outline-none">
            <CarThumb images={c.images} className="w-14" />
            <span className="min-w-0">
              <span className="block truncate font-medium group-hover:underline">{c.title}</span>
              <span className="text-muted-foreground block font-mono text-xs">
                {c.stockNo}
                {c.rego ? ` · ${c.rego}` : ''}
              </span>
            </span>
          </Link>
        ),
      },
      { id: 'price', header: 'Price', accessorKey: 'priceCents', cell: ({ getValue }) => <span className="tabular-nums">{money(getValue<number>())}</span> },
      { id: 'km', header: 'Km', accessorKey: 'km', cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<number>().toLocaleString('en-AU')}</span> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <CarStatusBadge status={getValue<CarStatus>()} /> },
      {
        id: 'published',
        header: 'Web',
        accessorKey: 'published',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className="text-success inline-flex items-center gap-1 text-xs"><Globe className="size-3.5" /> Live</span>
          ) : (
            <span className="text-muted-foreground text-xs">Hidden</span>
          ),
      },
      {
        id: 'days',
        header: 'In stock',
        accessorKey: 'days',
        cell: ({ row: { original: c } }) => (
          <span className={cn('tabular-nums', data && IN_STOCK.includes(c.status) && c.days > data.agedDays && 'text-primary font-medium')}>{c.days} d</span>
        ),
      },
      { id: 'updated', header: 'Updated', accessorFn: (r) => r.updatedAt?.getTime() ?? 0, cell: ({ row: { original: c } }) => <span className="text-muted-foreground text-xs">{relativeDays(c.updatedAt)}</span> },
      { id: 'actions', header: '', enableSorting: false, cell: ({ row: { original: c } }) => <CarActionsMenu car={c} /> },
    ],
    [data],
  );

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const sorted = table.getRowModel().rows.map((r) => r.original);

  const filters: { value: string; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: data?.cars.length },
    ...CAR_STATUSES.map((s) => ({ value: s, label: CAR_STATUS_LABELS[s], count: counts.get(s) ?? 0 })),
  ];

  return (
    <>
      <PageHeader
        title="Cars"
        description={data ? `${data.cars.length} cars · ${IN_STOCK.reduce((n, s) => n + (counts.get(s) ?? 0), 0)} in stock` : undefined}
        actions={
          <Button asChild>
            <Link href="/admin/cars/new">
              <Plus /> Add car
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search make, model, stock no, rego or VIN"
            className="pl-9"
            aria-label="Search cars"
          />
        </div>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex w-max gap-1.5" role="tablist" aria-label="Filter by status">
            {filters.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={status === f.value}
                onClick={() => setParam('status', f.value === 'all' ? null : f.value)}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
                  status === f.value ? 'bg-foreground text-background border-foreground' : 'hover:bg-accent text-muted-foreground',
                )}
              >
                {f.label}
                {f.count != null && <span className="ml-1.5 tabular-nums opacity-60">{f.count}</span>}
              </button>
            ))}
            {aged && (
              <button onClick={() => setParam('aged', null)} className="border-primary text-primary h-8 rounded-full border px-3 text-xs font-medium">
                Aged only ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title={q || status !== 'all' || aged ? 'No cars match' : 'No cars yet'}
          action={
            q || status !== 'all' || aged ? (
              <Button variant="outline" onClick={() => { setQ(''); router.replace(pathname); }}>Clear filters</Button>
            ) : (
              <Button asChild><Link href="/admin/cars/new"><Plus /> Add your first car</Link></Button>
            )
          }
        >
          {q ? `Nothing found for “${q}”.` : 'Try another status filter.'}
        </EmptyState>
      ) : (
        <>
          {/* Phone: card list */}
          <ul className="divide-y overflow-hidden rounded-xl border md:hidden">
            {sorted.map((c) => (
              <li key={c.id} className="bg-card flex items-center gap-3 px-3 py-3">
                <Link href={`/admin/cars/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <CarThumb images={c.images} className="w-20" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="text-muted-foreground block font-mono text-xs">{c.stockNo}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <CarStatusBadge status={c.status} />
                      <span className="text-sm font-semibold tabular-nums">{money(c.priceCents)}</span>
                    </span>
                  </span>
                </Link>
                <CarActionsMenu car={c} />
              </li>
            ))}
          </ul>

          {/* Tablet/desktop: sortable table */}
          <div className="bg-card hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => {
                      const dir = h.column.getIsSorted();
                      return (
                        <TableHead key={h.id} className={cn('text-xs', h.id === 'actions' && 'w-10')} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                          {h.column.getCanSort() ? (
                            <button className="hover:text-foreground inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {dir === 'asc' ? <ArrowUp className="size-3" /> : dir === 'desc' ? <ArrowDown className="size-3" /> : null}
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="group">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
