import React, { useEffect, useId, useState } from 'react';
import { Binary, RadioTower, ScanLine } from 'lucide-react';
import { Badge, GlassPanel, ScreenShell, StatBar } from './primitives';

export const EncounterProcessingScreen: React.FC = () => {
  const titleId = useId();
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(94);
      return;
    }

    const intervalId = window.setInterval(() => {
      setProgress((current) => Math.min(94, current + 8));
    }, 120);
    return () => window.clearInterval(intervalId);
  }, []);

  const stage = progress < 38
    ? 'Isolating carrier wave'
    : progress < 72
      ? 'Decrypting response'
      : 'Resolving encounter outcome';

  return (
    <ScreenShell
      titleId={titleId}
      aria-busy="true"
      contentClassName="justify-center"
    >
      <GlassPanel tone="violet" className="my-auto w-full max-w-sm p-6 text-center">
        <Badge tone="violet" pulse>
          <RadioTower className="h-3 w-3" aria-hidden="true" />
          Decoding
        </Badge>

        <div className="relative mx-auto my-6 flex h-24 w-24 items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-violet-300/25 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-dashed border-cyan-300/35 animate-spin" />
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/45 bg-violet-400/10 text-violet-200 shadow-neon-violet">
            <ScanLine className="h-7 w-7 animate-pulse" />
          </div>
        </div>

        <h2 id={titleId} className="text-xl font-black text-slate-50 sm:text-2xl">Decoding transmission</h2>
        <p className="mt-2 min-h-5 text-sm font-semibold text-violet-200" role="status" aria-live="polite">
          {stage}
        </p>

        <StatBar
          value={progress}
          label="Signal reconstruction"
          valueLabel={`${progress}%`}
          tone="violet"
          className="mt-5 text-left"
        />
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Binary className="h-4 w-4" aria-hidden="true" />
          Do not interrupt uplink
        </div>
      </GlassPanel>
    </ScreenShell>
  );
};
