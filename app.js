/* =========================================
   app.js
   1) light/dark toggle
   2) custom audio player (from my itch.io one, cleaned up)
   plain js only, no libraries
   ========================================= */


/* ==========================================
   1. THEME TOGGLE
   ========================================== */

const themeBtn = document.getElementById('theme-toggle');
const root = document.documentElement; // the <html> tag

// changes theme on <html> + updates the button icon
function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  // button shows the mode you will switch TO
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeBtn.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    // storage blocked, no big deal
  }
}

// if they picked a theme before, use it (try/catch cuz storage can be blocked)
try {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    setTheme(savedTheme);
  }
} catch (e) {
  // just stay on default dark
}

// flip theme on click
themeBtn.addEventListener('click', function () {
  const current = root.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});


/* ==========================================
   2. AUDIO PLAYER
   ========================================== */

// files go in the /audio folder (relative paths for github pages!)
// remember: github pages is case sensitive so Track1.ogg != track1.ogg
const tracks = [
  { title: 'Music 01', file: 'audio/track1.ogg' },
  { title: 'Music 02', file: 'audio/track2.ogg' },
  { title: 'Music 03', file: 'audio/track3.ogg' }
];

// ---- grab all the elements ----
const audio        = document.getElementById('audio');
const bigPlayBtn   = document.getElementById('big-play');
const nowTitleEl   = document.getElementById('now-title');
const timeEl       = document.getElementById('time');
const scrubber     = document.getElementById('scrubber');
const scrubberFill = document.getElementById('scrubber-fill');
const scrubberKnob = document.getElementById('scrubber-knob');
const prevBtn      = document.getElementById('prev');
const nextBtn      = document.getElementById('next');
const loopBtn      = document.getElementById('loop');
const muteBtn      = document.getElementById('mute');
const volumeInput  = document.getElementById('volume');
const tracklistEl  = document.getElementById('tracklist');

// ---- state (stuff that changes) ----
let currentIndex = 0;          // which track were on
let loopMode = 'none';         // 'none' | 'playlist' | 'track'
let isDragging = false;        // true while user drags the progress bar
let dragRatio = 0;             // where the drag currently is (0 to 1)
const trackButtons = [];       // the buttons in the track list, so we can highlight them


/* ---------- small helpers ---------- */

// seconds -> m:ss  (65 becomes 1:05)
function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// play() gives back a promise and it can fail (wrong path, browser blocking etc)
function playAudio() {
  audio.play().catch(function (err) {
    console.log('couldnt play the audio, check your file path:', err);
  });
}

// moves the bar + knob. ratio is 0 to 1
function setProgress(ratio) {
  const pct = ratio * 100;
  scrubberFill.style.width = pct + '%';
  scrubberKnob.style.left = pct + '%';
  scrubber.setAttribute('aria-valuenow', Math.round(pct));
}

// updates the "0:00 / 0:00" text
function setTimeText(current) {
  timeEl.textContent = formatTime(current) + ' / ' + formatTime(audio.duration);
}


/* ---------- build the track list ---------- */

function buildTracklist() {
  tracks.forEach(function (track, i) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'track-btn';

    const num = document.createElement('span');
    num.className = 'track-num';
    num.textContent = (i + 1) + '.';

    const title = document.createElement('span');
    title.className = 'track-title';
    title.textContent = track.title;

    const dur = document.createElement('span');
    dur.className = 'track-dur';
    dur.textContent = '--:--';

    btn.append(num, title, dur);
    li.appendChild(btn);
    tracklistEl.appendChild(li);
    trackButtons.push(btn);

    // clicking a track plays it. if its already the current one it toggles play/pause
    btn.addEventListener('click', function () {
      if (i === currentIndex) {
        togglePlay();
      } else {
        goToTrack(i, true);
      }
    });

    // load the file in the background just to read the length for the list
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = track.file;
    probe.addEventListener('loadedmetadata', function () {
      dur.textContent = formatTime(probe.duration);
    });
  });
}


