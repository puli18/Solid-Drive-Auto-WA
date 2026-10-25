/**
 * Browser-side upload helpers.
 *  - Car photos: Cloudflare Images direct creator upload (getImageUploadUrl → POST multipart with progress).
 *    Demo mode: the photo is downscaled in the browser to a small JPEG data: URL so it survives reloads
 *    in the localStorage overlay (uploads throw DemoUnsupportedError there).
 *  - Private files (receipts, sale documents): demo mode keeps an object URL for this session only;
 *    Firebase mode needs a Storage upload helper from lib/data (see docs/DECISIONS.md).
 */
import { DEMO_MODE, runAction } from '@/lib/data';

export type Progress = (fraction: number) => void;

function xhrUpload(url: string, file: File, onProgress: Progress): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', file);
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed – check your connection'));
    xhr.send(body);
  });
}

async function downscaleToDataUrl(file: File, maxSide = 720, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`${file.name} isn't an image we can read`);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upload one car photo; resolves to the image id to store on the car. */
export async function uploadCarPhoto(carId: string, file: File, onProgress: Progress): Promise<string> {
  if (DEMO_MODE) {
    onProgress(0.15);
    const url = await downscaleToDataUrl(file);
    for (const p of [0.45, 0.7, 0.9]) {
      await tick(120);
      onProgress(p);
    }
    onProgress(1);
    return url;
  }
  const { imageId, uploadURL } = await runAction('getImageUploadUrl', { carId });
  await xhrUpload(uploadURL, file, onProgress);
  onProgress(1);
  return imageId;
}

const sessionFiles = new Map<string, string>();

/**
 * Store a private file (receipt / sale document) and return its Storage path.
 * Demo: kept as an object URL for this browser session. Firebase: not wired yet (throws).
 */
export async function uploadPrivateFile(path: string, file: File): Promise<string> {
  if (DEMO_MODE) {
    sessionFiles.set(path, URL.createObjectURL(file));
    await tick(300);
    return path;
  }
  throw new Error('File upload to Storage is not wired yet (needs a lib/data helper).');
}

/** A viewable URL for a stored private file, or null when it isn't available in this session. */
export function sessionFileUrl(path: string): string | null {
  return sessionFiles.get(path) ?? null;
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(-80);
}
