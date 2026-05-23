
import * as C from './constants';

// A custom sound engine using the native Web Audio API for guaranteed reliability.

let audioContext: AudioContext | null = null;
let sfxGain: GainNode | null = null; // For sound effects
let musicGain: GainNode | null = null; // for music
let sfxCompressor: DynamicsCompressorNode | null = null; // Controls dense SFX peaks
let masterLimiter: DynamicsCompressorNode | null = null; // Final anti-clipping safety limiter
let isInitialized = false;
let sfxVolumeSetting = 0.5;
let musicVolumeSetting = 0.8; 
const FADE_TIME = 0.25; // Quick fade in/out duration in seconds

let currentMusicSource: AudioBufferSourceNode | null = null;
let currentTrackUrl: string | null = null;
let queuedMusicUrl: string | null = null; // For handling suspended audio context
const musicBufferCache: { [key: string]: AudioBuffer } = {};
let whiteNoiseBuffer: AudioBuffer | null = null;
let spreadShotReverbBuffer: AudioBuffer | null = null;
let distortionCurveCache: Float32Array | null = null; // ✅ NEW: Cache distortion curve

// Sound throttling to prevent audio system overload (does not affect sound generation)
let activeSoundCount = 0;
const MAX_CONCURRENT_SOUNDS = 16; // Limit concurrent sounds to prevent audio system overload (increased from 8 for less aggressive throttling)

/**
 * Creates a single, shared buffer of white noise to be used by all procedural sounds.
 * This is an expensive operation and should only be done once.
 * @param context The active AudioContext.
 */
function createWhiteNoiseBuffer(context: AudioContext) {
    if (whiteNoiseBuffer || !context) return;
    const bufferSize = context.sampleRate; // 1 second of noise is plenty
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    whiteNoiseBuffer = buffer;
}

/**
 * Creates and caches the reverb impulse response for the Spread Shot power-up sound.
 * This is an expensive operation and should only be done once.
 * @param context The active AudioContext.
 */
function createSpreadShotReverb(context: AudioContext) {
    if (spreadShotReverbBuffer || !context) return;

    // Generate a simple impulse response for reverb programmatically
    const reverbTime = 1.2;
    const sampleRate = context.sampleRate;
    const length = sampleRate * reverbTime;
    const impulse = context.createBuffer(2, length, sampleRate);
    for(let c=0; c < impulse.numberOfChannels; c++) {
        const channelData = impulse.getChannelData(c);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
        }
    }
    
    spreadShotReverbBuffer = impulse;
}


/**
 * Initializes the audio context. Must be called from a user gesture (e.g., a click).
 * This will create the audio context if it doesn't exist, and resume it if it's suspended.
 */
export function initAudio() {
    if (!isInitialized) {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = audioContext.currentTime;

            // Master safety limiter catches occasional mix spikes without changing normal sound quality.
            masterLimiter = audioContext.createDynamicsCompressor();
            masterLimiter.threshold.setValueAtTime(-1, now);
            masterLimiter.knee.setValueAtTime(0, now);
            masterLimiter.ratio.setValueAtTime(20, now);
            masterLimiter.attack.setValueAtTime(0.001, now);
            masterLimiter.release.setValueAtTime(0.08, now);
            masterLimiter.connect(audioContext.destination);
            
            // SFX Path
            sfxGain = audioContext.createGain();
            sfxGain.gain.setValueAtTime(sfxVolumeSetting, now);

            // Mild bus compression smooths many overlapping SFX while preserving transients.
            sfxCompressor = audioContext.createDynamicsCompressor();
            sfxCompressor.threshold.setValueAtTime(-12, now);
            sfxCompressor.knee.setValueAtTime(18, now);
            sfxCompressor.ratio.setValueAtTime(6, now);
            sfxCompressor.attack.setValueAtTime(0.003, now);
            sfxCompressor.release.setValueAtTime(0.12, now);
            sfxGain.connect(sfxCompressor);
            sfxCompressor.connect(masterLimiter);

            // Music Path
            musicGain = audioContext.createGain();
            musicGain.gain.setValueAtTime(0, now);
            musicGain.connect(masterLimiter);
            
            // Create the shared noise buffer once the context is ready.
            createWhiteNoiseBuffer(audioContext);

            isInitialized = true;
        } catch (e) {
            return;
        }
    }
    
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            // If music was queued because the context was suspended, play it now.
            if (queuedMusicUrl) {
                const urlToPlay = queuedMusicUrl;
                queuedMusicUrl = null; // Clear queue before playing
                playMusic(urlToPlay);
            }
        }).catch(() => {});
    }
}

/**
 * Pre-calculates expensive audio buffers (white noise, reverb) during the loading phase.
 * Safe to call before user interaction (context may be suspended, but buffers can still be created).
 */
export function warmUpAudioGenerators() {
    // Attempt initialization if not already done (this creates the context)
    if (!isInitialized) {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            // We don't fully initialize gains/connections here if we are just warming up buffers
            // But typically initAudio handles that. Let's just use what we have.
            // If we are here, we just want access to `createBuffer`.
        } catch (e) {
            return; 
        }
    }

    if (audioContext) {
        // These functions check internally if buffers already exist, so it's safe to call multiple times.
        createWhiteNoiseBuffer(audioContext);
        createSpreadShotReverb(audioContext);
    }
}

/**
 * Preloads and decodes audio files into a cache for instant playback later.
 * @param trackUrls An array of music file URLs to preload.
 * @param onTrackLoaded A callback function that's invoked once for each track that is processed (successfully or not).
 */
export async function preloadMusic(trackUrls: string[], onTrackLoaded: () => void): Promise<void> {
    if (!isInitialized) {
        initAudio();
    }
    if (!audioContext) {
        trackUrls.forEach(onTrackLoaded); // Call callback for each to not block loading
        return;
    }

    const promises = trackUrls.map(async (url) => {
        try {
            if (musicBufferCache[url]) {
                return; // Already cached
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            // This can be called even on a suspended context
            const decodedData = await audioContext.decodeAudioData(arrayBuffer);
            musicBufferCache[url] = decodedData;
        } catch (error) {
            // Failed to preload music track
        } finally {
            // Update progress even if a track fails, so the app doesn't get stuck.
            onTrackLoaded();
        }
    });

    await Promise.all(promises);
}

/**
 * Stops the currently playing music track with a fade out.
 */
export function stopMusic() {
    if (!audioContext || !musicGain || !currentMusicSource) {
        return;
    }

    // Fade out
    musicGain.gain.cancelScheduledValues(audioContext.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, audioContext.currentTime); // Start from current value
    musicGain.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + FADE_TIME);

    const sourceToStop = currentMusicSource;
    
    // Clear global references so a new track can be started
    currentMusicSource = null;
    currentTrackUrl = null;

    // Schedule the stop event using the Web Audio API's clock for precision.
    sourceToStop.stop(audioContext.currentTime + FADE_TIME);

    // Disconnect the node after it has stopped playing to allow for garbage collection.
    // The timing of this is not critical, so setTimeout is acceptable here.
    setTimeout(() => {
        sourceToStop.disconnect();
    }, FADE_TIME * 1000);
}

/**
 * Loads and plays a music track with caching and fades.
 * Handles transitions between tracks and suspended audio contexts.
 * @param trackUrl The URL of the music file to play.
 */
