// Constants and Configuration
const KEY_BINDINGS = ['A','W','S','E','D','F','T','G','Y','H','U','J','K','Z'];
const OCTAVE_OFFSET = 4;

// Note to frequency mapping (A440 tuning)
const NOTE_MAPPINGS = {
    keys: {
        'A': 'C4',   // Middle C
        'W': 'Db4',  // Black key
        'S': 'D4',
        'E': 'Eb4',  // Black key
        'D': 'E4',
        'F': 'F4',
        'T': 'Gb4',  // Black key
        'G': 'G4',
        'Y': 'Ab4',  // Black key
        'H': 'A4',   // Concert A (440 Hz)
        'U': 'Bb4',  // Black key
        'J': 'B4',
        'K': 'C5',   // High C
        'Z': 'A3'    // Low A for Für Elise
    },
    frequencies: {
        'A3': 220.00,   // Low A
        'C4': 261.63,   // Middle C
        'Db4': 277.18,
        'D4': 293.66,
        'Eb4': 311.13,
        'E4': 329.63,
        'F4': 349.23,
        'Gb4': 369.99,
        'G4': 392.00,
        'Ab4': 415.30,
        'A4': 440.00,   // Concert pitch
        'Bb4': 466.16,
        'B4': 493.88,
        'C5': 523.25    // High C
    }
};

// State management
const audioCache = new Map();
let selectedOctave = OCTAVE_OFFSET;
let audioContext = null;

// Audio Context Initialization
function initAudioContext() {
    const Audiocontext = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) {
        audioContext = new Audiocontext({
            latencyHint: 'interactive',
            sampleRate: 44100
        });
    }
    
    // iOS specific unmute
    if (audioContext.state === 'suspended') {
        const unlock = () => {
            audioContext.resume();
            document.body.removeEventListener('touchstart', unlock);
            document.body.removeEventListener('click', unlock);
        };
        document.body.addEventListener('touchstart', unlock, false);
        document.body.addEventListener('click', unlock, false);
    }
}

// Audio Loading and Setup
async function loadAudio(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        // Add error handling for decoding
        const audioBuffer = await new Promise((resolve, reject) => {
            audioContext.decodeAudioData(
                arrayBuffer,
                buffer => resolve(buffer),
                error => reject(new Error('Error decoding audio: ' + error))
            );
        });
        
        return audioBuffer;
    } catch (err) {
        console.error(`Failed to load audio from ${url}:`, err);
        throw err;
    }
}

function buildAudioURL(noteName) {
    return `sounds/${noteName}.mp3`;
}

// Note Playing and Analysis
function isValidFrequency(freq) {
    return freq >= 20 && freq <= 20000;
}

function playNote(key) {
    const audioBuffer = audioCache.get(key);
    if (!audioBuffer) {
        console.warn(`No audio buffer found for key: ${key}`);
        return;
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    const source = audioContext.createBufferSource();
    
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    source.start(0);
    requestAnimationFrame(() => {
        analyser.getFloatFrequencyData(dataArray);
        const freq = calculateFundamentalFrequency(dataArray, audioContext.sampleRate, analyser.fftSize);
        logNoteAnalysis(key, freq);
    });
    
    highlightKey(key);
}

function calculateFundamentalFrequency(dataArray, sampleRate, fftSize) {
    const frequencyBinCount = sampleRate / fftSize;
    const maxBin = Math.floor(2000 / frequencyBinCount);
    let maxIndex = 0;
    let maxValue = -Infinity;
    
    for (let i = 0; i < maxBin; i++) {
        if (dataArray[i] > maxValue) {
            maxValue = dataArray[i];
            maxIndex = i;
        }
    }
    
    return maxIndex * frequencyBinCount;
}

// Rhythm Playing
let isPlaying = false;

async function playRhythm(rhythmKeys, tempo = 200) {
    if (!rhythmKeys || typeof rhythmKeys !== 'string' || isPlaying) {
        return;
    }

    try {
        isPlaying = true;
        const button = document.querySelector(`[data-rhythm="${rhythmKeys}"]`);
        if (button) button.disabled = true;

        const keys = rhythmKeys.split(',').filter(Boolean);
        const patterns = button?.dataset.pattern?.split(',').map(Number) || keys.map(() => 1);
        const actualTempo = button?.dataset.tempo ? parseInt(button.dataset.tempo) : tempo;

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i].trim();
            playNote(key);
            
            // Calculate delay based on pattern and tempo
            const delay = patterns[i] * actualTempo;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    } catch (error) {
        console.error('Error playing rhythm:', error);
    } finally {
        isPlaying = false;
        const buttons = document.querySelectorAll('.play-rhythm');
        buttons.forEach(btn => btn.disabled = false);
    }
}

// UI Handling
function highlightKey(key) {
    const el = document.querySelector(`.key[data-key="${key}"]`);
    if (el) {
        el.classList.add('playing');
        setTimeout(() => el.classList.remove('playing'), 150);
    }
}

function updateStatus(message) {
    const status = document.getElementById('status');
    if (status) status.textContent = message;
}

// Event Handlers
function handleKeyPress(e) {
    const key = e.key.toUpperCase();
    if (NOTE_MAPPINGS.keys[key]) {
        playNote(key);
    }
}

function handleKeyClick(e) {
    const key = e.target.dataset.key;
    if (key) playNote(key);
}

// Initialization
async function initAudio() {
    try {
        if (!audioContext) initAudioContext();
        
        updateStatus('Loading sound files...');
        
        // Load all notes defined in NOTE_MAPPINGS
        for (const [key, note] of Object.entries(NOTE_MAPPINGS.keys)) {
            try {
                const url = buildAudioURL(note);
                const buffer = await loadAudio(url);
                audioCache.set(key, buffer);
            } catch (err) {
                console.error(`Failed to load audio for ${key}:`, err);
            }
        }

        // Add event listeners
        document.addEventListener('keydown', handleKeyPress);
        document.querySelectorAll('.key').forEach(el => {
            el.addEventListener('mousedown', handleKeyClick);
            el.addEventListener('touchstart', handleKeyClick, { passive: true });
        });

        updateStatus('Ready to play!');
    } catch (err) {
        console.error('Audio initialization failed:', err);
        updateStatus('Failed to load sounds. Please refresh.');
        throw err;
    }
}

// Rhythm button initialization
function initRhythmButtons() {
    document.querySelectorAll('.play-rhythm').forEach(button => {
        button.addEventListener('click', async () => {
            const rhythm = button.dataset.rhythm;
            if (!rhythm || isPlaying) return;

            const originalText = button.textContent;
            button.textContent = 'Playing...';

            try {
                await playRhythm(rhythm);
            } catch (err) {
                console.error('Failed to play rhythm:', err);
            } finally {
                button.textContent = originalText;
            }
        });
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initAudio().catch(err => {
        console.error('Failed to initialize audio:', err);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Failed to load piano sounds. Please refresh the page.';
        document.body.prepend(errorDiv);
    });
    initRhythmButtons();
});

// For Safari and mobile browsers
document.addEventListener('click', () => {
    if (!audioContext) initAudioContext();
}, { once: true });
