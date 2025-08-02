const KEY_BINDINGS = ['A','W','S','E','D','F','T','G','Y','H','U','J','K'];
const OCTAVE_OFFSET = 4;

const audioCache = new Map();
let selectedOctave = OCTAVE_OFFSET;

function buildAudioURL(noteName) {
  return `sounds/${noteName}.mp3`;
}

async function fetchSoundList() {
  const res = await fetch('/sounds/');         // Requires NGINX autoindex on
  if (!res.ok) throw new Error('Invalid sounds folder listing');
  const text = await res.text();
  // matches "C4.mp3" etc.
  return Array.from(text.matchAll(/href="([^"]+\.mp3)"/g))
    .map(m => m[1])
    .filter(f => /\b[A-G][b#]?\d+\.mp3$/.test(f));
}

function mapKeysToNotes(soundFiles) {
  const filtered = soundFiles.filter(fn => fn.startsWith('C' + selectedOctave));
  const octave = soundFiles
    .filter(fn => fn.endsWith(`${selectedOctave}.mp3`))
    .map(fn => fn.slice(0, -4)); // strip .mp3
  const map = {};
  for (let i = 0; i < KEY_BINDINGS.length && i < octave.length; i++) {
    map[KEY_BINDINGS[i]] = octave[i];
  }
  return map;
}

async function initAudio() {
  const files = await fetchSoundList();
  const keyMap = mapKeysToNotes(files);

  for (const [key, note] of Object.entries(keyMap)) {
    const url = buildAudioURL(note);
    const audio = new Audio(url);
    audio.preload = 'auto';
    await audio.load();         // hint browser to preload early
    audioCache.set(key, audio);
  }

  document.addEventListener('keydown', e => {
    const note = keyMap[e.key.toUpperCase()];
    if (!note) return;
    const audio = audioCache.get(e.key.toUpperCase());
    audio.currentTime = 0;
    audio.play();
    highlightKey(e.key.toUpperCase());
  });

  document.querySelectorAll('.key').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      const audio = audioCache.get(key);
      if (audio) { audio.currentTime = 0; audio.play(); }
      highlightKey(key);
    });
  });
}

function highlightKey(key) {
  const el = document.querySelector(`.key[data-key="${key}"]`);
  el && (el.classList.add('playing'),
           setTimeout(() => el.classList.remove('playing'), 150));
}

initAudio().catch(console.error);