export async function playMusic(trackUrl: string) {
    // If context isn't ready, queue the track and bail. initAudio() must be called by a user gesture.
    if (!isInitialized || !audioContext || audioContext.state !== 'running') {
        if(!isInitialized) initAudio(); // Create context so it's ready to be resumed
        queuedMusicUrl = trackUrl;
        return;
    }

    // Request 2: If the same track is requested, do nothing to prevent resets.
    if (trackUrl === currentTrackUrl) {
        return;
    }

    // If a different track is playing, stop it (with fade-out).
    if (currentMusicSource) {
        stopMusic();
    }

    try {
        let buffer: AudioBuffer;
        if (musicBufferCache[trackUrl]) {
            buffer = musicBufferCache[trackUrl];
        } else {
            const response = await fetch(trackUrl);
            if (!response.ok) {
                currentMusicSource = null;
                currentTrackUrl = null;
                return;
            }
            const arrayBuffer = await response.arrayBuffer();
            buffer = await audioContext.decodeAudioData(arrayBuffer);
            musicBufferCache[trackUrl] = buffer;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(musicGain);

        // Set new global references
        currentMusicSource = source;
        currentTrackUrl = trackUrl;

        // Fade in the new track.
        musicGain.gain.cancelScheduledValues(audioContext.currentTime);
        musicGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        musicGain.gain.linearRampToValueAtTime(musicVolumeSetting, audioContext.currentTime + FADE_TIME);

        source.start(0);

    } catch (e) {
        // Reset state on error
        currentMusicSource = null;
        currentTrackUrl = null;
    }
}


export type SoundName = 
    'shoot' | 'shoot_empowered' | 'explosion' | 'enemyShoot' | 'gameOver' | 'uiClick' | 
    'powerUpRapidFire' | 'powerUpSpreadShot' | 'powerUpShield' | 'powerUpExtendedMag' | 'powerUpAutoReload' | 'powerUpCritBoost' | 'powerUpReloadBoost' |
    'reload' | 'emptyClip' | 'criticalHit' | 'shieldBreak' | 'shieldHit' | 'gammaShieldHit' | 'levelUp' | 'purchase' | 'revive' | 'upgradeStart' | 'partCollect' | 'laserShoot' | 'bossHit' | 'empArc' | 'encounterGood' | 'encounterBad' | 'secretFound' | 'weaverBeam' | 'weaverSurge' | 'trainingTargetHit' | 'trainingTargetSuccess' | 'trainingTargetFail' | 'phaseShiftActivate' | 'phaseShiftDeactivate' | 'shieldClank' | 'corrosiveTick' | 'corrosiveImpact' | 'projectileImpact';

/**
 * A helper function to generate and play a short burst of noise.
 * Used for explosions, clicks, and reloads.
 */
function playNoise(duration: number, frequency: number, type: 'bandpass' | 'lowpass' | 'highpass' = 'bandpass', volume = 1) {
    if (!audioContext || !sfxGain || !whiteNoiseBuffer) return;
    const now = audioContext.currentTime;

    const noise = audioContext.createBufferSource();
    noise.buffer = whiteNoiseBuffer;
    noise.loop = true;

    // Filter the noise to give it a tonal quality
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;

    // Create a gain envelope to shape the volume over time (fade out)
    const envelope = audioContext.createGain();
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfxGain);

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    noise.start(now);
    noise.stop(now + duration);
}

// ============================================================================
// PRIVATE SOUND GENERATION HELPERS
// ============================================================================

/**
 * Configuration for audio node chain building
 */
interface AudioNodeConfig {
    // Oscillator config
    oscillator?: {
        type: OscillatorType;
        frequency: number | { start: number; end: number; rampType?: 'linear' | 'exponential' };
        detune?: number | { value: number; lfo?: { freq: number; depth: number } };
    };
    
    // Filter config
    filter?: {
        type: BiquadFilterType;
        frequency: number | { start: number; end: number; rampTime?: number };
        Q?: number;
    };
    
    // Distortion config
    distortion?: {
        curve: Float32Array | null;
        oversample?: OverSampleType;
    };
    
    // Panner config
    panner?: {
        pan: number | { start: number; end: number };
    };
    
    // Envelope config
    envelope: {
        attack: number;
        decay?: number;
        sustain?: number;
        release: number;
        volume: number;
        useLinearDecay?: boolean;
    };
    
    // Timing
    startTime: number;
    duration: number;
    
    // Destination (defaults to sfxGain if not provided)
    destination?: AudioNode;
}

/**
 * Creates a complete audio node chain from configuration.
 * This reduces repetitive code by handling common patterns:
 * - Oscillator -> Filter -> Distortion -> Panner -> Envelope -> Destination
 * - Supports LFO modulation, frequency ramping and complex envelopes
 */
function createAudioChain(
    audioContext: AudioContext,
    sfxGain: GainNode,
    config: AudioNodeConfig
): { oscillator?: OscillatorNode; source?: AudioBufferSourceNode; nodes: AudioNode[] } {
    const destination = config.destination || sfxGain;
    const nodes: AudioNode[] = [];
    let source: OscillatorNode | AudioBufferSourceNode | null = null;
    
    // Create oscillator if specified
    if (config.oscillator) {
        const osc = audioContext.createOscillator();
        osc.type = config.oscillator.type;
        
        // Handle frequency (static or ramped)
        if (typeof config.oscillator.frequency === 'number') {
            osc.frequency.setValueAtTime(config.oscillator.frequency, config.startTime);
        } else {
            osc.frequency.setValueAtTime(config.oscillator.frequency.start, config.startTime);
            const rampType = config.oscillator.frequency.rampType || 'exponential';
            if (rampType === 'exponential') {
                osc.frequency.exponentialRampToValueAtTime(config.oscillator.frequency.end, config.startTime + config.duration);
            } else {
                osc.frequency.linearRampToValueAtTime(config.oscillator.frequency.end, config.startTime + config.duration);
            }
        }
        
        // Handle detune/LFO modulation
        if (config.oscillator.detune !== undefined) {
            if (typeof config.oscillator.detune === 'number') {
                osc.detune.setValueAtTime(config.oscillator.detune, config.startTime);
            } else {
                osc.detune.setValueAtTime(config.oscillator.detune.value, config.startTime);
                if (config.oscillator.detune.lfo) {
                    const lfo = audioContext.createOscillator();
                    lfo.type = 'sine';
                    lfo.frequency.value = config.oscillator.detune.lfo.freq;
                    const lfoGain = audioContext.createGain();
                    lfoGain.gain.value = config.oscillator.detune.lfo.depth;
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.detune);
                    lfo.start(config.startTime);
                    lfo.stop(config.startTime + config.duration);
                }
            }
        }
        
        source = osc;
        nodes.push(osc);
    }
    
    // Create filter if specified
    if (config.filter) {
        const filter = audioContext.createBiquadFilter();
        filter.type = config.filter.type;
        
        if (typeof config.filter.frequency === 'number') {
            filter.frequency.setValueAtTime(config.filter.frequency, config.startTime);
        } else {
            filter.frequency.setValueAtTime(config.filter.frequency.start, config.startTime);
            const rampTime = config.filter.frequency.rampTime || config.duration * 0.8;
            filter.frequency.exponentialRampToValueAtTime(config.filter.frequency.end, config.startTime + rampTime);
        }
        
        if (config.filter.Q !== undefined) {
            filter.Q.value = config.filter.Q;
        }
        
        nodes.push(filter);
    }
    
    // Create distortion if specified
    if (config.distortion) {
        const distortion = audioContext.createWaveShaper();
        // @ts-expect-error - TypeScript is overly strict about Float32Array generic type parameter
        distortion.curve = config.distortion.curve;
        distortion.oversample = config.distortion.oversample || 'none';
        nodes.push(distortion);
    }
    
    // Create panner if specified
    if (config.panner) {
        const panner = audioContext.createStereoPanner();
        if (typeof config.panner.pan === 'number') {
            panner.pan.setValueAtTime(config.panner.pan, config.startTime);
        } else {
            panner.pan.setValueAtTime(config.panner.pan.start, config.startTime);
            panner.pan.linearRampToValueAtTime(config.panner.pan.end, config.startTime + config.duration);
        }
        nodes.push(panner);
    }
    
    // Create envelope (always last before destination)
    const envelope = audioContext.createGain();
    envelope.gain.setValueAtTime(0, config.startTime);
    envelope.gain.linearRampToValueAtTime(config.envelope.volume, config.startTime + config.envelope.attack);
    
    if (config.envelope.decay !== undefined && config.envelope.sustain !== undefined) {
        const sustainTime = config.startTime + config.envelope.attack + config.envelope.decay;
        envelope.gain.linearRampToValueAtTime(config.envelope.volume * config.envelope.sustain, sustainTime);
        const releaseTime = sustainTime + (config.duration - config.envelope.attack - config.envelope.decay - config.envelope.release);
        envelope.gain.setValueAtTime(config.envelope.volume * config.envelope.sustain, releaseTime);
        if (config.envelope.useLinearDecay) {
            envelope.gain.linearRampToValueAtTime(0, config.startTime + config.duration);
        } else {
            envelope.gain.exponentialRampToValueAtTime(0.001, config.startTime + config.duration);
        }
    } else {
        // Simple AD envelope
        if (config.envelope.useLinearDecay) {
            envelope.gain.linearRampToValueAtTime(0, config.startTime + config.duration);
        } else {
            envelope.gain.exponentialRampToValueAtTime(0.001, config.startTime + config.duration);
        }
    }
    
    nodes.push(envelope);
    
    // Connect all nodes in sequence
    for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].connect(nodes[i + 1]);
    }
    
    // Connect last node to destination
    nodes[nodes.length - 1].connect(destination);
    
    // Start/stop source if it's an oscillator
    if (source instanceof OscillatorNode) {
        source.start(config.startTime);
        source.stop(config.startTime + config.duration);
    }
    
    return { oscillator: source instanceof OscillatorNode ? source : undefined, nodes };
}

