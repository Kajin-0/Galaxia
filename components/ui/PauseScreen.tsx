import React, { useState } from 'react';
import { Eye, Gamepad2, LogOut, Music2, Play, Volume2, Vibrate } from 'lucide-react';
import { playSound } from '../../sounds';
import type { GameAction } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { useColorSafeMode } from '../../utils/uiPerformance';
import { Badge, GlassPanel, NeonButton, ScreenShell, Slider, Toggle, cx } from './shared';

interface PauseScreenProps {
  dispatch: React.Dispatch<GameAction>;
  currentLayout: 'right' | 'left';
  musicVolume: number;
  sfxVolume: number;
  hapticsEnabled: boolean;
}

export const PauseScreen: React.FC<PauseScreenProps> = ({
  dispatch,
  currentLayout,
  musicVolume,
  sfxVolume,
  hapticsEnabled,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [colorSafeMode, setColorSafeMode] = useColorSafeMode();

  const click = (pattern: 'uiTap' | 'uiConfirm' | 'uiWarning' = 'uiTap') => {
    playSound('uiClick');
    triggerHaptic(pattern, hapticsEnabled);
  };

  const resume = () => {
    click('uiConfirm');
    dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() });
  };

  return (
    <ScreenShell
      dim="soft"
      titleId="pause-title"
      onDismiss={resume}
      contentClassName="items-stretch justify-start sm:items-center"
      className="backdrop-blur-[3px]"
    >
      <GlassPanel className="mx-auto w-full max-w-md p-4 sm:mt-4 sm:p-5" tone="cyan">
        <header className="mb-4 flex items-start justify-between gap-3 text-left">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">Flight suspended</p>
            <h1 id="pause-title" className="neon-title mt-0.5 text-3xl font-black uppercase">Paused</h1>
          </div>
          <Badge tone="cyan" pulse>Systems holding</Badge>
        </header>

        <NeonButton fullWidth icon={<Play className="h-5 w-5 fill-current" />} onClick={resume} className="min-h-14 text-base">
          Resume flight
        </NeonButton>

        <section className="mt-5 border-t border-slate-600/35 pt-4" aria-labelledby="audio-settings-title">
          <h2 id="audio-settings-title" className="mb-3 text-left text-xs font-black uppercase tracking-wider text-slate-300">Audio</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Music2 className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
              <Slider
                label="Music"
                valueLabel={`${Math.round((musicVolume / 0.8) * 100)}%`}
                min={0}
                max={0.8}
                step={0.05}
                value={musicVolume}
                onChange={event => dispatch({ type: 'SET_VOLUME', volumeType: 'music', level: Number(event.target.value) })}
                className="min-w-0 flex-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Volume2 className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              <Slider
                label="Effects"
                valueLabel={`${Math.round(sfxVolume * 100)}%`}
                min={0}
                max={1}
                step={0.05}
                value={sfxVolume}
                onChange={event => dispatch({ type: 'SET_VOLUME', volumeType: 'sfx', level: Number(event.target.value) })}
                className="min-w-0 flex-1"
              />
            </div>
          </div>
        </section>

        <section className="mt-4 border-t border-slate-600/35 pt-4" aria-labelledby="control-settings-title">
          <h2 id="control-settings-title" className="mb-3 text-left text-xs font-black uppercase tracking-wider text-slate-300">Controls</h2>
          <div className="mb-3 flex items-center gap-3">
            <Gamepad2 className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
            <div className="grid min-h-11 flex-1 grid-cols-2 rounded-md border border-slate-600/40 bg-slate-950/65 p-1" aria-label="Control hand">
              {(['left', 'right'] as const).map(layout => (
                <button
                  key={layout}
                  type="button"
                  aria-pressed={currentLayout === layout}
                  onClick={() => {
                    if (currentLayout === layout) return;
                    click();
                    dispatch({ type: 'TOGGLE_CONTROL_LAYOUT' });
                  }}
                  className={cx(
                    'min-h-9 rounded px-3 text-xs font-black uppercase transition-colors',
                    currentLayout === layout ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                  )}
                >
                  {layout}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={hapticsEnabled}
            onChange={() => {
              click();
              dispatch({ type: 'TOGGLE_HAPTICS' });
            }}
            label="Haptic feedback"
            description="Tactile cues for impacts and confirmations"
            icon={<Vibrate className="h-4 w-4" />}
          />
          <Toggle
            checked={colorSafeMode}
            onChange={value => {
              click();
              setColorSafeMode(value);
            }}
            label="Color-safe signals"
            description="Uses cyan and orange outcome cues"
            icon={<Eye className="h-4 w-4" />}
            className="border-t border-slate-700/45"
          />
        </section>

        <div className="mt-4 border-t border-slate-600/35 pt-4">
          {!showConfirm ? (
            <NeonButton
              fullWidth
              variant="quiet"
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => {
                click('uiWarning');
                setShowConfirm(true);
              }}
            >
              End run
            </NeonButton>
          ) : (
            <div className="screen-shell-enter border-l-2 border-red-400/60 bg-red-950/25 p-3 text-left" role="alert">
              <h2 className="text-sm font-black uppercase text-red-100">Return to command?</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Currency, parts, and rare consumables are secured. This run's score and active flight consumables will be lost.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NeonButton variant="danger" onClick={() => {
                  click('uiWarning');
                  dispatch({ type: 'EXIT_RUN_AND_SAVE' });
                }}>
                  End run
                </NeonButton>
                <NeonButton variant="secondary" onClick={() => {
                  click();
                  setShowConfirm(false);
                }}>
                  Stay
                </NeonButton>
              </div>
            </div>
          )}
        </div>
      </GlassPanel>
    </ScreenShell>
  );
};
