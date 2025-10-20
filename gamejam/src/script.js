import Axis from "axis-api";
import { Midi } from '@tonejs/midi';
import * as THREE from 'three';

// Debug: log incoming postMessage and keyboard events
window.addEventListener('message', (ev) => {
  if (!ev.data || typeof ev.data !== 'object') return;
  const msg = ev.data;

  // On attend des messages axis de type 'keydown' / 'keyup'
  if (msg.event === 'keydown' || msg.event === 'keyup') {
    const eventType = msg.event; // 'keydown' ou 'keyup'
    const rawKey = (msg.payload?.key || '').toString().toLowerCase();
    // controller id peut venir séparément, mais on permet aussi le suffixe dans la key (ex: 'a1')
    let controllerId = msg.payload?.id || msg.payload?.joystick || 1;
    let baseKey = rawKey;
    const m = rawKey.match(/^([a-z]+)(\d+)$/);
    if (m) {
      baseKey = m[1];
      controllerId = parseInt(m[2], 10) || controllerId;
    }

    const index = axisButtonToLaneIndex[baseKey];
    if (index === undefined) return;

    if (eventType === 'keydown') {
      if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) {
        if (!preStartDown[index]) {
          ensureClickBuffer();
          playClick();
          tryPlayMenuBgm();
          // visuel pressé
          if (index === 0 && menuBtnA) menuBtnA.src = '/images/btn_a_pressed.svg';
          if (index === 1 && menuBtnX) menuBtnX.src = '/images/btn_x_pressed.svg';
          if (index === 2 && menuBtnI) menuBtnI.src = '/images/btn_i_pressed.svg';
          if (index === 3 && menuBtnS) menuBtnS.src = '/images/btn_s_pressed.svg';
          if (index === 0 && menuBtnA) menuBtnA.classList.add('pressed-scale');
          if (index === 1 && menuBtnX) menuBtnX.classList.add('pressed-scale');
          if (index === 2 && menuBtnI) menuBtnI.classList.add('pressed-scale');
          if (index === 3 && menuBtnS) menuBtnS.classList.add('pressed-scale');
        }
        preStartDown[index] = true;
        if (preStartDown.every(Boolean)) startGame();
        return;
      }

      // En jeu
      console.log('[gamejam] remote keydown', rawKey, 'parsed:', baseKey, 'controller=', controllerId, 'lane', index);
      handleAxisDownByIndex(index, controllerId);
      lightZone(index);
    } else if (eventType === 'keyup') {
      if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) {
        preStartDown[index] = false;
        // visuel relâché
        if (index === 0 && menuBtnA) menuBtnA.src = '/images/btn_a.svg';
        if (index === 1 && menuBtnX) menuBtnX.src = '/images/btn_x.svg';
        if (index === 2 && menuBtnI) menuBtnI.src = '/images/btn_i.svg';
        if (index === 3 && menuBtnS) menuBtnS.src = '/images/btn_s.svg';
        if (index === 0 && menuBtnA) menuBtnA.classList.remove('pressed-scale');
        if (index === 1 && menuBtnX) menuBtnX.classList.remove('pressed-scale');
        if (index === 2 && menuBtnI) menuBtnI.classList.remove('pressed-scale');
        if (index === 3 && menuBtnS) menuBtnS.classList.remove('pressed-scale');
        return;
      }

      console.log('[gamejam] remote keyup', rawKey, 'parsed:', baseKey, 'controller=', controllerId, 'lane', index);
      handleAxisUpByIndex(index, controllerId);
    }
  }
});

window.addEventListener('keydown', (e) => {
  try { console.log('[gamejam] keydown event', e.key, e.code); } catch(_) {}
});

// --- Cercles flottants en background ---
function randomBetween(a, b) { return a + Math.random() * (b - a); }
const CIRCLE_COUNT = 24;
const circles = [];
const canvasBg = document.getElementById('floating-circles-bg');
const ctxBg = canvasBg ? canvasBg.getContext('2d') : null;
function resizeCanvasBg() {
  if (!canvasBg) return;
  canvasBg.width = window.innerWidth;
  canvasBg.height = window.innerHeight;
}
if (canvasBg) resizeCanvasBg();
window.addEventListener('resize', resizeCanvasBg);