/**
 * Creates filtered noise with envelope (common pattern for whooshes, impacts, etc.)
 */
function createFilteredNoiseChain(
    audioContext: AudioContext,
    sfxGain: GainNode,
    whiteNoiseBuffer: AudioBuffer,
    now: number,
    duration: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number | null,
    q: number = 1,
    attack: number = 0.01,
    volume: number = 0.7,
    startTime: number | null = null
): void {
    const actualStartTime = startTime ?? now;
    const noise = audioContext.createBufferSource();
    noise.buffer = whiteNoiseBuffer;
    noise.loop = true;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, actualStartTime);
    if (endFreq !== null) {
        filter.frequency.exponentialRampToValueAtTime(endFreq, actualStartTime + duration * 0.8);
    }
    filter.Q.value = q;
    
    const envelope = audioContext.createGain();
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfxGain);
    
    envelope.gain.setValueAtTime(0, actualStartTime);
    envelope.gain.linearRampToValueAtTime(volume, actualStartTime + attack);
    envelope.gain.exponentialRampToValueAtTime(0.001, actualStartTime + duration);
    
    noise.start(actualStartTime);
    noise.stop(actualStartTime + duration);
}

/**
 * Creates and plays an oscillator with a gain envelope.
 * This is the most common pattern in sound generation.
 * @deprecated Use createAudioChain for new code, but kept for backward compatibility
 */
function createEnvelopeOscillator(
    audioContext: AudioContext,
    sfxGain: GainNode,
    now: number,
    type: OscillatorType,
    freq: number,
    duration: number,
    attack: number = 0.01,
    volume: number = 0.7,
    useLinearDecay: boolean = false
): void {
    createAudioChain(audioContext, sfxGain, {
        oscillator: { type, frequency: freq },
        envelope: { attack, release: duration, volume, useLinearDecay },
        startTime: now,
        duration
    });
}

/**
 * Creates and plays an oscillator with frequency ramping.
 * @deprecated Use createAudioChain for new code, but kept for backward compatibility
 */
function createRampOscillator(
    audioContext: AudioContext,
    sfxGain: GainNode,
    now: number,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    attack: number = 0.01,
    volume: number = 0.7,
    useLinearDecay: boolean = false
): void {
    createAudioChain(audioContext, sfxGain, {
        oscillator: { 
            type, 
            frequency: { start: startFreq, end: endFreq, rampType: 'exponential' }
        },
        envelope: { attack, release: duration, volume, useLinearDecay },
        startTime: now,
        duration
    });
}

/**
 * Creates and plays filtered white noise with an envelope.
 * @deprecated Use createFilteredNoiseChain for new code, but kept for backward compatibility
 */
function createFilteredNoise(
    audioContext: AudioContext,
    sfxGain: GainNode,
    now: number,
    duration: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number | null,
    q: number = 1,
    attack: number = 0.01,
    volume: number = 0.7,
    startTime: number | null = null
): void {
    if (!whiteNoiseBuffer) return;
    createFilteredNoiseChain(audioContext, sfxGain, whiteNoiseBuffer, now, duration, filterType, startFreq, endFreq, q, attack, volume, startTime);
}

function _playProjectileImpactSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Layer 1: Sharp, high-frequency "tick"
    createRampOscillator(audioContext, sfxGain, now, 'triangle', 4000, 1500, 0.08, 0.01, 0.6);
    // Layer 2: A short "shatter" noise burst
    playNoise(0.06, 7000, 'highpass', 0.4);
}

function _playCorrosiveImpactSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    if (!whiteNoiseBuffer) return;
    
    // Layer 1: Initial sharp impact "splat" - combines impact and liquid
    const splatDuration = 0.2;
    createFilteredNoiseChain(audioContext, sfxGain, whiteNoiseBuffer, now, splatDuration, 'bandpass', 3000, 400, 2, 0.01, 0.8);

    // Layer 2: Lingering sizzle with LFO modulation for "bubbling" effect
    const sizzleDuration = 0.7;
    const sizzleNoise = audioContext.createBufferSource();
    sizzleNoise.buffer = whiteNoiseBuffer;
    sizzleNoise.loop = true;
    
    const sizzleFilter = audioContext.createBiquadFilter();
    sizzleFilter.type = 'highpass';
    sizzleFilter.frequency.setValueAtTime(5000, now);
    sizzleFilter.Q.value = 8;

    // LFO to modulate the filter frequency for a "bubbling" effect
    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 30;
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 1500;
    lfo.connect(lfoGain);
    lfoGain.connect(sizzleFilter.frequency);
    lfo.start(now);
    lfo.stop(now + sizzleDuration);

    const sizzleEnvelope = audioContext.createGain();
    sizzleNoise.connect(sizzleFilter);
    sizzleFilter.connect(sizzleEnvelope);
    sizzleEnvelope.connect(sfxGain);

    // This envelope starts slightly after the splat to not overpower it
    sizzleEnvelope.gain.setValueAtTime(0, now + 0.05);
    sizzleEnvelope.gain.linearRampToValueAtTime(0.5, now + 0.1);
    sizzleEnvelope.gain.exponentialRampToValueAtTime(0.001, now + sizzleDuration);

    sizzleNoise.start(now);
    sizzleNoise.stop(now + sizzleDuration);
}

function _playCorrosiveTickSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    playNoise(0.15, 6000, 'highpass', 0.4);
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 400, 800, 0.15, 0.02, 0.3);
}

function _playShieldClankSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'triangle', 2500, 1800, 0.1, 0.01, 0.6);
    playNoise(0.08, 4000, 'highpass', 0.5);
}

function _playShootSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'triangle', 880, 220, 0.1, 0.01, 0.8, true);
}

function _playShootEmpoweredSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // High-frequency "crack"
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 660, 110, 0.15, 0.01, 0.8, true);
    // Low-frequency "thump" for bass
    createRampOscillator(audioContext, sfxGain, now, 'sine', 120, 60, 0.1, 0.02, 1.0, true);
    // Add a noise burst for a 'plasma' feel
    playNoise(0.1, 1000, 'bandpass', 0.4);
}

