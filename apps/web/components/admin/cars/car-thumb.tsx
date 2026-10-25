import { CarFront } from 'lucide-react';
import type { CarImage } from '@sda/shared';
import { cn } from '@/lib/utils';
import { coverSrc } from './car-image';

export function CarThumb({ images, className, alt = '' }: { images?: readonly CarImage[]; className?: string; alt?: string }) {
  const src = coverSrc(images);
  return (
    <span className={cn('bg-muted relative block aspect-[4/3] shrink-0 overflow-hidden rounded-md', className)}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <CarFront className="text-muted-foreground/60 absolute inset-0 m-auto size-5" strokeWidth={1.5} />
      )}
    </span>
  );
}
