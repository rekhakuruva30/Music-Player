
const playlist = [
  {
    title: "Midnight Drive",
    artist: "Neon Avenue",
    src: "assets/audio/song1.mp3",
    cover: "assets/images/cover1.jpg",
    duration: "3:42"
  },
  {
    title: "Paper Lanterns",
    artist: "Meera Rao",
    src: "assets/audio/song2.mp3",
    cover: "assets/images/cover2.jpg",
    duration: "4:05"
  },
  {
    title: "Half Past Blue",
    artist: "Sona & the Static",
    src: "assets/audio/song3.mp3",
    cover: "assets/images/cover3.jpg",
    duration: "3:18"
  },
  {
    title: "Night Bus Home",
    artist: "Kavya Lines",
    src: "assets/audio/song4.mp3",
    cover: "assets/images/cover4.jpg",
    duration: "5:02"
  },
  {
    title: "Ordinary Weather",
    artist: "Noon Radio",
    src: "assets/audio/song5.mp3",
    cover: "assets/images/cover5.jpg",
    duration: "2:56"
  }
];

/* ---------------------------------------------------------
   2. STATE + ELEMENT REFERENCES
   --------------------------------------------------------- */
const audio = new Audio();          // the HTML5 Audio object that does the playing
let currentIndex = 0;               // which song in the playlist is loaded
let isDragging = false;             // true while the user drags the progress knob
let shuffleOn = false;
let repeatMode = "off";             // "off" | "all" | "one"

// AUTOPLAY: when true, the next song starts automatically after one ends.
// Browsers block sound until the user clicks something, so the very first
// song still needs a click on Play. Everything after that is automatic.
const AUTOPLAY = true;

const $ = (id) => document.getElementById(id);

const coverBox    = $("cover");
const coverImg    = $("coverImg");
const titleEl     = $("title");
const artistEl    = $("artist");
const progressEl  = $("progress");
const filledEl    = $("progressFilled");
const knobEl      = $("progressKnob");
const currentEl   = $("currentTime");
const durationEl  = $("duration");
const playBtn     = $("playBtn");
const playIcon    = $("playIcon");
const prevBtn     = $("prevBtn");
const nextBtn     = $("nextBtn");
const muteBtn     = $("muteBtn");
const volIcon     = $("volIcon");
const volumeSlider= $("volumeSlider");
const listEl      = $("playlist");
const countEl     = $("songCount");
const shuffleBtn  = $("shuffleBtn");
const repeatBtn   = $("repeatBtn");
const repeatIcon  = $("repeatIcon");
const toastEl     = $("toast");

// SVG path data for the icons we swap at runtime
const ICON_PLAY  = "M8 5l12 7-12 7z";
const ICON_PAUSE = "M7 5h4v14H7zm6 0h4v14h-4z";
const ICON_VOL   = "M4 9h3l5-4v14l-5-4H4zm11.5 3a3.5 3.5 0 00-2-3.2v6.4a3.5 3.5 0 002-3.2z";
const ICON_MUTE  = "M4 9h3l5-4v14l-5-4H4zm12.9 1.5l1.4 1.5 1.4-1.5 1.1 1.1-1.5 1.4 1.5 1.4-1.1 1.1-1.4-1.5-1.4 1.5-1.1-1.1 1.5-1.4-1.5-1.4z";

// A plain grey square used when a cover image file is missing,
// so the layout never breaks while you are still adding artwork.
const FALLBACK_COVER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#00d3a7"/>' +
    '</linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/>' +
    '<circle cx="50" cy="50" r="10" fill="#1b2434"/></svg>'
  );

/* ---------------------------------------------------------
   3. HELPERS
   --------------------------------------------------------- */

// Turn 143.6 seconds into "2:23"
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + String(s).padStart(2, "0");
}

// Brief message at the bottom of the screen
let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3500);
}

/* ---------------------------------------------------------
   4. BUILD THE PLAYLIST UI
   Runs once at start-up and creates one <li> per song.
   --------------------------------------------------------- */
function renderPlaylist() {
  listEl.innerHTML = "";

  playlist.forEach((song, index) => {
    const li = document.createElement("li");
    li.className = "song";
    li.dataset.index = index;

    li.innerHTML = `
      <img class="song__thumb" src="${song.cover}" alt="">
      <div class="song__meta">
        <div class="song__title"></div>
        <div class="song__artist"></div>
      </div>
      <div class="song__bars"><span></span><span></span><span></span></div>
      <div class="song__len">${song.duration}</div>
    `;

    // textContent (not innerHTML) so titles with & or < never break the markup
    li.querySelector(".song__title").textContent = song.title;
    li.querySelector(".song__artist").textContent = song.artist;

    // fall back to the gradient square if the image file is missing
    li.querySelector(".song__thumb").onerror = function () { this.src = FALLBACK_COVER; };

    // clicking a row plays that song
    li.addEventListener("click", () => loadSong(index, true));

    listEl.appendChild(li);
  });

  countEl.textContent = playlist.length + (playlist.length === 1 ? " song" : " songs");
}