function _playExplosionSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    if (!whiteNoiseBuffer) return;
    // --- Core BOOM ---
    // Layer 1: Punchy mid-bass with distortion
    const punchOsc = audioContext.createOscillator();
    punchOsc.type = 'sawtooth';
    punchOsc.frequency.setValueAtTime(600, now);
    punchOsc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

    const distortion = audioContext.createWaveShaper();
    // ✅ OPTIMIZATION: Cache distortion curve to avoid per-explosion allocation
    if (!distortionCurveCache) {
        distortionCurveCache = new Float32Array(new ArrayBuffer(256 * 4)); // 4 bytes per float
        for (let i = 0; i < 256; i++) {
            const x = i * 2 / 255 - 1;
            const k = 10; // Distortion amount
            distortionCurveCache[i] = (1 + k) * x / (1 + k * Math.abs(x));
        }
    }
    // @ts-expect-error - TypeScript is overly strict about Float32Array generic type parameter
    distortion.curve = distortionCurveCache;
    distortion.oversample = '4x';

    const punchEnvelope = audioContext.createGain();
    punchEnvelope.gain.setValueAtTime(0, now);
    punchEnvelope.gain.linearRampToValueAtTime(0.25, now + 1.5); // Longer attack for a softer, 'thumpier' sound
    punchEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    punchOsc.connect(distortion);
    distortion.connect(punchEnvelope);
    punchEnvelope.connect(sfxGain);

    punchOsc.start(now);
    punchOsc.stop(now + 0.2);

    // Layer 2: Deep sub-bass
    const subOsc = audioContext.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(320, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.25);

    const subEnvelope = audioContext.createGain();
    subEnvelope.gain.setValueAtTime(0, now);
    subEnvelope.gain.linearRampToValueAtTime(1.2, now + 0.15);
    subEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    subOsc.connect(subEnvelope);
    subEnvelope.connect(sfxGain);

    subOsc.start(now);
    subOsc.stop(now + 0.35);

    // --- Texture & Tail ---
    // Layer 3: White noise crackle/hiss
    const noiseDuration = 0.4;
    const noise = audioContext.createBufferSource();
    noise.buffer = whiteNoiseBuffer;
    noise.loop = true;

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(6000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(800, now + noiseDuration * 0.75);
    noiseFilter.Q.value = 5;

    const noiseEnvelope = audioContext.createGain();
    noiseEnvelope.gain.setValueAtTime(0, now);
    noiseEnvelope.gain.linearRampToValueAtTime(0.7, now + 0.01);
    noiseEnvelope.gain.linearRampToValueAtTime(0.4, now + 0.1);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(sfxGain);
    
    noise.start(now);
    noise.stop(now + noiseDuration);

    // Layer 4: Transient Click/Snap
    const clickOsc = audioContext.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(120, now);
    clickOsc.frequency.exponentialRampToValueAtTime(400, now + 0.25); // Longer decay

    const clickEnvelope = audioContext.createGain();
    clickEnvelope.gain.setValueAtTime(0, now);
    clickEnvelope.gain.linearRampToValueAtTime(0.6, now + 0.005);
    clickEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.05); // Longer decay

    clickOsc.connect(clickEnvelope);
    clickEnvelope.connect(sfxGain);
    
    clickOsc.start(now);
    clickOsc.stop(now + 0.05); // Match new decay time
}

function _playEnemyShootSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createEnvelopeOscillator(audioContext, sfxGain, now, 'square', 440, 0.1, 0.02, 0.6, true);
}

function _playGameOverSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 440, 110, 0.8, 0.05, 0.9, true);
}

function _playShieldPowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    const duration = 0.4;
    // Part 1: Layered Whoosh
    if (whiteNoiseBuffer) {
        // Whoosh 1: Lowpass sweep
        createFilteredNoiseChain(audioContext, sfxGain, whiteNoiseBuffer, now, duration, 'lowpass', 100, 1500, 3, 0.02, 0.7);
        
        // Whoosh 2: Bandpass sweep
        createFilteredNoiseChain(audioContext, sfxGain, whiteNoiseBuffer, now, duration * 0.5, 'bandpass', 400, 4000, 5, 0.01, 0.5);
    }
    
    // Part 2: Shimmering, delayed chimes
    const freqs = [659, 830, 987]; // E5, G#5, B5
    const delay = audioContext.createDelay(0.5); delay.delayTime.value = 0.12;
    const feedback = audioContext.createGain(); feedback.gain.value = 0.4;
    delay.connect(feedback); feedback.connect(delay);
    const panner = audioContext.createStereoPanner();
    delay.connect(panner); panner.connect(sfxGain);
    
    freqs.forEach((freq, i) => {
        const time = now + i * 0.07;
        const osc = audioContext.createOscillator(); osc.type = 'triangle';
        const vibrato = audioContext.createOscillator(); vibrato.frequency.value = 8;
        const vibratoGain = audioContext.createGain(); vibratoGain.gain.value = 5; // 5 cents vibrato
        vibrato.connect(vibratoGain); vibratoGain.connect(osc.detune);
        
        const envelope = audioContext.createGain();
        osc.connect(envelope); envelope.connect(sfxGain); envelope.connect(delay);

        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(0.6, time + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        
        osc.frequency.setValueAtTime(freq, time);
        vibrato.start(time); vibrato.stop(time + 0.25);
        osc.start(time); osc.stop(time + 0.25);
    });

    // Part 3: Final Pneumatic Thump
    const finalTime = now + duration;
    playNoise(0.15, 7000, 'highpass', 0.6); // Hiss
    
    // Use createAudioChain for thump with distortion
    const thumpCurve = new Float32Array(new ArrayBuffer(3 * 4)); // 3 floats
    thumpCurve[0] = -0.8;
    thumpCurve[1] = 0;
    thumpCurve[2] = 0.8;
    createAudioChain(audioContext, sfxGain, {
        oscillator: {
            type: 'sine',
            frequency: { start: 120, end: 30, rampType: 'exponential' }
        },
        distortion: {
            curve: thumpCurve
        },
        envelope: {
            attack: 0.01,
            release: 0.15,
            volume: 0.9
        },
        startTime: finalTime,
        duration: 0.15
    });
}

function _playRapidFirePowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Part 1: Soft whoosh spool-up
    if (whiteNoiseBuffer) {
        createFilteredNoiseChain(audioContext, sfxGain, whiteNoiseBuffer, now, 0.1, 'bandpass', 200, 2500, 4, 0.01, 0.4);
    }
    
    // Part 2: Rapid ascending synth tones
    const freqs = [880, 1046, 1318, 1568]; // A5, C6, E6, G6
    freqs.forEach((freq, i) => {
        const time = now + 0.08 + i * 0.04;
        const osc = audioContext.createOscillator(); osc.type = 'sine';
        const env = audioContext.createGain();
        osc.connect(env); env.connect(sfxGain);
        env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(0.5, time + 0.01); env.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        osc.frequency.value = freq;
        osc.start(time); osc.stop(time + 0.08);
    });

    // Part 3: Smoother, sustained high-frequency hum with tremolo
    const humTime = now + 0.25;
    const humDuration = 0.3;
    const humOsc = audioContext.createOscillator(); humOsc.type = 'triangle'; humOsc.frequency.value = 1800; // High pitch
    const tremolo = audioContext.createOscillator(); tremolo.type = 'sine'; tremolo.frequency.value = 25; // Fast but smooth tremolo
    const tremoloGain = audioContext.createGain(); tremoloGain.gain.setValueAtTime(0.3, humTime);
    const humEnv = audioContext.createGain();
    
    humOsc.connect(humEnv); humEnv.connect(sfxGain);
    tremolo.connect(tremoloGain); tremoloGain.connect(humEnv.gain);
    
    humEnv.gain.setValueAtTime(0.2, humTime); // Start at a lower gain, ramp up via LFO
    
    humOsc.start(humTime); humOsc.stop(humTime + humDuration);
    tremolo.start(humTime); tremolo.stop(humTime + humDuration);

    // Part 4: Final confirmation ping
    const pingTime = humTime + humDuration;
    const pingOsc = audioContext.createOscillator(); pingOsc.type = 'sine'; pingOsc.frequency.value = 3000;
    const pingEnv = audioContext.createGain();
    pingOsc.connect(pingEnv); pingEnv.connect(sfxGain);
    pingEnv.gain.setValueAtTime(0, pingTime); pingEnv.gain.linearRampToValueAtTime(0.6, pingTime + 0.01); pingEnv.gain.exponentialRampToValueAtTime(0.001, pingTime + 0.15);
    pingOsc.start(pingTime); pingOsc.stop(pingTime + 0.15);
}