function createCircles() {
  circles.length = 0;
  for (let i = 0; i < CIRCLE_COUNT; i++) {
    const isSmall = Math.random() < 0.6;
    circles.push({
      x: randomBetween(0, window.innerWidth),
      y: randomBetween(0, window.innerHeight),
      r: isSmall ? randomBetween(8, 18) : randomBetween(22, 38),
      speed: randomBetween(0.12, 0.38),
      drift: randomBetween(-0.12, 0.12),
      alpha: randomBetween(0.13, 0.28),
    });
  }
}
if (canvasBg) createCircles();
window.addEventListener('resize', createCircles);

function animateCircles() {
  if (!ctxBg || !canvasBg) return;
  ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
  for (const c of circles) {
    ctxBg.save();
    ctxBg.globalAlpha = c.alpha;
    ctxBg.beginPath();
    ctxBg.arc(c.x, c.y, c.r, 0, 2 * Math.PI);
    ctxBg.fillStyle = '#fff';
    ctxBg.shadowColor = '#fff';
    ctxBg.shadowBlur = 12;
    ctxBg.fill();
    ctxBg.restore();
    c.y -= c.speed;
    c.x += c.drift;
    if (c.y + c.r < 0) {
      c.y = canvasBg.height + c.r;
      c.x = randomBetween(0, canvasBg.width);
    }
    if (c.x < -c.r) c.x = canvasBg.width + c.r;
    if (c.x > canvasBg.width + c.r) c.x = -c.r;
  }
  requestAnimationFrame(animateCircles);
}
if (canvasBg) animateCircles();
// --- FIN cercles flottants ---

// const startBtn = document.getElementById("start-btn");
const scoreDisplay = document.getElementById("score");
const menuOverlay = document.getElementById("menu-overlay");
const threeContainer = document.getElementById('three-container');
const loaderEl = document.getElementById('loader');
const loaderImg = document.getElementById('loader-img');
const menuBtnA = document.getElementById('btn-a');
const menuBtnX = document.getElementById('btn-x');
const menuBtnI = document.getElementById('btn-i');
const menuBtnS = document.getElementById('btn-s');
const menuBgmEl = typeof document !== 'undefined' ? document.getElementById('menu-bgm') : null;
const songSelect = typeof document !== 'undefined' ? document.getElementById('song-select') : null;
const songOverlay = typeof document !== 'undefined' ? document.getElementById('song-overlay') : null;
const bottomStart = typeof document !== 'undefined' ? document.getElementById('bottom-start') : null;
const songStartBtn = typeof document !== 'undefined' ? document.getElementById('song-start') : null;
const btnBackSelect = typeof document !== 'undefined' ? document.getElementById('btn-back-select') : null;

// Fonctions de navigation du sélecteur supprimées - non utilisées

// --- Audio ---
const audio = new Audio("https://pub-effda59cee7b400ea8fec55faec80581.r2.dev/i%20like%20the%20way%20you%20kiss%20me.mp3");
audio.preload = "auto";
// click sound (low-latency via WebAudio, with HTMLAudio fallback)
const CLICK_URL = 'https://pub-effda59cee7b400ea8fec55faec80581.r2.dev/bip.mp3';
let audioCtx = null;
let clickBuffer = null;
// Use preloaded <audio> element from HTML if available
const clickFallbackEl = (typeof document !== 'undefined' && document.getElementById('click-preload')) || new Audio(CLICK_URL);
try { clickFallbackEl.preload = 'auto'; } catch {}

function ensureAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

async function ensureClickBuffer() {
  if (clickBuffer) return clickBuffer;
  ensureAudioContext();
  try {
    const res = await fetch(CLICK_URL);
    const arr = await res.arrayBuffer();
    clickBuffer = await audioCtx.decodeAudioData(arr);
  } catch (e) {
    // fallback will be used
  }
  return clickBuffer;
}

function playClick() {
  try {
    ensureAudioContext();
    if (clickBuffer && audioCtx) {
      const src = audioCtx.createBufferSource();
      src.buffer = clickBuffer;
      src.connect(audioCtx.destination);
      src.start(0);
    } else {
      // fallback while buffer not ready
      clickFallbackEl.currentTime = 0;
      clickFallbackEl.play().catch(() => {});
    }
  } catch (err) {
    // ignore playback errors
  }
}

