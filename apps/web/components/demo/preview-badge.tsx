/** Small fixed "Preview" badge shown on every page in demo mode (rendered by the root layout). */
import { DEMO_MODE } from '@/lib/data/mode';

export function PreviewBadge() {
  if (!DEMO_MODE) return null;
  return (
    <div
      role="status"
      className="bg-brand-black/90 text-brand-chrome-light pointer-events-none fixed bottom-3 left-3 z-[100] rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase shadow-lg backdrop-blur"
    >
      <span className="bg-brand-red mr-1.5 inline-block size-1.5 -translate-y-px rounded-full align-middle" />
      Preview
    </div>
  );
}