// Highlight the row that is currently playing
function highlightActiveSong() {
  document.querySelectorAll(".song").forEach((li, i) => {
    li.classList.toggle("active", i === currentIndex);
    li.classList.toggle("paused", i === currentIndex && audio.paused);
  });
}

/* ---------------------------------------------------------
   5. LOADING AND PLAYING
   --------------------------------------------------------- */

// Load the song at `index` into the audio element and update the UI.
// Pass autoplay = true to start playing immediately.
function loadSong(index, autoplay) {
  currentIndex = index;
  const song = playlist[index];

  audio.src = song.src;
  titleEl.textContent = song.title;
  artistEl.textContent = song.artist;
  coverImg.src = song.cover;

  // reset the progress display for the new song
  filledEl.style.width = "0%";
  knobEl.style.left = "0%";
  currentEl.textContent = "0:00";
  durationEl.textContent = song.duration;   // replaced by the real value on loadedmetadata

  highlightActiveSong();
  updateBoundaryButtons();

  if (autoplay) playSong();
}

function playSong() {
  // .play() returns a Promise. It rejects if the file is missing or if the
  // browser blocks playback, so we always catch it to avoid console errors.
  audio.play().catch(() => {
    showToast("Could not play this file. Check that " + playlist[currentIndex].src + " exists.");
  });
}

function pauseSong() {
  audio.pause();
}

// The button just toggles; the icon itself is updated by the
// audio "play" and "pause" events below, so it can never fall out of sync.
playBtn.addEventListener("click", () => {
  if (audio.paused) playSong();
  else pauseSong();
});

// Keep the icon and the spinning cover synced with the real audio state
audio.addEventListener("play", () => {
  playIcon.innerHTML = `<path d="${ICON_PAUSE}"/>`;
  playBtn.setAttribute("aria-label", "Pause");
  playBtn.title = "Pause";
  coverBox.classList.add("is-playing");
  highlightActiveSong();
});

audio.addEventListener("pause", () => {
  playIcon.innerHTML = `<path d="${ICON_PLAY}"/>`;
  playBtn.setAttribute("aria-label", "Play");
  playBtn.title = "Play";
  coverBox.classList.remove("is-playing");
  highlightActiveSong();
});

// If a file is missing, say so instead of failing silently
audio.addEventListener("error", () => {
  if (audio.src) showToast("Audio file not found: " + playlist[currentIndex].src);
});

/* ---------------------------------------------------------
   6. NEXT / PREVIOUS
   --------------------------------------------------------- */

function nextSong() {
  if (shuffleOn && playlist.length > 1) {
    let n;
    do { n = Math.floor(Math.random() * playlist.length); } while (n === currentIndex);
    loadSong(n, true);
    return;
  }

  // At the last song: wrap around only if repeat-all is on
  if (currentIndex === playlist.length - 1) {
    if (repeatMode === "all") loadSong(0, true);
    return;
  }
  loadSong(currentIndex + 1, true);
}

function prevSong() {
  // Standard behaviour: if more than 3 seconds have played,
  // "previous" restarts the current song instead of going back.
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (currentIndex === 0) {
    if (repeatMode === "all") loadSong(playlist.length - 1, true);
    return;
  }
  loadSong(currentIndex - 1, true);
}

nextBtn.addEventListener("click", nextSong);
prevBtn.addEventListener("click", prevSong);

// Grey out Prev at the start and Next at the end of the playlist
// (unless shuffle or repeat-all makes them meaningful again).
function updateBoundaryButtons() {
  const wraps = shuffleOn || repeatMode === "all";
  prevBtn.disabled = !wraps && currentIndex === 0;
  nextBtn.disabled = !wraps && currentIndex === playlist.length - 1;
}

/* ---------------------------------------------------------
   7. WHEN A SONG ENDS
   --------------------------------------------------------- */
audio.addEventListener("ended", () => {
  if (repeatMode === "one") {          // repeat this song
    audio.currentTime = 0;
    playSong();
    return;
  }
  if (!AUTOPLAY) return;               // autoplay disabled: just stop
  nextSong();                          // otherwise move on automatically
});

/* ---------------------------------------------------------
   8. PROGRESS BAR
   --------------------------------------------------------- */

// The browser fires "loadedmetadata" once it knows how long the file is
audio.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audio.duration);

  // also correct the length shown in the playlist row
  const row = listEl.children[currentIndex];
  if (row) row.querySelector(".song__len").textContent = formatTime(audio.duration);
});

// "timeupdate" fires roughly 4 times a second while playing
audio.addEventListener("timeupdate", () => {
  if (isDragging || !audio.duration) return;    // don't fight the user's drag
  const percent = (audio.currentTime / audio.duration) * 100;
  filledEl.style.width = percent + "%";
  knobEl.style.left = percent + "%";
  currentEl.textContent = formatTime(audio.currentTime);
  progressEl.setAttribute("aria-valuenow", Math.round(percent));
});