function _playSpreadShotPowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // "Aetherial Fifth Cascade" - A complex, spacious sound with pitch bending, fifths, delay, and reverb.

    // Lazily create and cache the reverb impulse response for performance.
    createSpreadShotReverb(audioContext);
    if (!spreadShotReverbBuffer) return;

    const projectileDelay = 0.04;
    const stagger = 0.06;

    // --- Part 1: Effects Bus Setup (Delay + Reverb) ---
    const wetSend = audioContext.createGain();
    wetSend.gain.value = 0.6; // Amount of signal sent to the effects bus

    const delay = audioContext.createDelay(0.5);
    delay.delayTime.value = 0.12;

    const feedback = audioContext.createGain();
    feedback.gain.value = 0.45;
    
    const reverb = audioContext.createConvolver();
    reverb.buffer = spreadShotReverbBuffer;
    reverb.normalize = true;

    // Routing: Signal -> WetSend -> Delay -> Reverb -> Master
    //          Delay -> Feedback -> Delay (loop)
    wetSend.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(reverb);
    reverb.connect(sfxGain);


    // --- Part 2: Projectile Sound Generation ---
    const createProjectileSound = (startTime: number, freq: number, pan: number) => {
        const osc = audioContext.createOscillator();
        osc.type = 'sine';

        // Fast downward pitch bend for a "zap"
        osc.frequency.setValueAtTime(freq * 3, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.08);

        const env = audioContext.createGain();
        const panner = audioContext.createStereoPanner();
        
        osc.connect(env);
        env.connect(panner);
        panner.pan.setValueAtTime(pan, startTime);

        // Send to both dry output and wet effects bus
        panner.connect(sfxGain); // Dry signal
        panner.connect(wetSend);  // Wet signal

        env.gain.setValueAtTime(0, startTime);
        env.gain.linearRampToValueAtTime(0.7, startTime + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2); // Ramp to effective silence

        osc.start(startTime);
        // Keep oscillator alive for 2 seconds to allow reverb/delay tail to finish.
        // It is silent after 0.2s due to the gain envelope.
        osc.stop(startTime + 2.0);
    };

    // Frequencies based on stacked perfect fifths for a heroic, open sound
    const baseFreq = 523.25; // C5
    const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 1.5 * 1.5]; // C5, G5, D6
    const pans = [-0.9, 0.9, 0]; // Left, Right, Center
    
    createProjectileSound(now + projectileDelay, freqs[0], pans[0]);
    createProjectileSound(now + projectileDelay + stagger, freqs[1], pans[1]);
    createProjectileSound(now + projectileDelay + stagger * 2, freqs[2], pans[2]);
}

function _playExtendedMagPowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Part 1: Ascending Major Arpeggio with Ping-Pong Delay
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const delay = audioContext.createDelay(0.3); delay.delayTime.value = 0.08;
    const feedback = audioContext.createGain(); feedback.gain.value = 0.5;
    const panner = audioContext.createStereoPanner();
    
    delay.connect(feedback); feedback.connect(panner); panner.connect(delay);
    panner.connect(sfxGain);
    
    freqs.forEach((freq, i) => {
        const time = now + i * 0.06;
        const osc = audioContext.createOscillator(); osc.type = 'triangle';
        const env = audioContext.createGain();
        osc.connect(env); env.connect(sfxGain); env.connect(delay);

        // Pan notes alternatingly for stereo effect
        panner.pan.setValueAtTime(i % 2 === 0 ? -0.8 : 0.8, time);

        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.5, time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.start(time);
        osc.stop(time + 0.2);
    });

    // Part 2: High-tech Click/Bloop confirmation
    const finalTime = now + 0.3;
    // Click
    playNoise(0.05, 5000, 'highpass', 0.6);
    // Bloop
    const bloop = audioContext.createOscillator(); bloop.type = 'sine';
    bloop.frequency.setValueAtTime(400, finalTime); bloop.frequency.exponentialRampToValueAtTime(200, finalTime + 0.1);
    const bloopEnv = audioContext.createGain();
    bloop.connect(bloopEnv); bloopEnv.connect(sfxGain);
    bloopEnv.gain.setValueAtTime(0, finalTime); bloopEnv.gain.linearRampToValueAtTime(0.7, finalTime + 0.01); bloopEnv.gain.exponentialRampToValueAtTime(0.001, finalTime + 0.1);
    bloop.start(finalTime);
    bloop.stop(finalTime + 0.1);
}

function _playAutoReloadPowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    const duration = 0.4;
    const notes = [600, 800, 1000];

    // Electrical crackle that builds
    if (whiteNoiseBuffer) {
        const noise = audioContext.createBufferSource();
        noise.buffer = whiteNoiseBuffer;
        noise.loop = true;
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 6000;

        const lfo = audioContext.createOscillator();
        lfo.type = 'square';
        lfo.frequency.setValueAtTime(20, now);
        lfo.frequency.linearRampToValueAtTime(80, now + duration);
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = 0.6;
        lfo.connect(lfoGain);

        const envelope = audioContext.createGain();
        lfoGain.connect(envelope.gain);
        
        noise.connect(filter);
        filter.connect(envelope);
        envelope.connect(sfxGain);

        lfo.start(now); lfo.stop(now + duration);
        noise.start(now); noise.stop(now + duration);
    }

    // Repeated, ascending chimes
    for (let i = 0; i < 2; i++) {
        notes.forEach((j, freq) => {
            const time = now + i * 0.18 + j * 0.06;
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const panner = audioContext.createStereoPanner();
            panner.pan.value = -0.8 + ((i * 3 + j) / 5) * 1.6;

            const envelope = audioContext.createGain();
            envelope.gain.setValueAtTime(0, time);
            envelope.gain.linearRampToValueAtTime(0.6, time + 0.01);
            envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
            
            osc.connect(panner);
            panner.connect(envelope);
            envelope.connect(sfxGain);
            
            osc.start(time);
            osc.stop(time + 0.1);
        });
    }

    // Final "zap"
    const zapTime = now + duration;
    const zapOsc = audioContext.createOscillator();
    zapOsc.type = 'sawtooth';
    zapOsc.frequency.setValueAtTime(2000, zapTime);
    zapOsc.frequency.exponentialRampToValueAtTime(200, zapTime + 0.1);
    const zapEnv = audioContext.createGain();
    zapOsc.connect(zapEnv);
    zapEnv.connect(sfxGain);
    zapEnv.gain.setValueAtTime(0, zapTime);
    zapEnv.gain.linearRampToValueAtTime(0.8, zapTime + 0.01);
    zapEnv.gain.exponentialRampToValueAtTime(0.001, zapTime + 0.1);
    zapOsc.start(zapTime);
    zapOsc.stop(zapTime + 0.1);
}

