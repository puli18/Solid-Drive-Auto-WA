/**
 * /admin/receipts/{storage path} – the link used in Excel exports and the expense list. It sits inside
 * the authenticated admin shell (so the viewer must be signed in as staff/admin), then swaps to a
 * short-lived file URL. Raw signed URLs are never embedded in files.
 *
 * URL source: demo session files (this browser only) or, in Firebase mode, a repository helper
 * `getFileUrl(path)` that Foundation still needs to add to lib/data (see docs/DECISIONS.md).
 */
import { FileQuestion, Loader2 } from 'lucide-react';
import Link from '@/components/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { actionErrorMessage, DEMO_MODE, getAdminRepo } from '@/lib/data';
import { sessionFileUrl } from '../upload';
import { EmptyState } from '../ui';

type FileUrlRepo = { getFileUrl?: (path: string) => Promise<string> };
const ALLOWED = /^(receipts|sales)\//;

export function ReceiptRedirect({ path }: { path: string }) {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ALLOWED.test(path) || path.includes('..')) {
      setProblem('This link doesn’t point to a receipt or sale document.');
      return;
    }
    const local = sessionFileUrl(path);
    if (local) {
      window.location.replace(local);
      return;
    }
    const repo = getAdminRepo() as unknown as FileUrlRepo;
    if (DEMO_MODE || typeof repo.getFileUrl !== 'function') {
      setProblem(
        DEMO_MODE
          ? 'In the preview, uploaded files are only kept until the page is reloaded, and sample expenses have no receipts.'
          : 'Opening stored files isn’t connected yet.',
      );
      return;
    }
    repo
      .getFileUrl(path)
      .then((url) => window.location.replace(url))
      .catch((e) => setProblem(actionErrorMessage(e)));
  }, [path]);

  if (!problem)
    return (
      <p className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
        <Loader2 className="size-4 animate-spin" /> Opening file…
      </p>
    );
  return (
    <EmptyState icon={FileQuestion} title="Can’t open this file" action={<Button asChild variant="outline"><Link href="/admin/cars">Back to cars</Link></Button>}>
      {problem}
      <span className="mt-2 block font-mono text-xs break-all">{path}</span>
    </EmptyState>
  );
}
