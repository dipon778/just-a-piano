const KEY_BINDINGS = ['A','W','S','E','D','F','T','G','Y','H','U','J','K'];
const OCTAVE_OFFSET = 4;

const audioCache = new Map();
let selectedOctave = OCTAVE_OFFSET;
let audioContext = null;

// Initialize Web Audio API context
function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Add this to handle user interaction requirement for audio
document.addEventListener('click', () => {
    if (!audioContext) {
        initAudioContext();
    }
}, { once: true });

function buildAudioURL(noteName) {
    return `sounds/${noteName}.mp3`;
}

async function fetchSoundList() {
    try {
        const res = await fetch('/sounds/');
        if (!res.ok) throw new Error('Invalid sounds folder listing');
        const text = await res.text();
        const matches = Array.from(text.matchAll(/href="([A-G][b#]?\d+\.mp3)"/g));
        if (!matches.length) {
            throw new Error('No sound files found in directory');
        }
        return matches.map(m => m[1]);
    } catch (err) {
        console.error('Error fetching sound list:', err);
        throw err;
    }
}

// Add status updates
function updateStatus(message) {
    const status = document.getElementById('status');
    if (status) status.textContent = message;
}

// Modified loadAudio function
async function loadAudio(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (err) {
        console.error(`Failed to load audio from ${url}:`, err);
        throw err;
    }
}

function mapKeysToNotes(soundFiles) {
  // Define complete chromatic scale
  const notes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C'];
  
  // Filter and sort files for current octave
  const octave = soundFiles
    .filter(fn => fn.includes(selectedOctave) || fn.includes(selectedOctave + 1))
    .sort((a, b) => {
      const noteA = a.replace('.mp3', '');
      const noteB = b.replace('.mp3', '');
      return notes.indexOf(noteA.replace(/\d+/, '')) - 
             notes.indexOf(noteB.replace(/\d+/, ''));
    })
    .map(fn => fn.slice(0, -4)); // strip .mp3

  console.log('Available notes:', octave); // Debug log

  // Create key mapping
  const map = {};
  KEY_BINDINGS.forEach((key, index) => {
    // Handle the last key ('K') specially to map to high C
    if (key === 'K') {
      map[key] = `C${selectedOctave + 1}`; // Map K to the C note of next octave
    } else {
      map[key] = octave[index];
    }
    console.log(`Mapping ${key} to ${map[key]}`); // Debug log
  });

  return map;
}

// Modified initAudio function
async function initAudio() {
    try {
        if (!audioContext) {
            initAudioContext();
        }
        
        updateStatus('Loading sound files...');
        const files = await fetchSoundList();
        
        const keyMap = mapKeysToNotes(files);
        let loadedCount = 0;

        for (const [key, note] of Object.entries(keyMap)) {
            try {
                const url = buildAudioURL(note);
                const buffer = await loadAudio(url);
                audioCache.set(key, buffer);
                loadedCount++;
                updateStatus(`Loading sounds: ${loadedCount}/${Object.keys(keyMap).length}`);
            } catch (err) {
                console.error(`Failed to load audio for ${key}:`, err);
            }
        }

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

function handleKeyPress(e) {
    const key = e.key.toUpperCase();
    playNote(key);
}

function handleKeyClick(e) {
    const key = e.target.dataset.key;
    playNote(key);
}

// Modified playNote function
function playNote(key) {
    const audioBuffer = audioCache.get(key);
    if (!audioBuffer) {
        console.warn(`No audio buffer found for key: ${key}`);
        return;
    }

    // Create audio nodes
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioContext.createBufferSource();
    
    // Setup source and connect nodes
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // Map keys to note names
    const keyToNote = {
        'A': 'C4', 'W': 'Db4', 'S': 'D4', 'E': 'Eb4',
        'D': 'E4', 'F': 'F4', 'T': 'Gb4', 'G': 'G4',
        'Y': 'Ab4', 'H': 'A4', 'U': 'Bb4', 'J': 'B4',
        'K': 'C5'
    };

    const noteFrequencies = {
        'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13,
        'E4': 329.63, 'F4': 349.23, 'Gb4': 369.99, 'G4': 392.00,
        'Ab4': 415.30, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88,
        'C5': 523.25
    };

    const noteName = keyToNote[key];
    console.log(`Playing ${noteName} - Frequency: ${noteFrequencies[noteName]} Hz`);

    source.start(0);
    highlightKey(key);
}

function highlightKey(key) {
  const el = document.querySelector(`.key[data-key="${key}"]`);
  el && (el.classList.add('playing'),
           setTimeout(() => el.classList.remove('playing'), 150));
}

// Play rhythm function
async function playRhythm(rhythm, tempo = 500) {
    const keys = rhythm.split(',');
    for (let i = 0; i < keys.length; i++) {
        playNote(keys[i]);
        await new Promise(resolve => setTimeout(resolve, tempo));
    }
}

// Add event listeners for rhythm buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.play-rhythm').forEach(button => {
        button.addEventListener('click', async (e) => {
            const rhythm = e.target.dataset.rhythm;
            button.disabled = true;
            button.textContent = 'Playing...';
            
            await playRhythm(rhythm);
            
            button.disabled = false;
            button.textContent = 'Play';
        });
    });
});

// Initialize audio with error handling
window.addEventListener('load', () => {
    initAudio().catch(err => {
        console.error('Failed to initialize audio:', err);
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Failed to load piano sounds. Please refresh the page.';
        document.body.prepend(errorDiv);
    });
});
