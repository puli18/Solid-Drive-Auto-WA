import { cn } from '@/lib/utils';

/** SDA WA mark (chrome lettering – use on dark surfaces only). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('relative block h-9 w-14 overflow-hidden', className)} aria-hidden>
      <img src="/brand/logo-mark-transparent.png" alt="" className="absolute inset-0 size-full scale-[1.35] object-cover" />
    </span>
  );
}