// --- Variables ---
let notes = [];
let score = 0;
let startTime = 0;
let started = false;
let midiData = null;
let scheduledNotes = [];
let nextNoteIndex = 0;
let lastNoteTime = 0;
let scene, camera, renderer;
// Hit zones (remplacent les lanes visibles)
let hitMeshes = [];
let noteMeshes = [];
let noteSpeed = 4; // unités/second
let laneHitZ = -0.5;
const SPAWN_Z = -12; // position Z de spawn des notes
let TIMING_OFFSET = -0.25; // secondes; fixé à -250ms
const HIT_REPEAT_COOLDOWN = 0.08; // secondes entre deux hits quand on maintient
const STUCK_RESET_MS = 1200; // si une touche est "down" trop longtemps sans update, on reset

// Utiliser THREE.Clock pour des deltas propres
const clock = new THREE.Clock();

// --- Input state ---
const inputPressed = [];
const lastHitAt = [];
const lastKeyEventAt = [];
// Pré-start: suivi des touches enfoncées pour lancer quand les 4 sont down
const preStartDown = new Array(4).fill(false);
function resetPreStartDown() {
  for (let i = 0; i < preStartDown.length; i++) preStartDown[i] = false;
  // restore menu button images
  if (menuBtnA) menuBtnA.src = '/images/btn_a.svg';
  if (menuBtnX) menuBtnX.src = '/images/btn_x.svg';
  if (menuBtnI) menuBtnI.src = '/images/btn_i.svg';
  if (menuBtnS) menuBtnS.src = '/images/btn_s.svg';
}

function resetAllInputs() {
  for (let i = 0; i < availableKeys.length; i++) {
    inputPressed[i] = false;
    lastHitAt[i] = 0;
    lastKeyEventAt[i] = 0;
  }
}

// --- Touches disponibles (utiliser e.code, plus fiable) ---
const availableKeys = ['KeyQ', 'KeyS', 'KeyD', 'KeyF']; // Q, S, D, F
const laneSpacing = 1.2;

// initialise dynamiquement les tableaux d'input en fonction du nombre de lanes
function initInputArrays() {
  for (let i = 0; i < availableKeys.length; i++) {
    inputPressed[i] = false;
    lastHitAt[i] = 0;
    lastKeyEventAt[i] = 0;
  }
}
initInputArrays();

function laneX(index) {
  const center = (availableKeys.length - 1) / 2;
  return (index - center) * laneSpacing;
}

// --- Mapping des notes MIDI aux lanes ---
let noteCount = 0;
function mapMidiNoteToLane(midiNote) {
  const laneIndex = midiNote % 4;
  const key = availableKeys[laneIndex];
  if (noteCount < 10) {
    console.log(`Note MIDI ${midiNote} -> Lane ${laneIndex} (key: ${key})`);
    noteCount++;
  }
  return key;
}

// --- Création d'une note ---
let noteColorToggle = false;
function spawnNote(key) {
  const geometry = new THREE.BoxGeometry(0.8, 0.2, .8);
  // Alterne entre rouge et blanc
  const color = noteColorToggle ? 0xffffff : 0xff0000;
  noteColorToggle = !noteColorToggle;
  const material = new THREE.MeshStandardMaterial({ color: color, emissive: 0x220000, transparent: true, opacity: 0 });
  const mesh = new THREE.Mesh(geometry, material);

  const laneIndex = availableKeys.indexOf(key);
  const x = laneX(laneIndex);
  mesh.position.set(x, -0.8, SPAWN_Z);
  mesh.userData = {
    fadeIn: true,
    fadeOut: false,
    spawnTime: performance.now(),
    hit: false
  };
  scene.add(mesh);
  noteMeshes.push(mesh);
}

// Tentative de hit sur une lane (index 0..3)
// IMPORTANT: on met à jour lastHitAt même si le hit rate (pour permettre le spam)
function attemptHit(index) {
  const now = performance.now() / 1000;
  lastHitAt[index] = now; // <-- mise à jour dès la tentative (évite blocage de répétition)

  const x = laneX(index);
  const hitIndex = noteMeshes.findIndex(m => Math.abs(m.position.x - x) < .9 && Math.abs(m.position.z - laneHitZ) < 1.3);
  if (hitIndex !== -1) {
    const m = noteMeshes[hitIndex];
    // Empêche d'ajouter le score plusieurs fois pour la même note
    if (!m.userData.hit) {
      score += 100;
      scoreDisplay.textContent = `Score : ${score}`;
      flashLane(index);
    }
    // Lancer le fade-out au lieu de supprimer immédiatement
    m.userData.fadeOut = true;
    m.userData.fadeIn = false;
    m.userData.hit = true;
    m.userData.fadeStart = performance.now();
    return true;
  }
  // feedback optionnel (miss)
  return false;
}