// Work out where along the bar a click or touch happened (0 to 1)
function positionToRatio(clientX) {
  const rect = progressEl.querySelector(".progress__track").getBoundingClientRect();
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

// Move the visual bar without touching the audio yet (used while dragging)
function previewSeek(ratio) {
  filledEl.style.width = ratio * 100 + "%";
  knobEl.style.left = ratio * 100 + "%";
  if (audio.duration) currentEl.textContent = formatTime(ratio * audio.duration);
}

// Actually jump the audio to that point
function commitSeek(ratio) {
  if (audio.duration) audio.currentTime = ratio * audio.duration;
}

// --- mouse: click to seek, hold and drag to scrub ---
progressEl.addEventListener("mousedown", (e) => {
  isDragging = true;
  progressEl.classList.add("is-dragging");
  previewSeek(positionToRatio(e.clientX));
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) previewSeek(positionToRatio(e.clientX));
});

document.addEventListener("mouseup", (e) => {
  if (!isDragging) return;
  isDragging = false;
  progressEl.classList.remove("is-dragging");
  commitSeek(positionToRatio(e.clientX));
});

// --- touch: same idea for phones and tablets ---
progressEl.addEventListener("touchstart", (e) => {
  isDragging = true;
  progressEl.classList.add("is-dragging");
  previewSeek(positionToRatio(e.touches[0].clientX));
}, { passive: true });

progressEl.addEventListener("touchmove", (e) => {
  if (isDragging) previewSeek(positionToRatio(e.touches[0].clientX));
}, { passive: true });

progressEl.addEventListener("touchend", (e) => {
  if (!isDragging) return;
  isDragging = false;
  progressEl.classList.remove("is-dragging");
  commitSeek(positionToRatio(e.changedTouches[0].clientX));
});

// --- keyboard: arrow keys seek by 5 seconds when the bar is focused ---
progressEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  if (e.key === "ArrowLeft")  audio.currentTime = Math.max(0, audio.currentTime - 5);
});

/* ---------------------------------------------------------
   9. VOLUME
   --------------------------------------------------------- */
audio.volume = parseFloat(volumeSlider.value);

volumeSlider.addEventListener("input", () => {
  audio.volume = parseFloat(volumeSlider.value);
  audio.muted = false;
  updateVolumeIcon();
});

muteBtn.addEventListener("click", () => {
  audio.muted = !audio.muted;
  updateVolumeIcon();
});

function updateVolumeIcon() {
  const silent = audio.muted || audio.volume === 0;
  volIcon.innerHTML = `<path d="${silent ? ICON_MUTE : ICON_VOL}"/>`;
  muteBtn.title = silent ? "Unmute" : "Mute";
}

/* ---------------------------------------------------------
   10. SHUFFLE AND REPEAT
   --------------------------------------------------------- */
shuffleBtn.addEventListener("click", () => {
  shuffleOn = !shuffleOn;
  shuffleBtn.setAttribute("aria-pressed", String(shuffleOn));
  shuffleBtn.title = shuffleOn ? "Shuffle on" : "Shuffle";
  updateBoundaryButtons();
});

repeatBtn.addEventListener("click", () => {
  // cycle: off -> all -> one -> off
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  repeatBtn.setAttribute("aria-pressed", String(repeatMode !== "off"));
  repeatBtn.title =
    repeatMode === "off" ? "Repeat off" :
    repeatMode === "all" ? "Repeat playlist" : "Repeat this song";

  // add a small "1" to the icon when repeating a single song
  repeatIcon.innerHTML =
    repeatMode === "one"
      ? '<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/><path d="M11 10.6l1.6-.9h1v5.3h-1.4v-3.6l-1.2.6z"/>'
      : '<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/>';

  updateBoundaryButtons();
});

/* ---------------------------------------------------------
   11. KEYBOARD SHORTCUTS (whole page)
   --------------------------------------------------------- */
document.addEventListener("keydown", (e) => {
  // ignore keys typed into inputs or aimed at the focused progress bar
  if (e.target.tagName === "INPUT" || e.target === progressEl) return;

  if (e.code === "Space") {
    e.preventDefault();                     // stop the page from scrolling
    audio.paused ? playSong() : pauseSong();
  } else if (e.key === "ArrowRight") {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  } else if (e.key === "ArrowLeft") {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  } else if (e.key.toLowerCase() === "n") {
    nextSong();
  } else if (e.key.toLowerCase() === "p") {
    prevSong();
  } else if (e.key.toLowerCase() === "m") {
    audio.muted = !audio.muted;
    updateVolumeIcon();
  }
});

/* ---------------------------------------------------------
   12. START-UP
   --------------------------------------------------------- */
coverImg.onerror = function () { this.src = FALLBACK_COVER; };

renderPlaylist();
loadSong(0, false);        // load the first song but wait for the user to press Play
updateVolumeIcon();