function _playCritBoostPowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Part 1: Panning scanner whoosh
    if (whiteNoiseBuffer) {
        const whoosh = audioContext.createBufferSource(); whoosh.buffer = whiteNoiseBuffer;
        const filter = audioContext.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 8; filter.frequency.value = 1200;
        const panner = audioContext.createStereoPanner();
        const env = audioContext.createGain();
        whoosh.connect(filter); filter.connect(panner); panner.connect(env); env.connect(sfxGain);
        
        panner.pan.setValueAtTime(-1, now); panner.pan.linearRampToValueAtTime(1, now + 0.15);
        env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.7, now + 0.02); env.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        whoosh.start(now); whoosh.stop(now + 0.15);
    }
    
    // Part 2: Cross-panned harmonic pings
    const pingTime = now + 0.1;
    const freqs = [659, 987]; // E5, B5
    freqs.forEach((freq, i) => {
        const osc = audioContext.createOscillator(); osc.type = 'sine';
        const panner = audioContext.createStereoPanner();
        const env = audioContext.createGain();
        osc.connect(panner); panner.connect(env); env.connect(sfxGain);
        
        osc.frequency.value = freq;
        panner.pan.setValueAtTime(i === 0 ? -0.8 : 0.8, pingTime);
        panner.pan.linearRampToValueAtTime(i === 0 ? 0.8 : -0.8, pingTime + 0.1);
        
        env.gain.setValueAtTime(0, pingTime); env.gain.linearRampToValueAtTime(0.5, pingTime + 0.01); env.gain.exponentialRampToValueAtTime(0.001, pingTime + 0.1);
        
        osc.start(pingTime);
        osc.stop(pingTime + 0.1);
    });

    // Part 3: Final major 7th chord
    const chordTime = now + 0.25;
    const baseFreq = 261.63; // C4
    const ratios = [1, 5/4, 3/2, 15/8]; // Major 7th chord ratios
    
    // Create a reverb for the chord
    const convolver = audioContext.createConvolver();
    const impulse = audioContext.createBuffer(2, audioContext.sampleRate * 1.5, audioContext.sampleRate);
    for(let c=0; c < impulse.numberOfChannels; c++) {
        const data = impulse.getChannelData(c);
        for (let j = 0; j < data.length; j++) { data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / data.length, 2); }
    }
    convolver.buffer = impulse;
    const wet = audioContext.createGain(); wet.gain.value = 0.5;
    convolver.connect(wet); wet.connect(sfxGain);
    
    ratios.forEach(ratio => {
        const osc = audioContext.createOscillator(); osc.type = 'sine';
        const env = audioContext.createGain();
        osc.connect(env);
        env.connect(sfxGain);
        env.connect(convolver); // Send to reverb
        
        osc.frequency.value = baseFreq * ratio * 2; // C5 Major 7th
        env.gain.setValueAtTime(0, chordTime);
        env.gain.linearRampToValueAtTime(0.6, chordTime + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.2);
        
        osc.start(chordTime); osc.stop(chordTime + 1.2);
    });
}

function _playReloadBoostPowerUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // A powerful, two-part sound: a rising polyphonic sheen followed by a heavy, reverberant KLANG.
    
    // Part 1: Rising Sheen
    const sheenDuration = 0.15;
    for (let i = 0; i < 3; i++) {
        const osc = audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200 + i * 4, now); // Detuned
        osc.frequency.exponentialRampToValueAtTime(4000, now + sheenDuration);
        const env = audioContext.createGain();
        osc.connect(env);
        env.connect(sfxGain);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.4, now + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + sheenDuration);
        osc.start(now);
        osc.stop(now + sheenDuration);
    }
    
    // Part 2: Heavy KLANG
    const klangTime = now + sheenDuration - 0.05;
    const klangDuration = 0.4;
    const klangOutput = audioContext.createGain();

    // Create a gated reverb effect
    const convolver = audioContext.createConvolver();
    const impulse = audioContext.createBuffer(2, audioContext.sampleRate * 1.2, audioContext.sampleRate);
    for(let i=0; i < impulse.numberOfChannels; i++) {
        const data = impulse.getChannelData(i);
        for (let j = 0; j < data.length; j++) {
            data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / data.length, 2.5);
        }
    }
    convolver.buffer = impulse;
    klangOutput.connect(convolver);
    convolver.connect(sfxGain);
    
    // Metallic components
    const freqs = [300, 453.4, 610.2];
    freqs.forEach(freq => {
        const osc = audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, klangTime);
        const env = audioContext.createGain();
        osc.connect(env);
        env.connect(klangOutput);
        env.gain.setValueAtTime(0, klangTime);
        env.gain.linearRampToValueAtTime(0.5, klangTime + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, klangTime + klangDuration);
        osc.start(klangTime);
        osc.stop(klangTime + klangDuration);
    });

    // Noise component for impact
    if (whiteNoiseBuffer) {
        const noise = audioContext.createBufferSource();
        noise.buffer = whiteNoiseBuffer;
        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4000;
        filter.Q.value = 3;
        const env = audioContext.createGain();
        noise.connect(filter);
        filter.connect(env);
        env.connect(klangOutput);
        env.gain.setValueAtTime(0, klangTime);
        env.gain.linearRampToValueAtTime(0.6, klangTime + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, klangTime + 0.1);
        noise.start(klangTime);
        noise.stop(klangTime + 0.1);
    }
}

function _playCriticalHitSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    playNoise(0.6, 200, 'lowpass');
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 2000, 100, 0.3, 0.01, 0.7);
}

function _playShieldBreakSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 1000, 300, 0.3, 0.02, 0.8, true);
    playNoise(0.3, 3000, 'bandpass');
}

function _playShieldHitSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sine', 2000, 1000, 0.1, 0.01, 0.7);
}

function _playGammaShieldHitSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sine', 1000, 500, 0.15, 0.01, 0.8);
}

function _playLevelUpSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Note: Multi-segment frequency ramps require manual setup
    // This could be enhanced in createAudioChain later, but for now we keep manual approach
    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth';
    const envelope = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';

    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfxGain);

    // Pitch sweep up (multi-segment)
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1320, now + 0.3);

    // Filter sweep up
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);

    // Volume envelope
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.8, now + 0.05);
    envelope.gain.linearRampToValueAtTime(0, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);
}

function _playPurchaseSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Two oscillators sharing an envelope - createAudioChain handles one source, so we do this manually
    const osc1 = audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, now); // C6
    const osc2 = audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1396.91, now); // F6
    const envelope = audioContext.createGain();
    osc1.connect(envelope);
    osc2.connect(envelope);
    envelope.connect(sfxGain);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.6, now + 0.05);
    envelope.gain.linearRampToValueAtTime(0, now + 0.2);
    osc1.start(now);
    osc2.start(now + 0.1);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
}

function _playReviveSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createAudioChain(audioContext, sfxGain, {
        oscillator: {
            type: 'sine',
            frequency: { start: 523.25, end: 2093.00, rampType: 'exponential' } // C5 to C7
        },
        filter: {
            type: 'lowpass',
            frequency: 2000,
            Q: 5
        },
        envelope: {
            attack: 0.1,
            release: 0.8,
            volume: 0.9,
            useLinearDecay: true
        },
        startTime: now,
        duration: 0.8
    });
}

function _playUpgradeStartSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    playNoise(0.4, 800, 'lowpass');
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 110, 440, 0.4, 0.05, 0.5, true);
}

function _playPartCollectSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createEnvelopeOscillator(audioContext, sfxGain, now, 'sine', 1500, 0.1, 0.05, 0.6, true);
}

function _playBossHitSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // A deep, metallic thud
    playNoise(0.2, 250, 'lowpass', 1.2);
    createRampOscillator(audioContext, sfxGain, now, 'square', 150, 80, 0.15, 0.01, 1.0, true);
}

