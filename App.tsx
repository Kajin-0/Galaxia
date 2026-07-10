
import React, { useReducer, useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';
import type { Consumables } from './types';
import { GameStatus } from './types';
import * as C from './constants';
import { playSound, playMusic, stopMusic, initAudio, setMusicVolume, setSoundVolume, preloadMusic, warmUpAudioGenerators } from './sounds';
import { getInitialState } from './utils/progression';
import { gameReducer } from './state/reducer';
import { precomputePerspectiveLUT } from './utils/perspective';
import { useIAP, initializeIAPWithGameState } from './utils/useIAP';
import { UIManager } from './components/ui/UIManager';
import { GameView } from './components/GameView';
import { NebulaBackground } from './components/NebulaBackground';
import { warmUpPools } from './state/pools';
import { warmUpEnemyCache } from './components/canvas/drawEnemy';
import { warmUpAsteroidCache } from './components/canvas/drawAsteroid';
import { warmUpPlayerCache } from './components/canvas/drawPlayer';
import { warmUpEffectsCache } from './components/canvas/drawSpecialEffects';
import { warmUpProjectileCache } from './components/canvas/drawProjectiles';
import { warmUpParticleCache } from './components/canvas/drawImpacts';
import { useUIPerformance } from './utils/uiPerformance';

type BootReporter = (percent: number, message: string) => void;

let bootWarmupPromise: Promise<void> | null = null;

const waitForPaint = (abbreviated: boolean) => new Promise<void>(resolve => {
    window.setTimeout(resolve, abbreviated ? 16 : 55);
});

const runBootWarmup = async (report: BootReporter, abbreviated: boolean): Promise<void> => {
    const musicToPreload = [
        '/Title_Screen.opus',
        '/Armory_BGM.opus',
        '/Battle_BGM.opus',
        '/Boss_BGM.opus',
        '/Final_BGM.opus',
    ];

    initAudio();
    report(4, 'LINKING AUDIO CHANNELS');

    let loadedCount = 0;
    await preloadMusic(musicToPreload, () => {
        loadedCount += 1;
        report(4 + (loadedCount / musicToPreload.length) * 20, 'LINKING AUDIO CHANNELS');
    });

    await waitForPaint(abbreviated);
    report(28, 'CALIBRATING WEAPON AUDIO');
    warmUpAudioGenerators();

    await waitForPaint(abbreviated);
    report(42, 'PRIMING COMBAT SYSTEMS');
    warmUpPools();

    await waitForPaint(abbreviated);
    report(58, 'MAPPING HOSTILE SIGNATURES');
    warmUpEnemyCache();

    await waitForPaint(abbreviated);
    report(74, 'CHARGING FLIGHT SYSTEMS');
    warmUpPlayerCache();
    warmUpAsteroidCache();
    warmUpEffectsCache();
    warmUpProjectileCache();
    warmUpParticleCache();

    await waitForPaint(abbreviated);
    report(92, 'ALIGNING HYPERDRIVE');
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const context = canvas.getContext('2d');
    if (context) {
        context.shadowBlur = 10;
        context.shadowColor = 'rgba(34,211,238,0.5)';
        context.globalCompositeOperation = 'lighter';
        context.fillStyle = '#22d3ee';
        context.fillRect(0, 0, 10, 10);
    }
    precomputePerspectiveLUT();
    report(100, 'ALL SYSTEMS ONLINE');
};

function App() {
    const [gameState, dispatch] = useReducer(gameReducer, getInitialState());
    const [assetsReady, setAssetsReady] = useState(false);
    const [isMenuTransitioning, setIsMenuTransitioning] = useState(false);

    useUIPerformance();
    
    // Initialize IAP system
    useIAP(dispatch);
    
    // Initialize IAP service with game state dispatcher
    useEffect(() => {
        initializeIAPWithGameState(dispatch);
    }, [dispatch]);

    // This effect runs once to configure the native status bar on mobile.
    useEffect(() => {
        const configureStatusBar = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    await StatusBar.hide();
                    await StatusBar.setStyle({ style: Style.Dark });
                } catch (e) {
                    // Failed to configure status bar
                }
            }
        };
        configureStatusBar();
    }, []);

    // Prevent hardware back button from exiting the app on Android
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            CapacitorApp.addListener('backButton', () => {
                // By consuming this event, we prevent the default behavior (which is exiting the app).
                // We essentially do nothing here, locking the user in the game view.
            });
        }
    }, []);

    // Preload once even when development StrictMode replays effects.
    useEffect(() => {
        let active = true;
        const splash = document.getElementById('splash-screen');
        const loadingBar = document.getElementById('loading-bar-fg');
        const loadingText = document.getElementById('loading-text');
        const progress = document.getElementById('loading-bar-bg');
        const abbreviated = window.sessionStorage.getItem('galaxia.boot.complete') === 'true';
        splash?.toggleAttribute('data-repeat-boot', abbreviated);

        const report: BootReporter = (percent, message) => {
            const clamped = Math.round(Math.min(100, Math.max(0, percent)));
            if (loadingBar) loadingBar.style.width = `${clamped}%`;
            if (loadingText) loadingText.textContent = message;
            progress?.setAttribute('aria-valuenow', String(clamped));
        };

        bootWarmupPromise ??= runBootWarmup(report, abbreviated);
        void bootWarmupPromise
            .catch(() => {
                report(100, 'SYSTEMS RESTORED');
            })
            .finally(() => {
                if (!active) return;
                window.sessionStorage.setItem('galaxia.boot.complete', 'true');
                window.setTimeout(() => setAssetsReady(true), abbreviated ? 80 : 320);
            });

        return () => {
            active = false;
        };
    }, []);

    // This effect now runs when assets are ready, not just on mount.
    useEffect(() => {
        if (assetsReady) {
            const splashScreen = document.getElementById('splash-screen');
            if (splashScreen) {
                splashScreen.classList.add('hidden');
                splashScreen.addEventListener('transitionend', () => splashScreen.remove(), { once: true });
            }
        }
    }, [assetsReady]);

    // Keep the audio engine aligned with persisted settings.
    useEffect(() => {
        initAudio();
        setMusicVolume(gameState.musicVolume);
        setSoundVolume(gameState.sfxVolume);
    }, [gameState.musicVolume, gameState.sfxVolume]);

    // Prevent iOS gesture navigation, system gestures, and Android predictive back visual
    useEffect(() => {
        // 1. Enforce CSS touch-action to 'pan-y'. 
        // This allows vertical scrolling (necessary for menus) but prevents horizontal gestures
        // (like swipe-to-back) at the browser level.
        document.body.style.touchAction = 'pan-y';

        // 2. Prevent standard multi-touch and context menu gestures
        const preventGesture = (e: Event) => e.preventDefault();
        document.addEventListener('gesturestart', preventGesture);
        document.addEventListener('gesturechange', preventGesture);
        document.addEventListener('gestureend', preventGesture);
        document.addEventListener('contextmenu', preventGesture);

        // 3. AGGRESSIVE EDGE SWIPE PREVENTION
        // This handles both TouchEvents and PointerEvents to cover all browser/OS implementations.
        // It explicitly prevents default behavior for inputs starting at the screen edges.
        const preventEdgeSwipe = (event: TouchEvent | PointerEvent) => {
            let clientX: number | undefined;
            
            if ('touches' in event) {
                // TouchEvent
                if (event.touches.length > 0) {
                    clientX = event.touches[0].clientX;
                }
            } else {
                // PointerEvent
                clientX = event.clientX;
            }

            if (clientX !== undefined) {
                // 40px threshold covers the typical Android/iOS gesture trigger area
                const edgeThreshold = 40;
                if (clientX < edgeThreshold || clientX > window.innerWidth - edgeThreshold) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        };

        // passive: false is REQUIRED to allow calling preventDefault()
        // Attaching to window captures the event as early as possible.
        window.addEventListener('touchstart', preventEdgeSwipe, { passive: false });
        window.addEventListener('pointerdown', preventEdgeSwipe, { passive: false });

        return () => {
            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
            document.removeEventListener('gestureend', preventGesture);
            document.removeEventListener('contextmenu', preventGesture);
            
            window.removeEventListener('touchstart', preventEdgeSwipe);
            window.removeEventListener('pointerdown', preventEdgeSwipe);
        };
    }, []);

    // Prevent browser back navigation
    useEffect(() => {
        window.history.pushState(null, '', window.location.href);
        const handlePopState = () => {
            window.history.pushState(null, '', window.location.href);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);
    
    useEffect(() => {
        switch (gameState.status) {
            case GameStatus.StartScreen:
            case GameStatus.Hangar:
            case GameStatus.Store:
                playMusic('/Title_Screen.opus');
                break;
            case GameStatus.Armory:
            case GameStatus.Intermission:
                playMusic('/Armory_BGM.opus');
                break;
            case GameStatus.Playing:
            case GameStatus.AsteroidField:
            case GameStatus.TrainingSim:
                playMusic('/Battle_BGM.opus');
                break;
            case GameStatus.BossBattle:
                if (gameState.boss?.bossType === 'overmind') playMusic('/Final_BGM.opus');
                else playMusic('/Boss_BGM.opus');
                break;
            case GameStatus.GameOver:
            case GameStatus.Story:
            case GameStatus.Victory:
            case GameStatus.PlayerDying:
            case GameStatus.RandomEncounter:
            case GameStatus.Loading:
                 stopMusic();
                 break;
            default:
                break;
        }
    }, [gameState.status, gameState.boss?.bossType]);
    
    const handleStartGame = useCallback((consumables: Consumables, isHardMode: boolean) => {
        initAudio();
        // Play the "Launch" sound instead of standard click for better feedback
        playSound('upgradeStart');
        
        // Trigger the transition effect
        setIsMenuTransitioning(true);
        
        // Use the new window.enterFullscreen helper from index.html
        if (typeof (window as any).enterFullscreen === 'function') {
            (window as any).enterFullscreen().catch(() => undefined);
        }
        
        dispatch({ type: 'PREPARE_NEW_GAME', payload: { consumables, isHardMode } });
        
        // Clear the transition state after the animation duration (700ms)
        setTimeout(() => {
            setIsMenuTransitioning(false);
        }, 700);
    }, [dispatch]);
    
    const isGameplayStatus = [
        GameStatus.Playing, 
        GameStatus.BossBattle, 
        GameStatus.AsteroidField, 
        GameStatus.TrainingSim, 
        GameStatus.PlayerDying
    ].includes(gameState.status);

    const isPaused = gameState.status === GameStatus.Paused;
    const showGameScene = isGameplayStatus || isPaused;
    const showInterface = !isGameplayStatus || isMenuTransitioning;

    return (
        <div className="game-surface flex h-full w-full select-none items-center justify-center bg-space-void">
            <div 
                className="relative"
                style={{
                    height: '100%',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    aspectRatio: `${C.GAME_WIDTH} / ${C.GAME_HEIGHT}`,
                }}
            >
                {/* GameView is always mounted but hidden via visibility. 
                    When transitioning to game, gameVisible becomes true, so GameView appears underneath the fading menu.
                */}
                <div 
                    className="absolute inset-0"
                    style={{ visibility: showGameScene ? 'visible' : 'hidden' }}
                >
                    <GameView gameState={gameState} dispatch={dispatch} />
                </div>
    
                {/* UIManager and its background are overlaid when in menu or transitioning */}
                {showInterface && (
                    <div 
                        className={`absolute inset-0 overflow-hidden border border-cyan-400/20 game-paused transition-all duration-700 ease-in ${
                            isMenuTransitioning ? 'opacity-0 scale-125 pointer-events-none' : 'opacity-100 scale-100'
                        } ${isPaused ? 'bg-transparent' : 'bg-space-deep shadow-neon-cyan'}`}
                        style={{
                            perspective: '900px',
                        }}
                    >
                        {!isPaused && <>
                            <div className="directional-light" />
                            <NebulaBackground />
                            <div className="scan-grid absolute inset-0 opacity-50" aria-hidden="true" />
                        </>}
                        {assetsReady && <UIManager gameState={gameState} dispatch={dispatch} handleStartGame={handleStartGame} />}
                        {isMenuTransitioning && (
                            <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden" aria-hidden="true">
                                {Array.from({ length: 12 }, (_, index) => (
                                    <span
                                        key={index}
                                        className="warp-streak absolute top-1/2 h-40 w-px bg-gradient-to-t from-transparent via-cyan-100 to-transparent"
                                        style={{ left: `${6 + index * 8}%`, animationDelay: `${index * 22}ms` }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
