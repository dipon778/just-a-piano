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
        'K': 'C5',
        'O': 'Db5',  // Black key
        'L': 'D5',
        'P': 'Eb5',  // Black key
        ';': 'E5',
        'Z': 'A3'    // Low A: computer keyboard only, no on-screen key
    }
};

// Browsers block fetch() on file:// pages, so when index.html is opened
// directly we fall back to <audio> elements, which may load local files.
// The same fallback covers browsers without Web Audio.
// Served over HTTP we use Web Audio for lower latency.
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const USE_MEDIA_ELEMENTS = location.protocol === 'file:' || !AudioContextClass;

// State management
const audioCache = new Map(); // key -> AudioBuffer, or HTMLAudioElement in fallback mode
let audioContext = null;

// Audio Context Initialization
function initAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContextClass({ latencyHint: 'interactive' });
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
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Callback form: older Safari doesn't return a promise from decodeAudioData
    return new Promise((resolve, reject) => {
        audioContext.decodeAudioData(
            arrayBuffer,
            buffer => resolve(buffer),
            error => reject(new Error('Error decoding audio: ' + error))
        );
    });
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
    if (startSample(key)) highlightKey(key);
}

// Starts the sample for key; `when` is an AudioContext time (Web Audio only).
// Returns false if the sample isn't loaded.
function startSample(key, when = 0) {
    const sample = audioCache.get(key);
    if (!sample) {
        console.warn(`No audio buffer found for key: ${key}`);
        return false;
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
        source.start(when);
    }
    return true;
}

// Rhythm Playing
let isPlaying = false;
const SCHEDULE_LEAD_S = 0.05; // headroom so the first scheduled note isn't late

async function playRhythm(button) {
    if (isPlaying) return;

    const buttons = document.querySelectorAll('.play-rhythm');
    try {
        isPlaying = true;
        buttons.forEach(btn => btn.disabled = true);

        const keys = button.dataset.rhythm.split(',').map(k => k.trim()).filter(Boolean);
        const beats = button.dataset.pattern?.split(',').map(Number) ?? keys.map(() => 1);
        const beatMs = Number(button.dataset.beatMs) || 200;

        // Web Audio: schedule every note on the audio clock up front, which is
        // sample-accurate, unlike chained setTimeouts that drift.
        // <audio> elements can't be scheduled, so fall back to timers there.
        let t0 = 0;
        if (!USE_MEDIA_ELEMENTS) {
            await audioContext.resume();
            t0 = audioContext.currentTime + SCHEDULE_LEAD_S;
        }

        let offsetMs = 0;
        keys.forEach((key, i) => {
            if (USE_MEDIA_ELEMENTS) {
                setTimeout(() => playNote(key), offsetMs);
            } else {
                startSample(key, t0 + offsetMs / 1000);
                setTimeout(() => highlightKey(key), offsetMs + SCHEDULE_LEAD_S * 1000);
            }
            offsetMs += (beats[i] || 1) * beatMs;
        });

        await new Promise(resolve => setTimeout(resolve, offsetMs));
    } catch (error) {
        console.error('Error playing rhythm:', error);
    } finally {
        isPlaying = false;
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
    // Listeners go on first so the keyboard responds while samples load;
    // a key whose sample hasn't arrived yet is simply silent.
    document.addEventListener('keydown', handleKeyPress);
    // pointerdown covers mouse, touch and pen with a single event,
    // avoiding the duplicate emulated mousedown after touchstart
    document.querySelectorAll('.key').forEach(el => {
        el.addEventListener('pointerdown', handleKeyClick);
    });

    if (!USE_MEDIA_ELEMENTS) initAudioContext();
    const load = USE_MEDIA_ELEMENTS ? loadMediaElement : loadAudio;

    updateStatus('Loading sounds...');

    // Load every note in parallel; one failure shouldn't block the rest
    const entries = Object.entries(NOTE_MAPPINGS.keys);
    const results = await Promise.allSettled(entries.map(async ([key, note]) => {
        audioCache.set(key, await load(buildAudioURL(note)));
    }));

    const failed = [];
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            const note = entries[i][1];
            console.error(`Failed to load sound ${note}:`, result.reason);
            failed.push(note);
        }
    });

    if (failed.length === entries.length) {
        updateStatus('Could not load piano sounds. Check your connection and refresh.');
    } else if (failed.length) {
        updateStatus(`Ready to play! (${failed.length} of ${entries.length} sounds failed to load: ${failed.join(', ')})`);
    } else {
        updateStatus('Ready to play!');
    }
}

// Rhythm button initialization
function initRhythmButtons() {
    document.querySelectorAll('.play-rhythm').forEach(button => {
        button.addEventListener('click', async () => {
            if (!button.dataset.rhythm || isPlaying) return;

            const originalText = button.textContent;
            button.textContent = 'Playing...';

            try {
                await playRhythm(button);
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
        updateStatus('Audio could not start in this browser. Please refresh the page.');
    });
    initRhythmButtons();
});
