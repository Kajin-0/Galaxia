
import * as C from './constants';

// A custom sound engine using the native Web Audio API for guaranteed reliability.

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null; // for music
let isInitialized = false;
let globalVolume = 0.5;
let musicVolume = 0.8; // Request 1: Louder music (~2.5dB)
const FADE_TIME = 0.25; // Request 3: Quick fade in/out duration in seconds

let currentMusicSource: AudioBufferSourceNode | null = null;
let currentTrackUrl: string | null = null;
let queuedMusicUrl: string | null = null; // For handling suspended audio context
const musicBufferCache: { [key: string]: AudioBuffer } = {};


/**
 * Initializes the audio context. Must be called from a user gesture (e.g., a click).
 * This will create the audio context if it doesn't exist, and resume it if it's suspended.
 */
export function initAudio() {
    if (!isInitialized) {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            masterGain = audioContext.createGain();
            masterGain.gain.setValueAtTime(globalVolume, audioContext.currentTime);
            masterGain.connect(audioContext.destination);
            musicGain = audioContext.createGain();
            musicGain.gain.setValueAtTime(0, audioContext.currentTime);
            musicGain.connect(masterGain);
            isInitialized = true;
        } catch (e) {
            console.error("Web Audio API is not supported in this browser", e);
            return;
        }
    }
    
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("AudioContext resumed.");
            // If music was queued because the context was suspended, play it now.
            if (queuedMusicUrl) {
                const urlToPlay = queuedMusicUrl;
                queuedMusicUrl = null; // Clear queue before playing
                playMusic(urlToPlay);
            }
        });
    }
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

    setTimeout(() => {
        sourceToStop.stop();
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
                // Silently fail if music file is not found (e.g., 404 error)
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
        musicGain.gain.linearRampToValueAtTime(musicVolume, audioContext.currentTime + FADE_TIME);

        source.start(0);

    } catch (e) {
        // Silently ignore decoding errors, as requested. This happens when the fetched file is not valid audio data.
        // console.error(`Failed to load or play music track: ${trackUrl}`, e);
        // Reset state on error
        currentMusicSource = null;
        currentTrackUrl = null;
    }
}


export type SoundName = 'shoot' | 'explosion' | 'enemyShoot' | 'gameOver' | 'uiClick' | 'powerUp' | 'reload' | 'emptyClip' | 'criticalHit' | 'shieldBreak' | 'levelUp' | 'purchase' | 'revive' | 'upgradeStart' | 'partCollect' | 'laserShoot' | 'bossHit' | 'empArc' | 'encounterGood' | 'encounterBad' | 'secretFound' | 'weaverBeam' | 'trainingTargetHit' | 'trainingTargetSuccess' | 'trainingTargetFail';

/**
 * A helper function to generate and play a short burst of noise.
 * Used for explosions, clicks, and reloads.
 */
function playNoise(duration: number, frequency: number, type: 'bandpass' | 'lowpass' = 'bandpass', volume = 1) {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;

    // Create a buffer of white noise
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    // Filter the noise to give it a tonal quality
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;

    // Create a gain envelope to shape the volume over time (fade out)
    const envelope = audioContext.createGain();
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(masterGain);

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    noise.start(now);
    noise.stop(now + duration);
}

/**
 * Plays a sound effect by generating it programmatically.
 * @param sound The name of the sound to play.
 */