function _playLaserShootSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Charge up sound
    const chargeOsc = audioContext.createOscillator();
    chargeOsc.type = 'sawtooth';
    chargeOsc.frequency.setValueAtTime(50, now);
    chargeOsc.frequency.exponentialRampToValueAtTime(400, now + C.PUNISHER_LASER_CHARGE_TIME / 1000); // match charge time
    const chargeEnvelope = audioContext.createGain();
    chargeOsc.connect(chargeEnvelope);
    chargeEnvelope.connect(sfxGain);
    chargeEnvelope.gain.setValueAtTime(0, now);
    chargeEnvelope.gain.linearRampToValueAtTime(0.4, now + 0.05);
    chargeEnvelope.gain.setValueAtTime(0.4, now + (C.PUNISHER_LASER_CHARGE_TIME / 1000) - 0.05);
    chargeEnvelope.gain.linearRampToValueAtTime(0, now + C.PUNISHER_LASER_CHARGE_TIME / 1000);
    chargeOsc.start(now);
    chargeOsc.stop(now + C.PUNISHER_LASER_CHARGE_TIME / 1000);

    // Fire sound - Use the shared, pre-generated noise buffer
    const fireTime = now + C.PUNISHER_LASER_CHARGE_TIME / 1000;
    const totalFireDuration = C.PUNISHER_LASER_FIRE_TIME / 1000;
    
    if (!whiteNoiseBuffer) return; // Safety check

    const noise = audioContext.createBufferSource();
    noise.buffer = whiteNoiseBuffer;
    noise.loop = true;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, fireTime);
    filter.Q.value = 5;
    const envelope = audioContext.createGain();
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfxGain);

    envelope.gain.setValueAtTime(0, fireTime);
    envelope.gain.linearRampToValueAtTime(0.9, fireTime + 0.02);
    envelope.gain.linearRampToValueAtTime(0, fireTime + totalFireDuration);
    
    noise.start(fireTime);
    noise.stop(fireTime + totalFireDuration);
}

function _playEmpArcSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // Initial sharp "crack"
    playNoise(0.15, 6000, 'bandpass', 0.8);
    // Lingering electrical hum
    createEnvelopeOscillator(audioContext, sfxGain, now, 'sawtooth', 60, 0.4, 0.05, 0.3);
}

function _playEncounterGoodSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        const envelope = audioContext.createGain();
        osc.connect(envelope);
        envelope.connect(sfxGain);
        envelope.gain.setValueAtTime(0, now + i * 0.1);
        envelope.gain.linearRampToValueAtTime(0.7, now + i * 0.1 + 0.05);
        envelope.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.2);
    });
}

function _playEncounterBadSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 300, 100, 0.5, 0.05, 0.8, true);
    playNoise(0.5, 800, 'lowpass');
}

function _playSecretFoundSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    // A clearer, more melodic, and drawn-out "secret found" chime.
    const freqs = [523.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, G5, C6, E6, G6
    const noteLength = 0.4;
    const noteStagger = 0.15;

    for (let i = 0; i < freqs.length; i++) {
        const osc = audioContext.createOscillator();
        osc.type = 'sine'; // Sine is a pure, clean tone, good for chimes.
        osc.frequency.setValueAtTime(freqs[i], now + i * noteStagger);

        const envelope = audioContext.createGain();
        osc.connect(envelope);
        envelope.connect(sfxGain);

        // Short attack, slightly longer decay to give it a "chime" or "bell" feel.
        envelope.gain.setValueAtTime(0, now + i * noteStagger);
        envelope.gain.linearRampToValueAtTime(0.7, now + i * noteStagger + 0.02); // Quick attack
        envelope.gain.exponentialRampToValueAtTime(0.001, now + i * noteStagger + noteLength); // Slower decay

        osc.start(now + i * noteStagger);
        osc.stop(now + i * noteStagger + noteLength);
    }
    // Add a bassier root note for foundation.
    const rootOsc = audioContext.createOscillator();
    rootOsc.type = 'triangle'; // A little warmer than sine
    rootOsc.frequency.setValueAtTime(261.63, now); // C4

    const rootEnvelope = audioContext.createGain();
    rootOsc.connect(rootEnvelope);
    rootEnvelope.connect(sfxGain);

    rootEnvelope.gain.setValueAtTime(0, now);
    rootEnvelope.gain.linearRampToValueAtTime(0.4, now + 0.05);
    rootEnvelope.gain.exponentialRampToValueAtTime(0.001, now + noteLength + (freqs.length * noteStagger));

    rootOsc.start(now);
    rootOsc.stop(now + noteLength + (freqs.length * noteStagger));
}

function _playWeaverBeamSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    if (!whiteNoiseBuffer) return;
    // A high-frequency crackle/hiss
    createFilteredNoise(audioContext, sfxGain, now, 0.3, 'bandpass', 4000, 8000, 20, 0.02, 0.5);
}

function _playWeaverSurgeSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sawtooth', 200, 100, 0.5, 0.05, 0.6, true);
}

function _playTrainingTargetHitSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createEnvelopeOscillator(audioContext, sfxGain, now, 'sine', 1000, 0.1, 0.01, 0.5, true);
}

function _playTrainingTargetSuccessSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createRampOscillator(audioContext, sfxGain, now, 'sine', 1200, 1800, 0.2, 0.02, 0.7, true);
}

function _playTrainingTargetFailSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    createEnvelopeOscillator(audioContext, sfxGain, now, 'square', 150, 0.15, 0.01, 0.7, true);
}

function _playPhaseShiftActivateSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    if (!whiteNoiseBuffer) return;
    // Main "whoosh" from noise
    createFilteredNoise(audioContext, sfxGain, now, 0.3, 'bandpass', 400, 5000, 8, 0.05, 0.8);
    // Add a quick sine "click" at the start
    createEnvelopeOscillator(audioContext, sfxGain, now, 'sine', 2000, 0.05, 0.01, 0.5);
}

function _playPhaseShiftDeactivateSound(audioContext: AudioContext, sfxGain: GainNode, now: number) {
    if (!whiteNoiseBuffer) return;
    // Main "whoosh" from noise
    createFilteredNoise(audioContext, sfxGain, now, 0.2, 'bandpass', 4000, 500, 10, 0.02, 0.7);
    // Low "thump"
    createRampOscillator(audioContext, sfxGain, now, 'sine', 150, 80, 0.1, 0.01, 0.8);
}

/**
 * Returns the actual duration of a sound in seconds.
 * Used for accurate sound counter tracking.
 */
function getSoundDuration(sound: SoundName): number {
    switch (sound) {
        case 'explosion': return 0.4; // Longest layer is 0.4s
        case 'criticalHit': return 0.3;
        case 'bossHit': return 0.2;
        case 'projectileImpact': return 0.08;
        case 'corrosiveImpact': return 0.15;
        case 'corrosiveTick': return 0.1;
        case 'shieldClank': return 0.1;
        case 'shoot': return 0.05;
        case 'shoot_empowered': return 0.1;
        case 'enemyShoot': return 0.1;
        case 'gameOver': return 0.5;
        case 'uiClick': return 0.05;
        case 'powerUpRapidFire': return 0.5;
        case 'powerUpSpreadShot': return 2.0; // Long reverb tail
        case 'powerUpShield': return 0.3;
        case 'powerUpExtendedMag': return 0.4;
        case 'powerUpAutoReload': return 0.3;
        case 'powerUpCritBoost': return 0.4;
        case 'powerUpReloadBoost': return 0.3;
        case 'reload': return 0.2;
        case 'emptyClip': return 0.1;
        case 'shieldBreak': return 0.2;
        case 'shieldHit': return 0.1;
        case 'gammaShieldHit': return 0.1;
        case 'levelUp': return 0.5;
        case 'purchase': return 0.2;
        case 'revive': return 0.4;
        case 'upgradeStart': return 0.1;
        case 'partCollect': return 0.1;
        case 'laserShoot': return 0.1;
        case 'empArc': return 0.2;
        case 'encounterGood': return 0.3;
        case 'encounterBad': return 0.3;
        case 'secretFound': return 0.5;
        case 'weaverBeam': return 0.2;
        case 'weaverSurge': return 0.3;
        case 'trainingTargetHit': return 0.1;
        case 'trainingTargetSuccess': return 0.3;
        case 'trainingTargetFail': return 0.2;
        case 'phaseShiftActivate': return 0.2;
        case 'phaseShiftDeactivate': return 0.1;
        default: return 0.25; // Safe default for any missed sounds
    }
}

