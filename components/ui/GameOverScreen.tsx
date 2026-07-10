import React, { useEffect, useId, useState } from 'react';
import { LogOut, RotateCcw, Skull } from 'lucide-react';
import { playSound } from '../../sounds';
import type { GameAction } from '../../types';
import { AnimatedNumber } from './shared';
import { Badge, GlassPanel, NeonButton, ScreenShell } from './primitives';

interface GameOverScreenProps {
  dispatch: React.Dispatch<GameAction>;
  score: number;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ dispatch, score }) => {
  const titleId = useId();
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    setDisplayScore(score);
  }, [score]);

  return (
    <ScreenShell titleId={titleId} dim="soft" className="backdrop-grayscale" contentClassName="justify-center">
      <GlassPanel tone="magenta" className="my-auto w-full max-w-lg p-5 text-center sm:p-7">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-pink-300/40 bg-pink-400/10 text-pink-200 shadow-neon-magenta">
          <Skull className="h-8 w-8" aria-hidden="true" />
        </div>
        <Badge tone="magenta" className="mt-4">Flight terminated</Badge>
        <h2 id={titleId} className="mt-3 text-4xl font-black uppercase text-pink-300 sm:text-5xl">
          Game Over
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-300 sm:text-base">
          The run has ended. Your final flight record is sealed.
        </p>

        <div className="my-6 border-y border-pink-300/20 py-5" aria-live="polite">
          <p className="text-[10px] font-black uppercase tracking-wider text-pink-300">Final score</p>
          <p className="mt-1 font-mono text-4xl font-black tabular-nums text-slate-50 sm:text-5xl">
            <AnimatedNumber value={displayScore} />
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <NeonButton
            fullWidth
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={() => {
              playSound('uiClick');
              dispatch({ type: 'RESTART_GAME' });
            }}
          >
            Restart
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