// --- Chargement MIDI (identique, inchangé sauf logs) ---
async function loadMidiFile() {
  try {
    console.log('Chargement du fichier MIDI...');
    const response = await fetch('https://pub-effda59cee7b400ea8fec55faec80581.r2.dev/test_Artemas_midi.midi');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    midiData = new Midi(arrayBuffer);

    scheduledNotes = [];
    midiData.tracks.forEach(track => {
      track.notes.forEach(note => {
        scheduledNotes.push({
          time: note.time,
          key: mapMidiNoteToLane(note.midi),
          duration: note.duration
        });
      });
    });

    scheduledNotes.sort((a,b) => a.time - b.time);
    // Espacer légèrement les notes consécutives sur la même lane (évite qu'elles se collent)
    const MIN_SAME_LANE_GAP_S = 0.05; // 50 ms
    const lastTimePerLane = new Array(availableKeys.length).fill(-Infinity);
    for (const n of scheduledNotes) {
      const lane = availableKeys.indexOf(n.key);
      if (lane !== -1) {
        const minTime = lastTimePerLane[lane] + MIN_SAME_LANE_GAP_S;
        if (n.time < minTime) n.time = minTime;
        lastTimePerLane[lane] = n.time;
      }
    }
    console.log(`MIDI chargé: ${scheduledNotes.length} notes trouvées`);
    console.log('Durée totale:', midiData.duration, 'secondes');
  } catch (error) {
    console.error('Erreur lors du chargement du fichier MIDI:', error);
    console.warn('Le jeu utilisera la génération de notes aléatoires à la place');
  }
}

// --- Génération et fallback ---
function generateMidiNotes(currentTime) {
  while (nextNoteIndex < scheduledNotes.length) {
    const scheduledNote = scheduledNotes[nextNoteIndex];
    // Calcule le temps de trajet pour arriver à la zone de hit
    const travelTime = Math.abs(SPAWN_Z - laneHitZ) / noteSpeed;
    // On spawn en avance pour que la note arrive pile à time
    const spawnTime = scheduledNote.time - travelTime - TIMING_OFFSET;
    if (currentTime >= spawnTime) {
      spawnNote(scheduledNote.key);
      nextNoteIndex++;
    } else break;
  }
}

// Suppression du fallback de notes aléatoires — on se fie uniquement aux notes MIDI

// Ancienne fonction update supprimée - maintenant géré dans renderLoop()


// --- Démarrer la partie ---
function startGame() {
  if (started) return;
  started = true;
  // Décaler le menu vers le haut avec animation de zoom et fade out
  if (menuOverlay) {
    menuOverlay.classList.add("slide-out");
    // Cacher complètement après l'animation
    setTimeout(() => {
      menuOverlay.classList.add("hidden");
    }, 1200);
  }
  // Stop menu music when game starts
  try { if (menuBgmEl) { menuBgmEl.pause(); menuBgmEl.currentTime = 0; } } catch {}

  nextNoteIndex = 0;
  lastNoteTime = 0;

  audio.currentTime = 0;
  audio.play();
}

// Fonctions du sélecteur de chansons supprimées