/* ---------- loading + switching tracks ---------- */

// loads a track, and plays it if autoplay is true
function goToTrack(index, autoplay) {
  currentIndex = index;
  audio.src = tracks[index].file;
  nowTitleEl.textContent = tracks[index].title;

  // reset the bar and time
  setProgress(0);
  timeEl.textContent = '0:00 / 0:00';

  // highlight the active row
  trackButtons.forEach(function (btn, i) {
    btn.classList.toggle('active', i === index);
  });

  // changing src stops playback so sync the buttons right away
  updatePlayUI();

  if (autoplay) playAudio();
}

function nextTrack() {
  const wasPlaying = !audio.paused;
  goToTrack((currentIndex + 1) % tracks.length, wasPlaying);
}

function prevTrack() {
  // if were more than 5 sec in, restart the track instead of going back (like most players)
  if (audio.currentTime > 5) {
    audio.currentTime = 0;
    return;
  }
  const wasPlaying = !audio.paused;
  goToTrack((currentIndex - 1 + tracks.length) % tracks.length, wasPlaying);
}

function togglePlay() {
  if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
  }
}

// makes the big button match whats really happening
function updatePlayUI() {
  const playing = !audio.paused;
  bigPlayBtn.classList.toggle('playing', playing);
  bigPlayBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  updateEqState();
}

// eq bars only bounce if music is playing AND you can actually hear it
// (muted or volume at 0 = bars freeze, even though the track keeps going)
function updateEqState() {
  const audible = !audio.paused && !audio.muted && audio.volume > 0;
  document.body.classList.toggle('is-playing', audible); // css uses this for the eq bars
}


/* ---------- loop button (off > playlist > one track) ---------- */

const loopModes = ['none', 'playlist', 'track'];
const loopLabels = {
  none: 'Loop off',
  playlist: 'Loop playlist',
  track: 'Loop this track'
};

function applyLoopMode() {
  audio.loop = (loopMode === 'track');   // browser handles single track looping for us
  loopBtn.dataset.mode = loopMode;       // css dims the button when its "none"

  // swap the icon from the icon font: single track gets the "1" version
  loopBtn.classList.remove('icon-loop', 'icon-loop-1');
  loopBtn.classList.add(loopMode === 'track' ? 'icon-loop-1' : 'icon-loop');

  loopBtn.title = loopLabels[loopMode];
  loopBtn.setAttribute('aria-label', loopLabels[loopMode]);
}

loopBtn.addEventListener('click', function () {
  loopMode = loopModes[(loopModes.indexOf(loopMode) + 1) % loopModes.length];
  applyLoopMode();
});


/* ---------- button events ---------- */

bigPlayBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextTrack);
prevBtn.addEventListener('click', prevTrack);

// spacebar = play/pause (only when nothing else is focused, otherwise it would clash with buttons)
document.addEventListener('keydown', function (e) {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault(); // stops the page from scrolling down
    togglePlay();
  }
});


/* ---------- audio events ---------- */

audio.addEventListener('play', updatePlayUI);
audio.addEventListener('pause', updatePlayUI);

// mute / volume changed = recheck if the eq bars should move
audio.addEventListener('volumechange', updateEqState);

// once we know the length, show it
audio.addEventListener('loadedmetadata', function () {
  setTimeText(audio.currentTime);
});

// fires a bunch of times a sec while playing, moves the bar
audio.addEventListener('timeupdate', function () {
  if (isDragging || !audio.duration) return; // dont fight the user's drag
  setProgress(audio.currentTime / audio.duration);
  setTimeText(audio.currentTime);
});

// track finished (doesnt fire in single-track loop mode)
audio.addEventListener('ended', function () {
  const isLast = currentIndex === tracks.length - 1;

  if (isLast && loopMode !== 'playlist') {
    // end of the list and no looping, so just stop and reset
    audio.currentTime = 0;
    setProgress(0);
    setTimeText(0);
    return;
  }
  goToTrack((currentIndex + 1) % tracks.length, true);
});

