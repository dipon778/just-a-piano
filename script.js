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
  // Define complete chromatic scale using sharp notation
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'];
  
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
function isValidFrequency(freq) {
    return freq >= 20 && freq <= 20000; // Human hearing range
}

function playNote(key) {
    const audioBuffer = audioCache.get(key);
    if (!audioBuffer) {
        console.warn(`No audio buffer found for key: ${key}`);
        return;
    }

    // Create audio nodes
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096; // Increased for better resolution
    const source = audioContext.createBufferSource();
    
    // Setup source and connect nodes
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // Create frequency analysis
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const sampleRate = audioContext.sampleRate;
    
    // Function to find fundamental frequency
    const findFundamentalFrequency = () => {
        analyser.getFloatFrequencyData(dataArray);
        
        // Get frequency resolution
        const frequencyBinCount = sampleRate / analyser.fftSize;
        
        // Find peak frequency
        let maxIndex = 0;
        let maxValue = -Infinity;
        
        // Only look at lower frequencies where fundamentals typically are
        const maxBin = Math.floor(2000 / frequencyBinCount);
        
        for (let i = 0; i < maxBin; i++) {
            if (dataArray[i] > maxValue) {
                maxValue = dataArray[i];
                maxIndex = i;
            }
        }
        
        return maxIndex * frequencyBinCount;
    };
    
    // Start playing and analyze
    source.start(0);
    requestAnimationFrame(() => {
        const freq = findFundamentalFrequency();
        if (isValidFrequency(freq)) {
            console.log(`
                Note: ${key}
                Measured Frequency: ${freq.toFixed(2)} Hz
                Expected Frequency: ${noteFrequencies[keyToNote[key]]} Hz
                Difference: ${(freq - noteFrequencies[keyToNote[key]]).toFixed(2)} Hz
            `);
        }
    });
    
    highlightKey(key);
}

function highlightKey(key) {
  const el = document.querySelector(`.key[data-key="${key}"]`);
  el && (el.classList.add('playing'),
           setTimeout(() => el.classList.remove('playing'), 150));
}

// Play rhythm function
async function playRhythm(rhythmKeys, tempo = 180) {
    if (!rhythmKeys || typeof rhythmKeys !== 'string') {
        console.error('Invalid rhythm pattern');
        return;
    }

    const keys = rhythmKeys.split(',').filter(Boolean);
    const button = document.querySelector(`[data-rhythm="${rhythmKeys}"]`);
    const customTempo = button ? parseInt(button.dataset.tempo) : tempo;
    const pattern = button.dataset.pattern?.split(',').map(Number) || keys.map(() => 1);
    
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i].trim();
        playNote(key);
        
        // Duration based on pattern
        const duration = pattern[i] * customTempo;
        await new Promise(resolve => setTimeout(resolve, duration));
    }
}

// Initialize both rhythm and sequence buttons
function initRhythms() {
    document.querySelectorAll('.play-rhythm, .play-sequence').forEach(button => {
        button.addEventListener('click', async (e) => {
            const rhythm = e.target.getAttribute('data-rhythm');
            if (!rhythm) return;

            button.disabled = true;
            const originalText = button.textContent;
            button.textContent = 'Playing...';

            try {
                // Use slower tempo for sequences
                const tempo = button.classList.contains('play-sequence') ? 500 : 400;
                await playRhythm(rhythm, tempo);
            } catch (err) {
                console.error('Error playing rhythm:', err);
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    });
}

// Add to your existing initialization code
document.addEventListener('DOMContentLoaded', () => {
    // ...existing initialization code...
    initRhythms();
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

const keyToNote = {
    'A': 'C4',   // Middle C
    'W': 'Db4',  // Change to Db (standard piano notation often uses flats)
    'S': 'D4',   
    'E': 'Eb4',  // Change to Eb
    'D': 'E4',   
    'F': 'F4',   
    'T': 'Gb4',  // Change to Gb
    'G': 'G4',   
    'Y': 'Ab4',  // Change to Ab
    'H': 'A4',   // Concert A (440 Hz)
    'U': 'Bb4',  // Change to Bb
    'J': 'B4',   
    'K': 'C5',    // Adding higher C
    'Z': 'A3'     // Adding lower A for Für Elise
};

// Update frequency table to use flat notation matching piano standards
const noteFrequencies = {
    'C4': 261.63,   // Middle C
    'Db4': 277.18,  // Using flats instead of sharps
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
    'C5': 523.25
};