window.addEventListener('keydown', (e) => {
  const codeIdx = availableKeys.indexOf(e.code);
  if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) {
    if (codeIdx !== -1) {
      // Only on transition to down
      if (!preStartDown[codeIdx]) {
        // Prime WebAudio buffer on first gesture
        ensureClickBuffer();
        playClick();
        tryPlayMenuBgm();
      }
      preStartDown[codeIdx] = true;
      // change menu button image to pressed
      if (codeIdx === 0 && menuBtnA) menuBtnA.src = '/images/btn_a_pressed.svg';
      if (codeIdx === 1 && menuBtnX) menuBtnX.src = '/images/btn_x_pressed.svg';
      if (codeIdx === 2 && menuBtnI) menuBtnI.src = '/images/btn_i_pressed.svg';
      if (codeIdx === 3 && menuBtnS) menuBtnS.src = '/images/btn_s_pressed.svg';
      // scale pressed visual
      if (codeIdx === 0 && menuBtnA) menuBtnA.classList.add('pressed-scale');
      if (codeIdx === 1 && menuBtnX) menuBtnX.classList.add('pressed-scale');
      if (codeIdx === 2 && menuBtnI) menuBtnI.classList.add('pressed-scale');
      if (codeIdx === 3 && menuBtnS) menuBtnS.classList.add('pressed-scale');
      if (preStartDown.every(Boolean)) {
        // Lancer le jeu directement
        startGame();
      }
    }
    return;
  }
  if (codeIdx !== -1) {
    e.preventDefault();
    inputPressed[codeIdx] = true;
    lastKeyEventAt[codeIdx] = performance.now();
    // hit immédiat sur appui
    attemptHit(codeIdx);
    lightZone(codeIdx);
  }
});

window.addEventListener('keyup', (e) => {
  const codeIdx = availableKeys.indexOf(e.code);
  if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) {
    if (codeIdx !== -1) {
      preStartDown[codeIdx] = false;
      // restore menu button image
      if (codeIdx === 0 && menuBtnA) menuBtnA.src = '/images/btn_a.svg';
      if (codeIdx === 1 && menuBtnX) menuBtnX.src = '/images/btn_x.svg';
      if (codeIdx === 2 && menuBtnI) menuBtnI.src = '/images/btn_i.svg';
      if (codeIdx === 3 && menuBtnS) menuBtnS.src = '/images/btn_s.svg';
      // remove pressed-scale
      if (codeIdx === 0 && menuBtnA) menuBtnA.classList.remove('pressed-scale');
      if (codeIdx === 1 && menuBtnX) menuBtnX.classList.remove('pressed-scale');
      if (codeIdx === 2 && menuBtnI) menuBtnI.classList.remove('pressed-scale');
      if (codeIdx === 3 && menuBtnS) menuBtnS.classList.remove('pressed-scale');
    }
    return;
  }
  if (codeIdx !== -1) {
    inputPressed[codeIdx] = false;
    lastKeyEventAt[codeIdx] = performance.now();
  }
});

// --- Axis API (unchanged mais assure la cohérence des indices) ---
const axisButtonToLaneIndex = {
  a: 0,
  q: 0, // support AZERTY where the physical Q key produces 'a' positionally
  x: 1,
  i: 2,
  s: 3,
};

function handleAxisDownByIndex(index, controllerId = 1) {
  console.log(`[gamejam] handleAxisDownByIndex controller=${controllerId} index=${index}`);
  inputPressed[index] = true;
  lastKeyEventAt[index] = performance.now();
  attemptHit(index);
}

function handleAxisUpByIndex(index, controllerId = 1) {
  console.log(`[gamejam] handleAxisUpByIndex controller=${controllerId} index=${index}`);
  inputPressed[index] = false;
  lastKeyEventAt[index] = performance.now();
}

