import React, { useEffect, useRef, useState } from 'react';
import { GameStatus } from '../../types';
import { cx } from './primitives';

type TransitionCharacter = 'standard' | 'pause' | 'anomaly' | 'warning' | 'victory' | 'story';

const transitionFor = (status: GameStatus): TransitionCharacter => {
  switch (status) {
    case GameStatus.Paused:
      return 'pause';
    case GameStatus.RandomEncounter:
    case GameStatus.Loading:
    case GameStatus.EncounterOutcome:
      return 'anomaly';
    case GameStatus.GameOver:
    case GameStatus.PlayerDying:
      return 'warning';
    case GameStatus.Intermission:
    case GameStatus.Victory:
      return 'victory';
    case GameStatus.Story:
      return 'story';
    default:
      return 'standard';
  }
};

const transitionClasses: Record<TransitionCharacter, string> = {
  standard: 'border-cyan-200/40 bg-cyan-200/25',
  pause: 'border-slate-100/35 bg-slate-100/20',
  anomaly: 'border-violet-200/50 bg-violet-300/30',
  warning: 'border-red-200/50 bg-red-400/30',
  victory: 'border-yellow-100/55 bg-yellow-200/30',
  story: 'border-cyan-100/40 bg-slate-100/25',
};

interface TransitionDirectorProps {
  status: GameStatus;
  children: React.ReactNode;
}

/**
 * Presentation-only status choreography. Canonical state changes immediately;
 * this inert curtain masks the visual swap without delaying simulation or actions.
 */
export const TransitionDirector: React.FC<TransitionDirectorProps> = ({ status, children }) => {
  const previousStatus = useRef(status);
  const [transition, setTransition] = useState<{ id: number; character: TransitionCharacter } | null>(null);

  useEffect(() => {
    if (previousStatus.current === status) return;
    previousStatus.current = status;
    const id = performance.now();
    setTransition({ id, character: transitionFor(status) });
    const timeout = window.setTimeout(() => {
      setTransition(current => current?.id === id ? null : current);
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [status]);

  return (
    <>
      <div key={status} className="contents">{children}</div>
      {transition && (
        <div className="pointer-events-none absolute inset-0 z-[90] overflow-hidden" aria-hidden="true">
          <span className={cx('transition-curtain absolute inset-y-0 left-1/2 w-[115%] -translate-x-1/2 border-x', transitionClasses[transition.character])} />
          <span className={cx('transition-scan absolute left-0 right-0 h-px', transitionClasses[transition.character])} />
        </div>
      )}
    </>
  );
};
