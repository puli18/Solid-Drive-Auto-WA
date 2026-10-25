/**
 * Photos tab: add from camera or gallery (multi-select), upload with per-photo progress, drag to reorder
 * (pointer-based so it works with touch – drag by the handle), set cover, delete. Max 30 photos.
 */
import { Camera, GripVertical, ImagePlus, Loader2, MoreVertical, Star, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { availabilityProblems, type CarImage, isLocalImageId, MAX_CAR_PHOTOS, sortCarImages } from '@sda/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, type CarRecord, getAdminRepo, runAction } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useConfirm } from '../confirm';
import { uploadCarPhoto } from '../upload';
import { adminImageSrc } from './car-image';

interface Pending {
  key: string;
  name: string;
  preview: string;
  progress: number;
  error?: string;
}

const normalise = (imgs: CarImage[]): CarImage[] => imgs.map((img, i) => ({ ...img, order: i, isCover: i === 0 }));

export function CarPhotos({ car, onSaved }: { car: CarRecord; onSaved: () => void }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [images, setImages] = useState<CarImage[]>(() => normalise(sortCarImages(car.images ?? [])));
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const saveChain = useRef(Promise.resolve());
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Pick up external changes (e.g. demo reset) when not mid-edit.
  useEffect(() => {
    if (dragIndex === null && pending.length === 0) setImages(normalise(sortCarImages(car.images ?? [])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.images]);

  function persist(next: CarImage[], quiet = true) {
    const normalised = normalise(next);
    setImages(normalised);
    saveChain.current = saveChain.current.then(async () => {
      try {
        await getAdminRepo().updateCar(car.id, { images: normalised }, user!.uid);
        if (!quiet) toast.success('Photos saved');
        onSaved();
      } catch (e) {
        toast.error(actionErrorMessage(e));
      }
    });
    return saveChain.current;
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length || !user) return;
    const room = MAX_CAR_PHOTOS - imagesRef.current.length - pending.filter((p) => !p.error).length;
    const files = [...list].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (files.length < list.length) toast.warning('Some files were skipped – only images can be added.');
    if (room <= 0) return toast.error(`This car already has ${MAX_CAR_PHOTOS} photos (the maximum).`);
    if (files.length > room) toast.warning(`Only the first ${room} photo${room === 1 ? '' : 's'} will be added (max ${MAX_CAR_PHOTOS}).`);
    const batch = files.slice(0, room).map((f) => ({ file: f, item: { key: `${Date.now()}-${Math.random()}`, name: f.name, preview: URL.createObjectURL(f), progress: 0 } }));
    setPending((p) => [...p, ...batch.map((b) => b.item)]);

    const update = (key: string, patch: Partial<Pending>) => setPending((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    const queue = [...batch];
    let added = 0;
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const id = await uploadCarPhoto(car.id, job.file, (f) => update(job!.item.key, { progress: f }));
          await persist([...imagesRef.current, { id, order: imagesRef.current.length, isCover: false, alt: '' }]);
          added++;
          setPending((p) => p.filter((x) => x.key !== job!.item.key));
          URL.revokeObjectURL(job.item.preview);
        } catch (e) {
          update(job.item.key, { error: actionErrorMessage(e) });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (added) toast.success(`${added} photo${added === 1 ? '' : 's'} added`);
  }

  async function remove(img: CarImage) {
    if (!(await confirm({ title: 'Delete this photo?', description: 'It is removed from the listing straight away.', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      const next = imagesRef.current.filter((i) => i.id !== img.id);
      if (getAdminRepo().mode === 'firebase' && !isLocalImageId(img.id)) {
        await runAction('deleteCarImage', { carId: car.id, imageId: img.id });
        setImages(normalise(next));
        await persist(next);
      } else await persist(next);
      toast.success('Photo deleted');
    } catch (e) {
      toast.error(actionErrorMessage(e));
    }
  }

  const move = (from: number, to: number) => {
    const next = [...imagesRef.current];
    const [it] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, it!);
    return next;
  };

  // Pointer drag (works for mouse + touch via the handle, which has touch-action: none).
  function onHandleDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(index);
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragIndex === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-photo-index]');
    const over = el ? Number(el.dataset.photoIndex) : null;
    if (over !== null && over !== dragIndex) {
      setImages(normalise(move(dragIndex, over)));
      setDragIndex(over);
    }
  }
  function onHandleUp() {
    if (dragIndex === null) return;
    setDragIndex(null);
    void persist(imagesRef.current);
  }

  const total = images.length + pending.filter((p) => !p.error).length;
  const problems = car.status === 'draft' ? availabilityProblems({ ...car, images }) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">
            {images.length} of {MAX_CAR_PHOTOS} photos
          </p>
          <p className="text-muted-foreground text-xs">The first photo is the cover. Drag the handle to reorder.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()} disabled={total >= MAX_CAR_PHOTOS}>
            <Camera /> Take photo
          </Button>
          <Button type="button" onClick={() => galleryRef.current?.click()} disabled={total >= MAX_CAR_PHOTOS}>
            <ImagePlus /> Add photos
          </Button>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {problems.length > 0 && (
        <p className="text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" />
          Before this car can go live: {problems.join(', ').toLowerCase()}.
        </p>
      )}

      {images.length === 0 && pending.length === 0 ? (
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="hover:bg-accent/50 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-14 text-center transition-colors"
        >
          <ImagePlus className="text-muted-foreground size-8" strokeWidth={1.5} />
          <span className="font-medium">Add photos</span>
          <span className="text-muted-foreground text-xs">Choose several at once from your camera roll</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Photos">
          {images.map((img, i) => (
            <li
              key={img.id}
              data-photo-index={i}
              className={cn(
                'group bg-muted relative aspect-[4/3] overflow-hidden rounded-lg transition-[transform,opacity] duration-150',
                dragIndex === i && 'ring-primary z-10 scale-[1.03] opacity-80 shadow-lg ring-2',
              )}
            >
              <img src={adminImageSrc(img.id, 'thumb')} alt={img.alt || `Photo ${i + 1}`} className="pointer-events-none size-full object-cover select-none" draggable={false} />
              {i === 0 && (
                <span className="bg-brand-black/80 absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white">
                  <Star className="size-3 fill-current" /> Cover
                </span>
              )}
              <button
                type="button"
                aria-label={`Drag to reorder photo ${i + 1}`}
                onPointerDown={(e) => onHandleDown(e, i)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                className="bg-brand-black/60 absolute top-1.5 left-1.5 grid size-9 cursor-grab touch-none place-items-center rounded-md text-white active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`Options for photo ${i + 1}`} className="bg-brand-black/60 absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-md text-white">
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={i === 0} onSelect={() => void persist(move(i, 0), false)}>
                    <Star /> Set as cover
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i === 0} onSelect={() => void persist(move(i, i - 1))}>
                    Move earlier
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i === images.length - 1} onSelect={() => void persist(move(i, i + 1))}>
                    Move later
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => void remove(img)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
              <img src={p.preview} alt="" className="size-full object-cover opacity-50" />
              <div className="absolute inset-x-2 bottom-2 space-y-1">
                {p.error ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-background/90 px-2 py-1 text-[11px]">
                    <span className="text-destructive truncate">{p.error}</span>
                    <button type="button" className="underline" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-[11px] font-medium">
                      <Loader2 className="size-3 animate-spin" /> {Math.round(p.progress * 100)}%
                    </span>
                    <Progress value={p.progress * 100} className="h-1.5" />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