// file missing or broken? tell the user instead of failing quietly
audio.addEventListener('error', function () {
  nowTitleEl.textContent = tracks[currentIndex].title + ' (file not found)';
  console.log('audio error, check that this exists:', tracks[currentIndex].file);
});


/* ---------- progress bar dragging ---------- */

// works out 0-1 position from where the pointer is on the bar
function ratioFromPointer(e) {
  const rect = scrubber.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  return Math.min(1, Math.max(0, ratio));
}

// moves the bar visually while dragging (audio only jumps when you let go)
function previewSeek(e) {
  dragRatio = ratioFromPointer(e);
  setProgress(dragRatio);
  setTimeText(dragRatio * audio.duration);
}

scrubber.addEventListener('pointerdown', function (e) {
  if (!audio.duration) return;           // nothing loaded yet
  isDragging = true;
  scrubber.setPointerCapture(e.pointerId); // keeps events coming even if pointer leaves the bar
  previewSeek(e);
});

scrubber.addEventListener('pointermove', function (e) {
  if (isDragging) previewSeek(e);
});

// let go = actually jump to that spot
function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  audio.currentTime = dragRatio * audio.duration;
}
scrubber.addEventListener('pointerup', endDrag);
scrubber.addEventListener('pointercancel', endDrag);

// arrow keys on the bar skip 5 sec (keyboard users)
scrubber.addEventListener('keydown', function (e) {
  if (!audio.duration) return;
  if (e.key === 'ArrowRight') {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  } else if (e.key === 'ArrowLeft') {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  }
});


/* ---------- volume ---------- */

// the speaker icons from your icon font (same ones as the itch player)
const volumeIcons = ['icon-volume-x', 'icon-volume-low', 'icon-volume-high'];

// picks which speaker icon to show: 0 = muted, 1 = low, 2 = high
function updateVolumeIcon() {
  let level = 2;
  if (audio.muted || audio.volume === 0) {
    level = 0;
  } else if (audio.volume <= 0.5) {
    level = 1;
  }
  muteBtn.classList.remove(...volumeIcons);
  muteBtn.classList.add(volumeIcons[level]);
  muteBtn.setAttribute('aria-label', level === 0 ? 'Unmute' : 'Mute');
}

function saveVolume() {
  try {
    localStorage.setItem('volume', audio.volume);
  } catch (e) {
    // ignore
  }
}

volumeInput.addEventListener('input', function () {
  audio.volume = parseFloat(volumeInput.value);
  if (audio.volume > 0) audio.muted = false; // moving the slider unmutes
  updateVolumeIcon();
  saveVolume();
});

muteBtn.addEventListener('click', function () {
  audio.muted = !audio.muted;
  updateVolumeIcon();
});

// load saved volume if there is one, if not use 0.8
let savedVolume = NaN;
try {
  savedVolume = parseFloat(localStorage.getItem('volume'));
} catch (e) {
  // ignore
}
audio.volume = (savedVolume >= 0 && savedVolume <= 1) ? savedVolume : 0.8;
volumeInput.value = audio.volume;

// ios ignores audio.volume (it always stays at 1), so the slider + mute button
// do nothing there. test if a value sticks, and if not hide the volume controls
function volumeIsControllable() {
  const test = new Audio();
  test.volume = 0.5;
  return test.volume === 0.5;
}

if (!volumeIsControllable()) {
  // css hides .volume when this class is on <html>
  document.documentElement.classList.add('no-volume');
}


/* ---------- start everything up ---------- */
buildTracklist();
goToTrack(0, false);   // load first track but dont autoplay (browsers block that anyway)
applyLoopMode();
updateVolumeIcon();
updateEqState();       // sync the eq bars on load (they start frozen cuz nothing is playing)
