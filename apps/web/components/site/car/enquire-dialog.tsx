import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { EnquiryForm } from '../forms/enquiry-form';

/** "Enquire" button + dialog with the enquiry form for one car (always available, whatever the status). */
export function EnquireDialog({
  carId,
  carTitle,
  label = 'Enquire',
  defaultMessage,
  className,
}: {
  carId: string;
  carTitle: string;
  label?: string;
  defaultMessage?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'sda-press inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold ring-1 ring-current/25 hover:ring-current/60',
            className,
          )}
        >
          <MessageSquare className="size-4" aria-hidden />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="font-display text-2xl font-extrabold" style={{ fontStretch: '108%' }}>
          Enquire about this car
        </DialogTitle>
        <DialogDescription>{carTitle}</DialogDescription>
        <EnquiryForm
          carId={carId}
          carTitle={carTitle}
          compact
          defaultMessage={defaultMessage ?? `Hi, I’m interested in the ${carTitle}. Is it still available?`}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
