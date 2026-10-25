/**
 * Admin banner for demo mode: "Demo mode – changes are only saved in this browser" + Reset button.
 * Place it at the top of the admin shell: <DemoBanner />. Renders nothing outside demo mode.
 */
import { useEffect, useState } from 'react';
import { DEMO_MODE, hasDemoChanges, onDemoDataChange, resetDemoData } from '@/lib/data';

export function DemoBanner({ className = '' }: { className?: string }) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!DEMO_MODE) return;
    setDirty(hasDemoChanges());
    return onDemoDataChange(() => setDirty(hasDemoChanges()));
  }, []);
  if (!DEMO_MODE) return null;
  return (
    <div className={`bg-brand-black text-brand-chrome-light flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs ${className}`}>
      <span>
        <strong className="text-brand-red">Demo mode</strong> – changes are only saved in this browser.
      </span>
      <button
        type="button"
        disabled={!dirty}
        onClick={() => {
          if (window.confirm('Discard all changes made in this browser and restore the sample data?')) resetDemoData();
        }}
        className="rounded-full border border-white/25 px-2.5 py-0.5 font-medium hover:bg-white/10 disabled:opacity-40"
      >
        Reset demo data
      </button>
    </div>
  );
}
