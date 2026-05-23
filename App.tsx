
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

function App() {
    const [gameState, dispatch] = useReducer(gameReducer, getInitialState());
    const [assetsReady, setAssetsReady] = useState(false);
    const [isMenuTransitioning, setIsMenuTransitioning] = useState(false);
    
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

    // This effect runs once to preload essential assets.
    useEffect(() => {
        const musicToPreload = [
            '/Title_Screen.opus',
            '/Armory_BGM.opus',
            '/Battle_BGM.opus',
            '/Boss_BGM.opus',
            '/Final_BGM.opus',
        ];

        async function preloadAssets() {
            const loadingBar = document.getElementById('loading-bar-fg');
            const loadingText = document.getElementById('loading-text');
            
            const setUI = (percent: number, text: string) => {
                if (loadingBar) loadingBar.style.width = `${percent}%`;
                if (loadingText) loadingText.textContent = text;
            };

            // Helper to break the event loop and allow UI repaint
            const nextFrame = () => new Promise(resolve => setTimeout(resolve, 50));

            try {
                initAudio(); // Initialize context

                // Phase 1: Network Load (Music) - 0% to 20%
                setUI(5, "DOWNLOADING ASSETS...");
                
                let loadedCount = 0;
                const totalTracks = musicToPreload.length;
                const trackProgressStep = 20 / totalTracks; // 20% total for music

                await preloadMusic(musicToPreload, () => {
                    loadedCount++;
                    const currentPercent = loadedCount * trackProgressStep;
                    setUI(currentPercent, "DOWNLOADING ASSETS...");
                });

                await nextFrame();

                // Phase 2: Audio Synthesis - 20% to 30%
                setUI(20, "CALIBRATING AUDIO...");
                warmUpAudioGenerators();
                await nextFrame();
                setUI(30, "CALIBRATING AUDIO...");

                // Phase 3: Object Pools - 30% to 50%
                setUI(30, "ALLOCATING MEMORY...");
                await nextFrame();
                warmUpPools();
                setUI(50, "ALLOCATING MEMORY...");

                // Phase 4: Enemy Graphics - 50% to 70%
                setUI(50, "RENDERING HOSTILES...");
                await nextFrame();
                warmUpEnemyCache();
                setUI(70, "RENDERING HOSTILES...");

                // Phase 5: Environment Graphics - 70% to 90%
                setUI(70, "CHARGING SHIELDS...");
                await nextFrame();
                warmUpPlayerCache();
                warmUpAsteroidCache();
                warmUpEffectsCache();
                warmUpProjectileCache(); // ✅ NEW: Bake projectile sprites
                warmUpParticleCache();   // ✅ NEW: Bake particle sprites
                setUI(90, "CHARGING SHIELDS...");

                // Phase 6: GPU/Shader Warmup - 90% to 100%
                setUI(90, "ENGAGING HYPERDRIVE...");
                await nextFrame();
                
                // Shader warmup: Force compile of shadow and composite shaders
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 10;
                    canvas.height = 10;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.globalCompositeOperation = 'lighter';
                        ctx.filter = 'blur(5px)';
                        ctx.fillStyle = 'red';
                        ctx.fillRect(0,0,10,10);
                    }
                } catch(e) {
                    // Ignore shader warmup errors
                }
                
                precomputePerspectiveLUT();
                setUI(100, "READY");
                
                // Small delay to show "READY"
                setTimeout(() => setAssetsReady(true), 300);

            } catch (e) {
                // ✅ MOBILE OPTIMIZATION: Only log errors in development (console is slow on mobile)
                if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.error("Loading error:", e);
                }
                // Fallback to start anyway to avoid stuck screen
                setAssetsReady(true);
            }
        }

        preloadAssets();
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

    // Initialize volume settings from state once on load.
    useEffect(() => {
        initAudio();
        setMusicVolume(gameState.musicVolume);
        setSoundVolume(gameState.sfxVolume);
    }, []);

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
            (window as any).enterFullscreen().catch((err: Error) => {
                 // Error attempting to enable full-screen mode
            });
        }
        
        dispatch({ type: 'PREPARE_NEW_GAME', payload: { consumables, isHardMode } });
        
        // Clear the transition state after the animation duration (700ms)
        setTimeout(() => {
            setIsMenuTransitioning(false);
        }, 700);
    }, [dispatch]);
    
    const gameVisible = [
        GameStatus.Playing, 
        GameStatus.BossBattle, 
        GameStatus.AsteroidField, 
        GameStatus.TrainingSim, 
        GameStatus.PlayerDying
    ].includes(gameState.status);

    const showMenu = !gameVisible || isMenuTransitioning;

    return (
        <div className="w-full h-full flex justify-center items-center bg-slate-950 select-none">
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
                    style={{ visibility: gameVisible ? 'visible' : 'hidden' }}
                >
                    <GameView gameState={gameState} dispatch={dispatch} />
                </div>
    
                {/* UIManager and its background are overlaid when in menu or transitioning */}
                {showMenu && (
                    <div 
                        className={`absolute inset-0 border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/20 game-paused transition-all duration-700 ease-in ${
                            isMenuTransitioning ? 'opacity-0 scale-125 pointer-events-none' : 'opacity-100 scale-100'
                        }`}
                        style={{
                            perspective: '900px',
                            backgroundColor: '#0f172a'
                        }}
                    >
                        <div className="directional-light" />
                        <NebulaBackground />
                        {assetsReady && <UIManager gameState={gameState} dispatch={dispatch} handleStartGame={handleStartGame} />}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