/**
 * Plays a sound effect by generating it programmatically.
 * @param sound The name of the sound to play.
 */
export const playSound = (sound: SoundName) => {
    if (!isInitialized || !audioContext || !sfxGain || audioContext.state !== 'running') return;
    
    // ✅ CRITICAL FIX: Simple throttling to prevent audio system overload
    // This only prevents sounds from playing if too many are active - does not modify sound generation
    if (activeSoundCount >= MAX_CONCURRENT_SOUNDS) {
        return; // Skip this sound if we're at capacity
    }
    
    activeSoundCount++;
    // ✅ OPTIMIZATION: Use actual sound duration for accurate counter tracking
    const soundDuration = getSoundDuration(sound);
    setTimeout(() => {
        activeSoundCount = Math.max(0, activeSoundCount - 1);
    }, soundDuration * 1000); // Convert seconds to milliseconds
    
    const now = audioContext.currentTime;

    switch (sound) {
        case 'projectileImpact':
            _playProjectileImpactSound(audioContext, sfxGain, now);
            break;
        case 'corrosiveImpact':
            _playCorrosiveImpactSound(audioContext, sfxGain, now);
            break;
        case 'corrosiveTick':
            _playCorrosiveTickSound(audioContext, sfxGain, now);
            break;
        case 'shieldClank':
            _playShieldClankSound(audioContext, sfxGain, now);
            break;
        case 'uiClick':
            createEnvelopeOscillator(audioContext, sfxGain, now, 'triangle', 1200, 0.05, 0.02, 0.7, true);
            break;
        case 'shoot':
            _playShootSound(audioContext, sfxGain, now);
            break;
        case 'shoot_empowered':
            _playShootEmpoweredSound(audioContext, sfxGain, now);
            break;
        case 'explosion':
            _playExplosionSound(audioContext, sfxGain, now);
            break;
        case 'enemyShoot':
            _playEnemyShootSound(audioContext, sfxGain, now);
            break;
        case 'gameOver':
            _playGameOverSound(audioContext, sfxGain, now);
            break;
        case 'powerUpRapidFire':
            _playRapidFirePowerUpSound(audioContext, sfxGain, now);
            break;
        case 'powerUpSpreadShot':
            _playSpreadShotPowerUpSound(audioContext, sfxGain, now);
            break;
        case 'powerUpShield':
            _playShieldPowerUpSound(audioContext, sfxGain, now);
            break;
        case 'powerUpExtendedMag':
            _playExtendedMagPowerUpSound(audioContext, sfxGain, now);
            break;
        case 'powerUpAutoReload':
            _playAutoReloadPowerUpSound(audioContext, sfxGain, now);
            break;
        case 'powerUpCritBoost':
            _playCritBoostPowerUpSound(audioContext, sfxGain, now);
            break;
        case 'powerUpReloadBoost':
            _playReloadBoostPowerUpSound(audioContext, sfxGain, now);
            break;
        case 'reload':
            playNoise(0.08, 2000, 'bandpass');
            setTimeout(() => { if (isInitialized) playNoise(0.08, 2000, 'bandpass'); }, 100);
            break;
        case 'emptyClip':
            playNoise(0.05, 4000, 'highpass');
            break;
        case 'criticalHit':
            _playCriticalHitSound(audioContext, sfxGain, now);
            break;
        case 'shieldBreak':
            _playShieldBreakSound(audioContext, sfxGain, now);
            break;
        case 'shieldHit':
            _playShieldHitSound(audioContext, sfxGain, now);
            break;
        case 'gammaShieldHit':
            _playGammaShieldHitSound(audioContext, sfxGain, now);
            break;
        case 'levelUp':
            _playLevelUpSound(audioContext, sfxGain, now);
            break;
        case 'purchase':
            _playPurchaseSound(audioContext, sfxGain, now);
            break;
        case 'revive':
            _playReviveSound(audioContext, sfxGain, now);
            break;
        case 'upgradeStart':
            _playUpgradeStartSound(audioContext, sfxGain, now);
            break;
        case 'partCollect':
            _playPartCollectSound(audioContext, sfxGain, now);
            break;
        case 'bossHit':
            _playBossHitSound(audioContext, sfxGain, now);
            break;
        case 'laserShoot':
            _playLaserShootSound(audioContext, sfxGain, now);
            break;
        case 'empArc':
            _playEmpArcSound(audioContext, sfxGain, now);
            break;
        case 'encounterGood':
            _playEncounterGoodSound(audioContext, sfxGain, now);
            break;
        case 'encounterBad':
            _playEncounterBadSound(audioContext, sfxGain, now);
            break;
        case 'secretFound':
            _playSecretFoundSound(audioContext, sfxGain, now);
            break;
        case 'weaverBeam':
            _playWeaverBeamSound(audioContext, sfxGain, now);
            break;
        case 'weaverSurge':
            _playWeaverSurgeSound(audioContext, sfxGain, now);
            break;
        case 'trainingTargetHit':
            _playTrainingTargetHitSound(audioContext, sfxGain, now);
            break;
        case 'trainingTargetSuccess':
            _playTrainingTargetSuccessSound(audioContext, sfxGain, now);
            break;
        case 'trainingTargetFail':
            _playTrainingTargetFailSound(audioContext, sfxGain, now);
            break;
        case 'phaseShiftActivate':
            _playPhaseShiftActivateSound(audioContext, sfxGain, now);
            break;
        case 'phaseShiftDeactivate':
            _playPhaseShiftDeactivateSound(audioContext, sfxGain, now);
            break;
    }
};

/**
 * Sets the master volume for all game sounds.
 * @param volume A value between 0 (silent) and 1 (full volume).
 */
export const setSoundVolume = (volume: number) => {
    sfxVolumeSetting = Math.max(0, Math.min(1, volume));
    if (sfxGain && audioContext) {
        sfxGain.gain.cancelScheduledValues(audioContext.currentTime);
        sfxGain.gain.linearRampToValueAtTime(sfxVolumeSetting, audioContext.currentTime + 0.05);
    }
};

/**
 * Sets the master volume for music.
 * @param volume A value between 0 (silent) and 1 (full volume).
 */
export const setMusicVolume = (volume: number) => {
    musicVolumeSetting = Math.max(0, Math.min(1, volume));
    if (musicGain && audioContext) {
        musicGain.gain.cancelScheduledValues(audioContext.currentTime);
        musicGain.gain.linearRampToValueAtTime(musicVolumeSetting, audioContext.currentTime + 0.05);
    }
};

// Automatically set up the listener when the module loads.
// This ensures that the VERY FIRST user interaction with the page,
// no matter what it is, will unlock the audio context.
(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
        initAudio();
    };

    window.addEventListener('click', unlockAudio, { once: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });

    // Handle audio context suspension on page visibility change to save power.
    document.addEventListener('visibilitychange', () => {
        if (!audioContext) return; // Audio not yet initialized.

        if (document.hidden) {
            // Suspend the audio context to stop all sound processing.
            audioContext.suspend().catch(() => {});
        } else {
            // Resume the audio context when the page is visible again.
            audioContext.resume().catch(() => {});
        }
    });
})();
