import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Radio, SkipForward } from 'lucide-react';
import { playSound } from '../../sounds';
import { Badge, GlassPanel, NeonButton, ScreenShell } from './primitives';

interface StoryScreenProps {
  title: string;
  text: string;
  onDismiss: () => void;
}

const CHARACTERS_PER_SECOND = 48;
const MAX_REVEAL_FPS = 30;

export const StoryScreen: React.FC<StoryScreenProps> = ({ title, text, onDismiss }) => {
  const titleId = useId();
  const textId = useId();
  const [visibleLength, setVisibleLength] = useState(0);
  const isComplete = visibleLength >= text.length;
  const isCompleteRef = useRef(isComplete);
  const revealImmediatelyRef = useRef(false);
  isCompleteRef.current = isComplete;

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || text.length === 0) {
      revealImmediatelyRef.current = true;
      setVisibleLength(text.length);
      return;
    }

    revealImmediatelyRef.current = false;
    setVisibleLength(0);
    let frameId = 0;
    let startTime: number | undefined;
    let lastUpdateTime = 0;

    const revealFrame = (timestamp: number) => {
      if (revealImmediatelyRef.current) {
        setVisibleLength(text.length);
        return;
      }

      startTime ??= timestamp;
      const elapsedSeconds = (timestamp - startTime) / 1000;
      const nextLength = Math.min(text.length, Math.max(1, Math.floor(elapsedSeconds * CHARACTERS_PER_SECOND)));
      if (timestamp - lastUpdateTime >= 1000 / MAX_REVEAL_FPS || nextLength === text.length) {
        lastUpdateTime = timestamp;
        setVisibleLength((currentLength) => currentLength === nextLength ? currentLength : nextLength);
      }

      if (nextLength < text.length) {
        frameId = requestAnimationFrame(revealFrame);
      }
    };

    frameId = requestAnimationFrame(revealFrame);
    return () => cancelAnimationFrame(frameId);
  }, [text]);

  const handleContinue = useCallback(() => {
    playSound('uiClick');
    if (!isCompleteRef.current) {
      isCompleteRef.current = true;
      revealImmediatelyRef.current = true;
      setVisibleLength(text.length);
      return;
    }
    onDismiss();
  }, [onDismiss, text.length]);

  return (
    <ScreenShell
      titleId={titleId}
      aria-describedby={textId}
      onDismiss={handleContinue}
      contentClassName="justify-center"
    >
      <GlassPanel tone="cyan" className="my-auto w-full max-w-xl p-5 text-left sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Badge tone="cyan" pulse={!isComplete}>
            <Radio className="h-3 w-3" aria-hidden="true" />
            Command transmission
          </Badge>
          <span className="font-mono text-[10px] font-bold uppercase text-slate-500">Priority channel</span>
        </div>

        <div className="mb-4 flex items-start gap-3 border-b border-cyan-300/20 pb-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 text-cyan-200">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Galaxia command</p>
            <h2 id={titleId} className="mt-1 text-2xl font-black leading-tight text-slate-50 sm:text-3xl">
              {title}
            </h2>
          </div>
        </div>

        <p id={textId} className="sr-only">{text}</p>
        <button
          type="button"
          onClick={handleContinue}
          aria-label={isComplete ? 'Continue mission' : 'Reveal complete transmission'}
          className="block min-h-44 w-full cursor-pointer whitespace-pre-wrap py-1 text-left text-base leading-relaxed text-slate-200 sm:text-lg"
        >
          <span aria-hidden="true">
            {text.slice(0, visibleLength)}
            {!isComplete && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-cyan-300 align-middle" />}
          </span>
        </button>

        <div className="mt-5 flex flex-col-reverse items-stretch gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 sm:justify-start">
            <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            {isComplete ? 'Transmission complete' : 'Tap message or continue to reveal'}
          </span>
          <NeonButton
            onClick={handleContinue}
            iconAfter={<ChevronRight className="h-4 w-4" />}
            className="sm:min-w-40"
          >
            {isComplete ? 'Continue' : 'Reveal message'}
          </NeonButton>
        </div>
      </GlassPanel>
    </ScreenShell>
  );
};
