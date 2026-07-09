import React, { useEffect, useId, useState } from 'react';
import { LogOut, Play, Sparkles, Trophy } from 'lucide-react';
import { playSound } from '../../sounds';
import type { GameAction } from '../../types';
import { AnimatedNumber } from './shared';
import { Badge, GlassPanel, NeonButton, ScreenShell } from './primitives';

interface VictoryScreenProps {
  dispatch: React.Dispatch<GameAction>;
  score: number;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ dispatch, score }) => {
  const titleId = useId();
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    setDisplayScore(score);
  }, [score]);

  return (
    <ScreenShell titleId={titleId} dim="soft" contentClassName="justify-center">
      <GlassPanel tone="gold" className="relative my-auto w-full max-w-lg overflow-hidden p-5 text-center sm:p-7">
        <Sparkles className="absolute left-5 top-6 h-5 w-5 animate-pulse text-yellow-200/60" aria-hidden="true" />
        <Sparkles className="absolute right-6 top-14 h-4 w-4 animate-pulse text-cyan-200/55" aria-hidden="true" />

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-yellow-200/50 bg-yellow-300/10 text-yellow-200 shadow-[0_0_28px_rgba(250,204,21,0.3)]">
          <Trophy className="h-8 w-8" aria-hidden="true" />
        </div>
        <Badge tone="gold" className="mt-4">Overmind neutralized</Badge>
        <h2 id={titleId} className="mt-3 text-4xl font-black uppercase text-yellow-200 sm:text-5xl">
          Victory
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-200 sm:text-base">
          The Overmind is shattered. Its armada falters as the psychic signal collapses into silence.
        </p>
        <p className="mt-2 text-sm font-bold text-cyan-200">The galaxy remembers your call sign.</p>

        <div className="my-6 border-y border-yellow-200/20 py-5" aria-live="polite">
          <p className="text-[10px] font-black uppercase tracking-wider text-yellow-200">Final score</p>
          <p className="mt-1 font-mono text-4xl font-black tabular-nums text-slate-50 sm:text-5xl">
            <AnimatedNumber value={displayScore} />
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <NeonButton
            fullWidth
            icon={<Play className="h-4 w-4" />}
            onClick={() => {
              playSound('uiClick');
              dispatch({ type: 'CONTINUE_AFTER_VICTORY' });
            }}
          >
            Continue playing
          </NeonButton>
          <NeonButton
            fullWidth
            variant="quiet"
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => {
              playSound('uiClick');
              dispatch({ type: 'RETURN_TO_MENU' });
            }}
          >
            Main menu
          </NeonButton>
        </div>
      </GlassPanel>
    </ScreenShell>
  );
};