try {
  if (Axis && typeof Axis.addEventListener === "function") {
    Axis.addEventListener("keydown", (e) => {
      if (!e) return;
      if (e.id !== 1) return;
      const key = (e.key || "").toString().toLowerCase();
      const index = axisButtonToLaneIndex[key];
      if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) {
        if (index !== undefined) {
          if (!preStartDown[index]) {
            ensureClickBuffer();
            playClick();
            tryPlayMenuBgm();
            // changer l'image du bouton correspondant en "pressed"
            if (index === 0 && menuBtnA) menuBtnA.src = '/images/btn_a_pressed.svg';
            if (index === 1 && menuBtnX) menuBtnX.src = '/images/btn_x_pressed.svg';
            if (index === 2 && menuBtnI) menuBtnI.src = '/images/btn_i_pressed.svg';
            if (index === 3 && menuBtnS) menuBtnS.src = '/images/btn_s_pressed.svg';
            // add pressed-scale
            if (index === 0 && menuBtnA) menuBtnA.classList.add('pressed-scale');
            if (index === 1 && menuBtnX) menuBtnX.classList.add('pressed-scale');
            if (index === 2 && menuBtnI) menuBtnI.classList.add('pressed-scale');
            if (index === 3 && menuBtnS) menuBtnS.classList.add('pressed-scale');
          }
          preStartDown[index] = true;
          if (preStartDown.every(Boolean)) {
            // Lancer le jeu directement
            startGame();
          }
        }
        return;
      }
      if (index !== undefined) {
        handleAxisDownByIndex(index);
        lightZone(index);
      }
    });

    Axis.addEventListener("keyup", (e) => {
      if (!e) return;
      if (e.id !== 1) return;
      const key = (e.key || "").toString().toLowerCase();
      const index = axisButtonToLaneIndex[key];
      if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) {
        if (index !== undefined) {
          preStartDown[index] = false;
          // restaurer l'image du bouton
          if (index === 0 && menuBtnA) menuBtnA.src = '/images/btn_a.svg';
          if (index === 1 && menuBtnX) menuBtnX.src = '/images/btn_x.svg';
          if (index === 2 && menuBtnI) menuBtnI.src = '/images/btn_i.svg';
          if (index === 3 && menuBtnS) menuBtnS.src = '/images/btn_s.svg';
          // remove pressed-scale
          if (index === 0 && menuBtnA) menuBtnA.classList.remove('pressed-scale');
          if (index === 1 && menuBtnX) menuBtnX.classList.remove('pressed-scale');
          if (index === 2 && menuBtnI) menuBtnI.classList.remove('pressed-scale');
          if (index === 3 && menuBtnS) menuBtnS.classList.remove('pressed-scale');
        }
        return;
      }
      if (index !== undefined) handleAxisUpByIndex(index);
    });
  }
} catch (err) {
  // ignore Axis errors
}

// --- Démarrer via bouton ---
// startBtn.addEventListener("click", startGame);

// --- Initialisation ---
loadMidiFile();
initThree();

// Démarrer l'animation du jeu en arrière-plan immédiatement
clock.start();
renderLoop();

