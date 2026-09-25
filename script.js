// Keyboard key to note (sample file) mapping
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
    }
};

// Browsers block fetch() on file:// pages, so when index.html is opened
// directly we fall back to <audio> elements, which may load local files.
// Served over HTTP we use Web Audio for lower latency.
const USE_MEDIA_ELEMENTS = location.protocol === 'file:';

// State management
const audioCache = new Map(); // key -> AudioBuffer, or HTMLAudioElement in fallback mode
let audioContext = null;

// Audio Context Initialization
function initAudioContext() {
    const Audiocontext = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) {
        audioContext = new Audiocontext({ latencyHint: 'interactive' });
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

function loadMediaElement(url) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
        audio.addEventListener('error', () => reject(new Error(`Error loading audio: ${url}`)), { once: true });
        audio.src = url;
        audio.load();
    });
}

// Bump when sound files change: nginx caches /sounds/ for a year, so a new
// query string is what makes browsers fetch the updated samples.
const SOUNDS_VERSION = 3; // 3: black-key samples (Db4/Gb4/Ab4) replaced

function buildAudioURL(noteName) {
    return `sounds/${noteName}.mp3?v=${SOUNDS_VERSION}`;
}

// Note Playing
function playNote(key) {
    const sample = audioCache.get(key);
    if (!sample) {
        console.warn(`No audio buffer found for key: ${key}`);
        return;
    }

    if (USE_MEDIA_ELEMENTS) {
        // A fresh clone per press lets repeated notes overlap
        sample.cloneNode().play().catch(err => console.warn(`Could not play ${key}:`, err));
    } else {
        // Browsers start the context suspended until a user gesture; any
        // key press or click that reaches here counts as one.
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = sample;
        source.connect(audioContext.destination);
        source.start(0);
    }

    highlightKey(key);
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
    // Ignore auto-repeat while held and shortcuts like Ctrl+S / Cmd+A
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toUpperCase();
    if (NOTE_MAPPINGS.keys[key]) {
        playNote(key);
    }
}

function handleKeyClick(e) {
    // currentTarget is the .key element even when the label span is clicked
    const key = e.currentTarget.dataset.key;
    if (key) playNote(key);
}

// Initialization
async function initAudio() {
    try {
        if (!USE_MEDIA_ELEMENTS && !audioContext) initAudioContext();
        const load = USE_MEDIA_ELEMENTS ? loadMediaElement : loadAudio;

        updateStatus('Loading sound files...');

        // Load all notes defined in NOTE_MAPPINGS
        for (const [key, note] of Object.entries(NOTE_MAPPINGS.keys)) {
            try {
                const url = buildAudioURL(note);
                const sample = await load(url);
                audioCache.set(key, sample);
            } catch (err) {
                console.error(`Failed to load audio for ${key}:`, err);
            }
        }

        // Add event listeners
        document.addEventListener('keydown', handleKeyPress);
        // pointerdown covers mouse, touch and pen with a single event,
        // avoiding the duplicate emulated mousedown after touchstart
        document.querySelectorAll('.key').forEach(el => {
            el.addEventListener('pointerdown', handleKeyClick);
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
    if (!USE_MEDIA_ELEMENTS && !audioContext) initAudioContext();
}, { once: true });
