import { Img } from '@/components/img';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Car photo gallery: swipe (Embla), arrow keys, thumbnails, and a full-screen zoom view
 * (tap/click to zoom 2x at the pointer, move to pan; native pinch-zoom on touch).
 */
export function CarGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: images.length > 1, duration: 22 });
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const many = images.length > 1;

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    onSelect();
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla]);

  const go = useCallback((i: number) => embla?.scrollTo(i), [embla]);

  return (
    <div>
      <div
        className="bg-brand-stone relative overflow-hidden rounded-xl"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') embla?.scrollPrev();
          if (e.key === 'ArrowRight') embla?.scrollNext();
        }}
      >
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div
                key={img.src + i}
                className="relative aspect-[4/3] min-w-0 shrink-0 grow-0 basis-full"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${images.length}`}
              >
                <Img
                  src={img.src}
                  alt={img.alt}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="sda-press absolute top-3 right-3 inline-flex h-10 items-center gap-2 rounded-full bg-black/70 px-4 text-sm font-medium text-white backdrop-blur hover:bg-black/85"
        >
          <Expand className="size-4" aria-hidden />
          Zoom
        </button>

        {many ? (
          <>
            <NavButton side="left" onClick={() => embla?.scrollPrev()} />
            <NavButton side="right" onClick={() => embla?.scrollNext()} />
            <p className="sda-num absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              {index + 1} / {images.length}
            </p>
          </>
        ) : null}
      </div>

      {many ? (
        <div className="sda-rail mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
              className={cn(
                'bg-brand-stone relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition-[box-shadow,opacity] outline-none focus-visible:ring-[var(--ring)]',
                i === index ? 'ring-brand-red' : 'opacity-70 ring-transparent hover:opacity-100',
              )}
            >
              <Img src={img.src} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="h-[100svh] max-h-none w-screen max-w-none rounded-none border-0 bg-black p-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{title} – photo {index + 1}</DialogTitle>
          <DialogDescription className="sr-only">Tap the photo to zoom in. Use the arrow buttons to change photo.</DialogDescription>
          <ZoomImage key={index} image={images[index]!} />
          <DialogClose className="sda-press absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
          {many ? (
            <>
              <NavButton side="left" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} />
              <NavButton side="right" onClick={() => setIndex((i) => (i + 1) % images.length)} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ZoomImage({ image }: { image: GalleryImage }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const point = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`;
  };
  return (
    <button
      type="button"
      aria-label={zoom ? 'Zoom out' : 'Zoom in'}
      onClick={() => setZoom((z) => !z)}
      onPointerDown={(e) => setOrigin(point(e))}
      onPointerMove={(e) => zoom && e.pointerType === 'mouse' && setOrigin(point(e))}
      className={cn('relative size-full overflow-hidden', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
      style={{ touchAction: 'pinch-zoom' }}
    >
      <Img
        src={image.src}
        alt={image.alt}
        fill
        sizes="100vw"
        className="object-contain transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: zoom ? 'scale(2)' : 'scale(1)', transformOrigin: origin }}
      />
    </button>
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={cn(
        'sda-press absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-sm hover:bg-white',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