// Fonction de rendu en boucle continue (pour le background)
function renderLoop() {
  const delta = clock.getDelta();
  
  // Si le jeu est démarré, générer et animer les notes
  if (started) {
    const currentTime = audio.currentTime;
    if (midiData && scheduledNotes.length > 0) {
      generateMidiNotes(currentTime);
    }

    // Déplacement des notes avec delta
    for (let i = noteMeshes.length - 1; i >= 0; i--) {
      const m = noteMeshes[i];
      m.position.z += noteSpeed * delta;
      // Fade-in
      if (m.userData.fadeIn) {
        m.material.opacity = Math.min(1, m.material.opacity + delta * 4);
        if (m.material.opacity >= 1) {
          m.material.opacity = 1;
          m.userData.fadeIn = false;
        }
      }
      // Fade-out si hit ou hors écran
      if ((m.position.z > 2 || m.userData.fadeOut)) {
        m.material.opacity = Math.max(0, m.material.opacity - delta * 4);
        if (m.material.opacity <= 0) {
          scene.remove(m);
          noteMeshes.splice(i, 1);
          continue;
        }
      }
    }

    // Répéter les hits tant que la touche est maintenue 
    const now = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      if (inputPressed[i]) {
        if ((now - (lastHitAt[i] || 0)) >= HIT_REPEAT_COOLDOWN) {
          attemptHit(i);
        }
      }
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

// Démarrage: init du buffer de clic dès que possible (après interaction, le cas échéant)
// On tente malgré tout pour bénéficier du cache créé par le <audio preload>
ensureClickBuffer();
// Tente de jouer la musique du menu immédiatement (autoplay peut être bloqué par le navigateur)
try { if (!started) { tryPlayMenuBgm(); } } catch {}

// Précharger les images "pressed" pour éviter le délai au premier swap
try {
  const pressedImgs = [
    '/images/btn_a_pressed.svg',
    '/images/btn_x_pressed.svg',
    '/images/btn_i_pressed.svg',
    '/images/btn_s_pressed.svg',
  ];
  pressedImgs.forEach(src => { const img = new Image(); img.src = src; });
} catch {}

// Lecture de la musique de menu (après première interaction pour éviter les blocages autoplay)
// Si l'utilisateur presse une touche du menu, on lance la BGM si elle n'est pas déjà en lecture
function tryPlayMenuBgm() {
  if (!started && menuBgmEl) {
    menuBgmEl.volume = 0.6; // volume modéré
    menuBgmEl.play().catch(() => {});
  }
}

// Sélecteur de musique supprimé

// play click on menu images only on press transition
try {
  const pressed = { a:false, x:false, i:false, s:false };
  const btnBack = (typeof document !== 'undefined') ? document.getElementById('btn-back') : null;
  if (menuBtnA) {
    menuBtnA.addEventListener('pointerdown', () => { if (!started && menuOverlay && !menuOverlay.classList.contains('hidden') && !pressed.a) { ensureClickBuffer(); playClick(); tryPlayMenuBgm(); pressed.a = true; if (preStartDown) preStartDown[0] = true; if (preStartDown.every(Boolean)) startGame(); } if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnA.classList.add('pressed-scale'); });
    menuBtnA.addEventListener('pointerup',   () => { pressed.a = false; if (preStartDown) preStartDown[0] = false; });
    menuBtnA.addEventListener('pointerleave',() => { pressed.a = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnA.classList.remove('pressed-scale'); if (preStartDown) preStartDown[0] = false; });
    menuBtnA.addEventListener('pointercancel',() => { pressed.a = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnA.classList.remove('pressed-scale'); if (preStartDown) preStartDown[0] = false; });
  }
  if (menuBtnX) {
    menuBtnX.addEventListener('pointerdown', () => { if (!started && menuOverlay && !menuOverlay.classList.contains('hidden') && !pressed.x) { ensureClickBuffer(); playClick(); tryPlayMenuBgm(); pressed.x = true; if (preStartDown) preStartDown[1] = true; if (preStartDown.every(Boolean)) startGame(); } if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnX.classList.add('pressed-scale'); });
    menuBtnX.addEventListener('pointerup',   () => { pressed.x = false; if (preStartDown) preStartDown[1] = false; });
    menuBtnX.addEventListener('pointerleave',() => { pressed.x = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnX.classList.remove('pressed-scale'); if (preStartDown) preStartDown[1] = false; });
    menuBtnX.addEventListener('pointercancel',() => { pressed.x = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnX.classList.remove('pressed-scale'); if (preStartDown) preStartDown[1] = false; });
  }
  if (menuBtnI) {
    menuBtnI.addEventListener('pointerdown', () => { if (!started && menuOverlay && !menuOverlay.classList.contains('hidden') && !pressed.i) { ensureClickBuffer(); playClick(); tryPlayMenuBgm(); pressed.i = true; if (preStartDown) preStartDown[2] = true; if (preStartDown.every(Boolean)) startGame(); } if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnI.classList.add('pressed-scale'); });
    menuBtnI.addEventListener('pointerup',   () => { pressed.i = false; if (preStartDown) preStartDown[2] = false; });
    menuBtnI.addEventListener('pointerleave',() => { pressed.i = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnI.classList.remove('pressed-scale'); if (preStartDown) preStartDown[2] = false; });
    menuBtnI.addEventListener('pointercancel',() => { pressed.i = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnI.classList.remove('pressed-scale'); if (preStartDown) preStartDown[2] = false; });
  }
  if (menuBtnS) {
    menuBtnS.addEventListener('pointerdown', () => { if (!started && menuOverlay && !menuOverlay.classList.contains('hidden') && !pressed.s) { ensureClickBuffer(); playClick(); tryPlayMenuBgm(); pressed.s = true; if (preStartDown) preStartDown[3] = true; if (preStartDown.every(Boolean)) startGame(); } if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnS.classList.add('pressed-scale'); });
    menuBtnS.addEventListener('pointerup',   () => { pressed.s = false; if (preStartDown) preStartDown[3] = false; });
    menuBtnS.addEventListener('pointerleave',() => { pressed.s = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnS.classList.remove('pressed-scale'); if (preStartDown) preStartDown[3] = false; });
    menuBtnS.addEventListener('pointercancel',() => { pressed.s = false; if (!started && menuOverlay && !menuOverlay.classList.contains('hidden')) menuBtnS.classList.remove('pressed-scale'); if (preStartDown) preStartDown[3] = false; });
  }
  // back button pressed visual
  if (btnBack) {
    btnBack.addEventListener('pointerdown', () => { if (!started) tryPlayMenuBgm(); btnBack.src = '/images/btn_back_pressed.svg'; });
    const restore = () => { btnBack.src = '/images/btn_back.svg'; };
    btnBack.addEventListener('pointerup', restore);
    btnBack.addEventListener('pointerleave', restore);
    btnBack.addEventListener('pointercancel', restore);
  }
} catch {}

// Loader: choisir un vinyle au hasard et fade-out après 2000ms
try {
  if (loaderEl && loaderImg) {
    const choice = Math.random() < 0.5 ? '/images/vinyle1.png' : '/images/vinyle2.png';
    loaderImg.src = choice;
    setTimeout(() => {
      loaderEl.classList.add('fade-out');
      // retire du DOM après l'animation
      setTimeout(() => loaderEl.remove(), 450);

  // Receive axis-event messages from parent (elevator) and trigger internal handlers
    }, 3500);
  }
} catch {}

// --- Three.js init (idem + clock) ---
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xFF5FBB);

  const w = threeContainer.clientWidth || window.innerWidth;
  const h = threeContainer.clientHeight || window.innerHeight;
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
  camera.position.set(0, 1.8, 4.5);
  camera.lookAt(0, -0.6, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  threeContainer.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  const groundGeo = new THREE.PlaneGeometry(6.4, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -2.2;
  scene.add(ground);

  // Création dynamique des hit zones (éteintes par défaut)
  const hitGeo = new THREE.BoxGeometry(1.1, 0.05, 1.5);
  for (let i = 0; i < availableKeys.length; i++) {
    const hitMat = new THREE.MeshBasicMaterial({ color: 0xff30c1, transparent: true, opacity: 0.56 });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(laneX(i), -1.0, laneHitZ);
    scene.add(hit);
    // sauvegarder l'état par défaut
    hit.userData = hit.userData || {};
    hit.userData.defaultColor = hitMat.color.clone();
    hit.userData.defaultOpacity = hitMat.opacity;
    hit.userData.defaultScaleX = hit.scale.x;
    hit.userData.defaultScaleZ = hit.scale.z;
    hitMeshes.push(hit);
  }

  window.addEventListener('resize', onResize);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function flashLane(index) {
  // compat ancien nom -> utilise hitMeshes
  const zone = hitMeshes[index];
  if (!zone) return;
  const mat = zone.material;
  // annule timeout préexistant
  if (zone.userData._flashTimeout) clearTimeout(zone.userData._flashTimeout);

  // applique l'effet flash
  mat.color.set(0x4a6cff);
  mat.opacity = Math.max(zone.userData.defaultOpacity, 0.6);

  // restaure proprement
  zone.userData._flashTimeout = setTimeout(() => {
    if (!zone.userData) return;
    mat.color.copy(zone.userData.defaultColor);
    mat.opacity = zone.userData.defaultOpacity;
    zone.userData._flashTimeout = null;
  }, 120);
}

function lightZone(index) {
  const zone = hitMeshes[index];
  if (!zone) return;
  const mat = zone.material;
  // annule le timeout précédent si présent
  if (zone.userData._lightTimeout) clearTimeout(zone.userData._lightTimeout);

  // applique l'état "on"
  mat.color.set(0x00ff88);
  mat.opacity = 0.85;
  zone.scale.set(zone.userData.defaultScaleX * 1.05, zone.scale.y, zone.userData.defaultScaleZ * 1.05);

  // restaure proprement après délai
  zone.userData._lightTimeout = setTimeout(() => {
    if (!zone.userData) return;
    mat.color.copy(zone.userData.defaultColor);
    mat.opacity = zone.userData.defaultOpacity;
    zone.scale.set(zone.userData.defaultScaleX, zone.scale.y, zone.userData.defaultScaleZ);
    zone.userData._lightTimeout = null;
  }, 180);
}

// Eviter touches collées si perte de focus/visibilité
window.addEventListener('blur', resetAllInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) resetAllInputs();
});

// --- Cleanup périodique pour éviter les touches bloquées ---
setInterval(() => {
  const now = performance.now();
  for (let i = 0; i < availableKeys.length; i++) {
    // si pas d'événement depuis STUCK_RESET_MS et inputPressed = true => reset
    if (inputPressed[i] && (now - (lastKeyEventAt[i] || 0) > STUCK_RESET_MS)) {
      inputPressed[i] = false;
    }
  }
}, 300);