export const playSound = (sound: SoundName) => {
    if (!isInitialized || !audioContext || !masterGain || audioContext.state !== 'running') return;
    
    const now = audioContext.currentTime;

    switch (sound) {
        case 'uiClick': {
            const osc = audioContext.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, now);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.7, now + 0.02);
            envelope.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        }
        case 'shoot': {
            const osc = audioContext.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.8, now + 0.01);
            envelope.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        }
        case 'explosion':
            playNoise(0.5, 500, 'lowpass');
            break;
        case 'enemyShoot': {
            const osc = audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.6, now + 0.02);
            envelope.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        }
        case 'gameOver': {
            const osc = audioContext.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.8);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.9, now + 0.05);
            envelope.gain.linearRampToValueAtTime(0, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
            break;
        }
        case 'powerUp': {
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.9, now + 0.02);
            envelope.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        }
        case 'reload':
            playNoise(0.08, 2000);
            setTimeout(() => { if (isInitialized) playNoise(0.08, 2000); }, 100);
            break;
        case 'emptyClip':
            playNoise(0.05, 4000);
            break;
        case 'criticalHit': {
            playNoise(0.6, 200, 'lowpass');
            const osc = audioContext.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(2000, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.7, now + 0.01);
            envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        }
        case 'shieldBreak': {
            const osc = audioContext.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1000, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.8, now + 0.02);
            envelope.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            playNoise(0.3, 3000, 'bandpass');
            break;
        }
        case 'levelUp': {
            const osc = audioContext.createOscillator();
            osc.type = 'sawtooth';
            const envelope = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            osc.connect(filter);
            filter.connect(envelope);
            envelope.connect(masterGain);

            // Pitch sweep up
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
            break;
        }
        case 'purchase': {
            const osc1 = audioContext.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1046.50, now); // C6
            const osc2 = audioContext.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1396.91, now); // F6
            const envelope = audioContext.createGain();
            osc1.connect(envelope);
            osc2.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.6, now + 0.05);
            envelope.gain.linearRampToValueAtTime(0, now + 0.2);
            osc1.start(now);
            osc2.start(now + 0.1);
            osc1.stop(now + 0.2);
            osc2.stop(now + 0.2);
            break;
        }
        case 'revive': {
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(2093.00, now + 0.8); // C7
            const envelope = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            filter.Q.value = 5;
            osc.connect(filter);
            filter.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.9, now + 0.1);
            envelope.gain.linearRampToValueAtTime(0, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
            break;
        }
        case 'upgradeStart': {
            playNoise(0.4, 800, 'lowpass');
            const osc = audioContext.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.5, now + 0.05);
            envelope.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            break;
        }
        case 'partCollect': {
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1500, now);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.6, now + 0.05);
            envelope.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        }
        case 'bossHit': {
            // A deep, metallic thud
            playNoise(0.2, 250, 'lowpass', 1.2);
            const osc = audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(1.0, now + 0.01);
            envelope.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        }
        case 'laserShoot': {
            // Charge up sound
            const chargeOsc = audioContext.createOscillator();
            chargeOsc.type = 'sawtooth';
            chargeOsc.frequency.setValueAtTime(50, now);
            chargeOsc.frequency.exponentialRampToValueAtTime(400, now + C.PUNISHER_LASER_CHARGE_TIME / 1000); // match charge time
            const chargeEnvelope = audioContext.createGain();
            chargeOsc.connect(chargeEnvelope);
            chargeEnvelope.connect(masterGain);
            chargeEnvelope.gain.setValueAtTime(0, now);
            chargeEnvelope.gain.linearRampToValueAtTime(0.4, now + 0.05);
            chargeEnvelope.gain.setValueAtTime(0.4, now + (C.PUNISHER_LASER_CHARGE_TIME / 1000) - 0.05);
            chargeEnvelope.gain.linearRampToValueAtTime(0, now + C.PUNISHER_LASER_CHARGE_TIME / 1000);
            chargeOsc.start(now);
            chargeOsc.stop(now + C.PUNISHER_LASER_CHARGE_TIME / 1000);

            // Fire sound
            const fireNoiseDuration = C.PUNISHER_LASER_FIRE_TIME / 1000;
            const fireTime = now + C.PUNISHER_LASER_CHARGE_TIME / 1000;
            const noise = audioContext.createBufferSource();
            const bufferSize = audioContext.sampleRate * fireNoiseDuration;
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
            noise.buffer = buffer;
            const filter = audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, fireTime);
            filter.Q.value = 5;
            const envelope = audioContext.createGain();
            noise.connect(filter);
            filter.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, fireTime);
            envelope.gain.linearRampToValueAtTime(0.9, fireTime + 0.02);
            envelope.gain.linearRampToValueAtTime(0, fireTime + fireNoiseDuration);
            noise.start(fireTime);
            noise.stop(fireTime + fireNoiseDuration);
            break;
        }
        case 'empArc': {
            if (!audioContext || !masterGain) return;
            const now = audioContext.currentTime;

            // Initial sharp "crack"
            playNoise(0.15, 6000, 'bandpass', 0.8);

            // Lingering electrical hum
            const humOsc = audioContext.createOscillator();
            humOsc.type = 'sawtooth';
            humOsc.frequency.setValueAtTime(60, now); // 60Hz hum

            const humEnvelope = audioContext.createGain();
            humOsc.connect(humEnvelope);
            humEnvelope.connect(masterGain);

            // Fade in and out
            humEnvelope.gain.setValueAtTime(0, now);
            humEnvelope.gain.linearRampToValueAtTime(0.3, now + 0.05); // Fade in to a lower volume than the crack
            humEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.4); // Fade out over 400ms

            humOsc.start(now);
            humOsc.stop(now + 0.4);
            break;
        }
        case 'encounterGood': {
            const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
            freqs.forEach((freq, i) => {
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                const envelope = audioContext.createGain();
                osc.connect(envelope);
                envelope.connect(masterGain);
                envelope.gain.setValueAtTime(0, now + i * 0.1);
                envelope.gain.linearRampToValueAtTime(0.7, now + i * 0.1 + 0.05);
                envelope.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.2);
            });
            break;
        }
        case 'encounterBad': {
            const osc = audioContext.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.8, now + 0.05);
            envelope.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
            playNoise(0.5, 800, 'lowpass');
            break;
        }
        case 'secretFound': {
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
                envelope.connect(masterGain);

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
            rootEnvelope.connect(masterGain);

            rootEnvelope.gain.setValueAtTime(0, now);
            rootEnvelope.gain.linearRampToValueAtTime(0.4, now + 0.05);
            rootEnvelope.gain.exponentialRampToValueAtTime(0.001, now + noteLength + (freqs.length * noteStagger));

            rootOsc.start(now);
            rootOsc.stop(now + noteLength + (freqs.length * noteStagger));
            break;
        }
        case 'weaverBeam': {
            if (!audioContext || !masterGain) return;
            const now = audioContext.currentTime;

            // A high-frequency crackle/hiss
            const noiseDuration = 0.3;
            const noise = audioContext.createBufferSource();
            const bufferSize = audioContext.sampleRate * noiseDuration;
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
            noise.buffer = buffer;

            const filter = audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(4000, now);
            filter.frequency.exponentialRampToValueAtTime(8000, now + noiseDuration);
            filter.Q.value = 20;

            const envelope = audioContext.createGain();
            noise.connect(filter);
            filter.connect(envelope);
            envelope.connect(masterGain);

            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.5, now + 0.02);
            envelope.gain.linearRampToValueAtTime(0, now + noiseDuration);

            noise.start(now);
            noise.stop(now + noiseDuration);
            break;
        }
        case 'trainingTargetHit': {
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.5, now + 0.01);
            envelope.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        }
        case 'trainingTargetSuccess': {
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(1800, now + 0.2);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.7, now + 0.02);
            envelope.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        }
        case 'trainingTargetFail': {
            const osc = audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            const envelope = audioContext.createGain();
            osc.connect(envelope);
            envelope.connect(masterGain);
            envelope.gain.setValueAtTime(0, now);
            envelope.gain.linearRampToValueAtTime(0.7, now + 0.01);
            envelope.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        }
    }
};

/**
 * Sets the master volume for all game sounds.
 * @param volume A value between 0 (silent) and 1 (full volume).
 */
export const setSoundVolume = (volume: number) => {
    globalVolume = Math.max(0, Math.min(1, volume));
    if (masterGain && audioContext) {
        masterGain.gain.setValueAtTime(globalVolume, audioContext.currentTime);
    }
};

/**
 * Sets the master volume for music.
 * @param volume A value between 0 (silent) and 1 (full volume).
 */
export const setMusicVolume = (volume: number) => {
    musicVolume = Math.max(0, Math.min(1, volume));
    if (musicGain && audioContext) {
        musicGain.gain.setValueAtTime(musicVolume, audioContext.currentTime);
    }
};
