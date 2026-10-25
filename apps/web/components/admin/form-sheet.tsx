/**
 * Responsive sheet for admin forms: bottom sheet on phones (thumb reach), right panel on larger screens.
 * Header + scrollable body + sticky footer for actions.
 */
import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const mobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? 'bottom' : 'right'}
        className={cn(
          'sda-admin gap-0 p-0 data-[state=closed]:duration-200 data-[state=open]:duration-300',
          mobile ? 'max-h-[92dvh] rounded-t-2xl' : cn('w-full', wide ? 'sm:max-w-xl' : 'sm:max-w-md'),
        )}
      >
        {mobile && <div className="bg-muted-foreground/30 mx-auto mt-2 h-1 w-10 rounded-full" aria-hidden />}
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-sans text-base">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <SheetFooter className="pb-safe flex-row justify-end gap-2 border-t px-5 py-3">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
