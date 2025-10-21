import { db } from "./firebase.js";
import Axis from "axis-api";
import { gsap } from "gsap";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- LEADERBOARD CLASS ---
class Leaderboard {
  constructor() {
    this.leaderboard = null;
    this.scores = null;
    this.createLeaderboard();
  }

  createLeaderboard() {
    this.leaderboard = Axis.createLeaderboard({
      id: import.meta.env.VITE_GLOBALGAME_ID,
    });
  }

  async PostScore(score, name, gameID) {
    try {
      await this.leaderboard
        .postScore({
          username: name,
          gameID: gameID,
          value: score,
        })
        .then(() => {
          this.leaderboard.getScores().then((response) => {
            this.scores = response;
          });
        });
    } catch (error) {
      console.error("Error posting score to leaderboard:", error);
      throw error;
    }
  }

  async getScores() {
    try {
      const scores = await this.leaderboard.getScores();
      console.log("scores", scores);
      this.scores = scores;
      return scores;
    } catch (error) {
      console.error("Error fetching leaderboard scores:", error);
      throw error;
    }
  }

  filterTopScores(scores, topN = 10) {
    return scores.sort((a, b) => b.value - a.value).slice(0, topN);
  }

  filterTopScoresByGameID(scores, gameID, topN = 5) {
    return scores
      .filter((score) => score.gameID === gameID)
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  }
}

// Initialiser le leaderboard
const leaderboard = new Leaderboard();

// --- AJOUTER UN SCORE ---
async function addScore(gameId, playerName, score) {
  await addDoc(collection(db, "highscores"), {
    gameId,
    playerName,
    score,
    createdAt: Timestamp.now()
  });
  console.log(`✅ Score ajouté pour ${playerName} (${score})`);

  // Poster aussi sur le leaderboard Axis
  await leaderboard.PostScore(score, playerName, gameId.toString().padStart(2, '0'));

  loadScores(gameId); // recharge le classement
}

// --- RÉCUPÉRER LES TOP SCORES ---
async function getTopScores(gameId) {
  const q = query(
    collection(db, "highscores"),
    where("gameId", "==", gameId),
    orderBy("score", "desc"),
    limit(10)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// --- AFFICHER LES SCORES DANS LE DOM ---
async function loadScores(gameId) {
  const leaderboardContent = document.getElementById("leaderboardContent");
  leaderboardContent.innerHTML = "<div class='leaderboard-row'><div class='rank-name'><span class='player-name'>Chargement...</span></div></div>";

  try {
    // Récupérer les scores du leaderboard Axis
    const allScores = await leaderboard.getScores();
    console.log("📊 Tous les scores:", allScores);
    console.log("🎮 GameID recherché:", gameId.toString().padStart(2, '0'));
    const gameIdString = gameId.toString().padStart(2, '0');
    const scores = leaderboard.filterTopScoresByGameID(allScores, gameIdString, 8);
    console.log("✅ Scores filtrés pour ce jeu:", scores);

    leaderboardContent.innerHTML = "";

    if (scores.length === 0) {
      leaderboardContent.innerHTML = "<div class='leaderboard-row'><div class='rank-name'><span class='player-name'>Aucun score pour l'instant</span></div></div>";
      return;
    }

    scores.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      row.innerHTML = `
        <div class="rank-name">
          <span class="rank">${i + 1}</span>
          <span class="player-name">${s.username}</span>
        </div>
        <span class="score">${s.value.toLocaleString()} PTS</span>
      `;
      leaderboardContent.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading scores:", error);
    leaderboardContent.innerHTML = "<div class='leaderboard-row'><div class='rank-name'><span class='player-name'>Erreur de chargement</span></div></div>";
  }
}

let gameStarted = false;

const images = [
  "/game1.jpg",
  "/game2.jpg",
  "/game3.jpg",
  "/game4.jpg",
  "/game5.jpg",
  "/game6.jpg"
];

const gameUrls = [
  "https://gobelins-gamejam-2025.vercel.app/",
  "https://flippergj.vercel.app/",
  "https://gamejame.vercel.app/",
  "https://mathieu-a-un-grain.vercel.app/",
  "https://new-tableau1.vercel.app/",
  "https://gamejam-2025-gobelins-stage-3.netlify.app/",
]

let selectedButton = 6;
let gameFrameLoaded = false;
let gameFrameOrigin = '*';
const messageQueue = [];
let finishedGames = [];
let isTypingUsername = true; // dès le début, l’utilisateur doit entrer son pseudo

const input = document.querySelector("input#username");

Axis.virtualKeyboard.open();

Axis.virtualKeyboard.addEventListener("input", (username) => {
  input.value = username;
});

Axis.virtualKeyboard.addEventListener("validate", (username) => {
    Axis.virtualKeyboard.close();
    createSession(username);
    isTypingUsername = false; // 👈 active les contrôles après la saisie
    gsap.to("#usernameContainer", {
      duration: 0.5,
      opacity: 0,
      onComplete: () => {
        document.getElementById("usernameContainer").style.display = "none";
      }
    });
});

function joystickQuickmoveHandler(e) {
    if (isTypingUsername) return; // 🚫 bloque pendant la saisie du pseudo
  console.log(e);
  if (gameStarted) return;

  // Si le scoreboard est visible, naviguer entre les game-icons
  if (scoreboardVisible) {
    if (e.direction === "left") {
      if (selectedGameIcon > 0) {
        selectedGameIcon--;
        updateGameIcons();
      }
    } else if (e.direction === "right") {
      if (selectedGameIcon < 5) {
        selectedGameIcon++;
        updateGameIcons();
      }
    }
    return;
  }

  // Navigation normale entre les étages
  // Index 0 = ground, Index 1-6 = jeu1 à jeu6
  if (e.direction === "up") {
    if (selectedButton < 6) {
      // Retirer la classe active du bouton actuel
      const currentBtn = getButtonById(selectedButton);
      if (currentBtn) currentBtn.classList.remove("activeCircle");
      
      selectedButton++;
      
      // Ajouter la classe active au nouveau bouton
      const nextBtn = getButtonById(selectedButton);
      if (nextBtn) nextBtn.classList.add("activeCircle");
      
      // Ne pas charger les scores pour ground (index 0)
      if (selectedButton > 0) {
        loadScores(selectedButton - 1); // -1 car les jeux vont de 0 à 5
      }
    }
  }
  
  if (e.direction === "down") {
    if (selectedButton > 0) {
      // Retirer la classe active du bouton actuel
      const currentBtn = getButtonById(selectedButton);
      if (currentBtn) currentBtn.classList.remove("activeCircle");
      
      selectedButton--;
      
      // Ajouter la classe active au nouveau bouton
      const nextBtn = getButtonById(selectedButton);
      if (nextBtn) nextBtn.classList.add("activeCircle");
      
      // Ne pas charger les scores pour ground (index 0)
      if (selectedButton > 0) {
        loadScores(selectedButton - 1); // -1 car les jeux vont de 0 à 5
      }
    }
  }
  
  console.log("Selected button:", selectedButton);
}

// Fonction helper pour obtenir le bouton par index
function getButtonById(index) {
  const buttonIds = ["ground", "jeu1bouton", "jeu2bouton", "jeu3bouton", "jeu4bouton", "jeu5bouton", "jeu6bouton"];
  return document.getElementById(buttonIds[index]);
}

// Ajouter cette variable en haut avec les autres variables
let selectedGameIcon = 0; // Index du game-icon sélectionné (0-5)

// Fonction pour mettre à jour l'affichage des game-icons
function updateGameIcons() {
  const gameIcons = document.querySelectorAll(".game-icon");
  gameIcons.forEach((icon, index) => {
    if (index === selectedGameIcon) {
      icon.classList.add("active");
    } else {
      icon.classList.remove("active");
    }
  });

  // Charger les scores du jeu sélectionné
  loadScores(selectedGameIcon);
}

// Variable pour tracker l'état du scoreboard
let scoreboardVisible = false;

// Fonction pour toggle le scoreboard
function toggleScoreboard() {
  const scoreContainer = document.getElementById("scoreContainer");
  const overlay = document.getElementById("modalOverlay");
  const leaderboardCommande = document.querySelector(".leaderboardCommande");

  if (scoreboardVisible) {
    // Cacher le scoreboard, l'overlay et les commandes
    gsap.to("#scoreContainer", {
      duration: 0.3,
      opacity: 0,
      onComplete: () => {
        scoreContainer.style.display = "none";
      }
    });
    gsap.to("#modalOverlay", {
      duration: 0.3,
      opacity: 0,
      onComplete: () => {
        overlay.style.display = "none";
      }
    });
    gsap.to(".leaderboardCommande", {
      duration: 0.3,
      opacity: 0,
      onComplete: () => {
        leaderboardCommande.style.display = "none";
      }
    });
    scoreboardVisible = false;
  } else {
    // Afficher l'overlay, le scoreboard et les commandes
    overlay.style.display = "block";
    scoreContainer.style.display = "flex";
    leaderboardCommande.style.display = "flex";

    // Réinitialiser à la première icône
    selectedGameIcon = 0;
    updateGameIcons();

    gsap.fromTo("#modalOverlay",
      { opacity: 0 },
      { duration: 0.3, opacity: 1 }
    );
    gsap.fromTo("#scoreContainer",
      { opacity: 0, scale: 0.9 },
      { duration: 0.3, opacity: 1, scale: 1 }
    );
    gsap.fromTo(".leaderboardCommande",
      { opacity: 0, scale: 0.9 },
      { duration: 0.3, opacity: 1, scale: 1 }
    );
    scoreboardVisible = true;
  }
}


// Forward Axis events to iframe so embedded games can receive controls (safe, ignores cross-origin errors)
function safePostToIframe(message) {
  const iframe = document.getElementById("gameIframe");
  if (!iframe || !iframe.src) return;
  if (!gameFrameLoaded) {
    console.log('[parent] queueing message until iframe loaded', message);
    messageQueue.push(message);
    return;
  }
  try {
    //si c joystick quickmove loguer rien
    // if (message.event !== 'joystick:move') {
    console.log('[parent] sending to iframe', { message, targetOrigin: gameFrameOrigin || '*' });
    // }
    iframe.contentWindow.postMessage(message, gameFrameOrigin || '*');
  } catch (err) {
    try {
      console.warn('[parent] send failed, retrying with *', err);
      iframe.contentWindow.postMessage(message, '*');
    } catch (err2) {
      console.error('[parent] postMessage failed (final):', err2);
    }
  }
}

function keydownHandler(e) {
  if (isTypingUsername) return; // 🚫 ignore les entrées Axis tant que le pseudo n’est pas validé
  console.log(e);
  if (gameStarted) return;
  
  if (e.key === "a" && !gameStarted && !scoreboardVisible) {
    // TODO: Implémenter l'action pour ground (quitter, retour menu, etc.)
    if (selectedButton === 0) {
      console.log("Ground button pressed - action à implémenter");
      return;
    }
    launchGame(selectedButton - 1); // -1 car les jeux vont de 0 à 5
  }

  if (e.key === "x" && !gameStarted) {
    toggleScoreboard();
  }
}
Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
Axis.addEventListener("keydown", keydownHandler);

// forward joystick quickmove events to iframe
Axis.joystick1.addEventListener('joystick:quickmove', (ev) => {
  if (!gameStarted) return;
  const payload = { direction: ev?.direction, id: ev?.id || 1, joystick: 1 };
  safePostToIframe({ type: 'axis-event', event: 'joystick:quickmove', payload });
});

// forward joystick move events (analog) to iframe UNIQUEMENT si x ou y a changé
let lastJoystickMove = { 1: { x: null, y: null }, 2: { x: null, y: null } };
Axis.joystick1.addEventListener('joystick:move', (ev) => {
  if (!gameStarted) return;
  const pos = ev?.position || { x: 0, y: 0 };
  const id = ev?.id || 1;
  if (lastJoystickMove[1].x !== pos.x || lastJoystickMove[1].y !== pos.y) {
    lastJoystickMove[1] = { x: pos.x, y: pos.y };
    const payload = { position: pos, id, joystick: 1 };
    safePostToIframe({ type: 'axis-event', event: 'joystick:move', payload });
  }
});

// if a second physical joystick is present, forward its quickmove too
try {
  if (Axis.joystick2 && typeof Axis.joystick2.addEventListener === 'function') {
    Axis.joystick2.addEventListener('joystick:quickmove', (ev) => {
      if (!gameStarted) return;
      const payload = { direction: ev?.direction, id: ev?.id || 2, joystick: 2 };
      safePostToIframe({ type: 'axis-event', event: 'joystick:quickmove', payload });
    });

    // forward joystick2 move events (analog) to iframe UNIQUEMENT si x ou y a changé
    Axis.joystick2.addEventListener('joystick:move', (ev) => {
      if (!gameStarted) return;
      const pos = ev?.position || { x: 0, y: 0 };
      const id = ev?.id || 2;
      if (lastJoystickMove[2].x !== pos.x || lastJoystickMove[2].y !== pos.y) {
        lastJoystickMove[2] = { x: pos.x, y: pos.y };
        const payload = { position: pos, id, joystick: 2 };
        safePostToIframe({ type: 'axis-event', event: 'joystick:move', payload });
      }
    });
  }
} catch (_) { }

// forward keydown events to iframe (serialize only needed props)
Axis.addEventListener('keydown', (ev) => {
  if (!gameStarted) return;
  const controllerId = ev?.id || '';
  const rawKey = (ev?.key || '');
  const payload = {
    key: controllerId ? `${rawKey}${controllerId}` : rawKey,
    code: ev?.code,
    keyCode: ev?.keyCode,
    id: ev?.id,
    metaKey: !!ev?.metaKey,
    ctrlKey: !!ev?.ctrlKey,
    altKey: !!ev?.altKey,
    shiftKey: !!ev?.shiftKey
  };
  safePostToIframe({ type: 'axis-event', event: 'keydown', payload });
});

// forward keyup events to iframe (serialize only needed props)
Axis.addEventListener('keyup', (ev) => {
  if (!gameStarted) return;
  const controllerId = ev?.id || '';
  const rawKey = (ev?.key || '');
  const payload = {
    key: controllerId ? `${rawKey}${controllerId}` : rawKey,
    code: ev?.code,
    keyCode: ev?.keyCode,
    id: ev?.id,
    metaKey: !!ev?.metaKey,
    ctrlKey: !!ev?.ctrlKey,
    altKey: !!ev?.altKey,
    shiftKey: !!ev?.shiftKey
  };
  safePostToIframe({ type: 'axis-event', event: 'keyup', payload });
});


// Écouter les événements de la manette Xbox (Gamepad API)
window.addEventListener("gamepadconnected", (e) => {
  console.log("Manette connectée:", e.gamepad);
});

let lastButtonStates = {};

function checkGamepad() {
    if (isTypingUsername) {
    requestAnimationFrame(checkGamepad);
    return; // ignore les entrées de manette tant que l’utilisateur tape son pseudo
  }

  const gamepads = navigator.getGamepads();

  for (let i = 0; i < gamepads.length; i++) {
    const gamepad = gamepads[i];
    if (!gamepad) continue;

    if (!lastButtonStates[i]) {
      lastButtonStates[i] = {};
    }

    gamepad.buttons.forEach((button, index) => {
      const wasPressed = lastButtonStates[i][index];
      const isPressed = button.pressed;

      if (isPressed && !wasPressed) {
        console.log(`Bouton ${index} pressé`);

        if (index === 2) {
          keydownHandler({ key: "x" });
        }
        if (index === 0) {
          keydownHandler({ key: "a" });
        }
      }

      lastButtonStates[i][index] = isPressed;
    });

    const threshold = 0.5;

    // Stick gauche vertical (navigation étages)
    const leftStickY = gamepad.axes[1];

    if (leftStickY < -threshold && !lastButtonStates[i].upPressed) {
      joystickQuickmoveHandler({ direction: "up" });
      lastButtonStates[i].upPressed = true;
    } else if (leftStickY > -threshold) {
      lastButtonStates[i].upPressed = false;
    }

    if (leftStickY > threshold && !lastButtonStates[i].downPressed) {
      joystickQuickmoveHandler({ direction: "down" });
      lastButtonStates[i].downPressed = true;
    } else if (leftStickY < threshold) {
      lastButtonStates[i].downPressed = false;
    }

    // Stick gauche horizontal (navigation game-icons quand scoreboard visible)
    const leftStickX = gamepad.axes[0];

    if (leftStickX < -threshold && !lastButtonStates[i].leftPressed) {
      joystickQuickmoveHandler({ direction: "left" });
      lastButtonStates[i].leftPressed = true;
    } else if (leftStickX > -threshold) {
      lastButtonStates[i].leftPressed = false;
    }

    if (leftStickX > threshold && !lastButtonStates[i].rightPressed) {
      joystickQuickmoveHandler({ direction: "right" });
      lastButtonStates[i].rightPressed = true;
    } else if (leftStickX < threshold) {
      lastButtonStates[i].rightPressed = false;
    }
  }

  requestAnimationFrame(checkGamepad);
}

requestAnimationFrame(checkGamepad);

// --- ÉVÉNEMENT : AJOUT SCORE ALÉATOIRE ---
document.getElementById("addScoreBtn")?.addEventListener("click", () => {
  console.log("Ajout d'un score aléatoire...");
  const randomScore = Math.floor(Math.random() * 10000);
  const randomPlayer = "Player" + Math.floor(Math.random() * 100);
  const randomGameId = Math.floor(Math.random() * 6);
  addScore(randomGameId, randomPlayer, randomScore);
});

const floorButtons = [
  { id: "ground", gameIndex: 0 },
  { id: "jeu1bouton", gameIndex: 1 },
  { id: "jeu2bouton", gameIndex: 2 },
  { id: "jeu3bouton", gameIndex: 3 },
  { id: "jeu4bouton", gameIndex: 4 },
  { id: "jeu5bouton", gameIndex: 5 },
  { id: "jeu6bouton", gameIndex: 6 }
];

floorButtons.forEach(({ id, gameIndex }) => {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener("mouseover", () => {
      // Retirer activeCircle de tous les boutons
      document.querySelectorAll(".circle").forEach(btn => {
        if (!btn.classList.contains("completed")) {
          btn.classList.remove("activeCircle");
        }
      });
      
      // Ajouter activeCircle au bouton survolé
      button.classList.add("activeCircle");
      selectedButton = gameIndex;
      
      // Ne pas charger les scores pour ground (index 0)
      if (gameIndex > 0) {
        loadScores(gameIndex - 1); // -1 car les jeux vont de 0 à 5
      }
    });
    
    button.addEventListener("click", () => {
      // TODO: Implémenter l'action pour ground (quitter, retour menu, etc.)
      if (gameIndex === 0) {
        console.log("Ground button clicked - action à implémenter");
        return;
      }
      launchGame(gameIndex - 1); // -1 car les jeux vont de 0 à 5
    });
  }
});

//appeler joystickQuickmoveHandler quand flèche haut ou bas pressée
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    joystickQuickmoveHandler({ direction: "up" });
  } else if (e.key === "ArrowDown") {
    joystickQuickmoveHandler({ direction: "down" });
  } else if (e.key === "Enter") {
    keydownHandler({ key: "a" });
  } else if (e.key === "x" || e.key === "X" || e.key === "l" || e.key === "L") {
    keydownHandler({ key: "x" });
  } else if (e.key === "i") {
    keydownHandler({ key: "i" });
  } else if (e.key === "s") {
    keydownHandler({ key: "s" });
  }
});

async function createSession(playerName) {
  let testId = "";
  await addDoc(collection(db, "sessions"), {
    playerName,
  }).then((docRef) => {
    console.log("✅ Session créée avec ID :", docRef.id);
    testId = docRef.id;
  });

  const ref = doc(db, "sessions", testId);

  onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      console.log("💡 Document mis à jour :", docSnap.data());
      finishedGames = docSnap.data().finishedGames || [];
      console.log("Finished games mis à jour :", finishedGames);
    } else {
      console.log("⚠️ Document supprimé ou inexistant");
    }
  });
}

async function setAllLedsWhite() {
  try {
    if (Axis.ledManager && Array.isArray(Axis.ledManager.leds)) {
      Axis.ledManager.leds.forEach(led => {
        if (led && typeof led.setColor === 'function') led.setColor('white');
      });
    }
  } catch (err) { console.error('Erreur setAllLedsWhite', err); }
}

async function backToElevator() {
  const iframe = document.getElementById("gameIframe");
  // Stoppe le jeu et tous les sons en réinitialisant l'iframe
  iframe.src = "about:blank";
  iframe.style.zIndex = "-1";
  document.getElementById("openingVideo").style.zIndex = "-1";
  document.getElementById("openingVideo").currentTime = 0;
  gsap.to(".videoBack", { duration: 1, opacity: 1 });
  gsap.to("#gameIframe", { duration: 1, opacity: 0 });

  // LEDs blanches au retour ascenseur
  setAllLedsWhite();

  // Fade in des contrôles
  gsap.to("#right-container", { duration: 0.5, opacity: 1, delay: 0.5 });
  gsap.to(".bottomLeft", { duration: 0.5, opacity: 1, delay: 0.5 });

  setTimeout(() => {
    document.getElementById("container").style.display = "flex";
    gameStarted = false;
    Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
    Axis.addEventListener("keydown", keydownHandler);
  }, 1000);
}

function launchGame(index) {
  const iframe = document.getElementById("gameIframe");
  gameFrameLoaded = false;
  gameFrameOrigin = '*';
  iframe.src = gameUrls[index];

  // Fade out des contrôles
  gsap.to("#right-container", { duration: 0.5, opacity: 0 });
  gsap.to(".bottomLeft", { duration: 0.5, opacity: 0 });

  iframe.onload = () => {
    gameFrameLoaded = true;
    try {
      gameFrameOrigin = new URL(iframe.src, window.location.href).origin;
    } catch (_) {
      gameFrameOrigin = '*';
    }
    while (messageQueue.length) {
      const msg = messageQueue.shift();
      safePostToIframe(msg);
    }
    try {
      if (gameFrameOrigin === window.location.origin) {
        try {
          const doc = iframe.contentDocument;
          if (doc) {
            const s = doc.createElement('script');
            s.type = 'text/javascript';
            s.src = '/src/iframe-bridge.js';
            doc.head.appendChild(s);
            console.log('Injected /src/iframe-bridge.js into iframe (same-origin)');
          }
        } catch (injErr) {
          console.warn('Injection into iframe failed:', injErr);
        }
      } else {
        console.log('Iframe is cross-origin; include iframe-bridge.js inside the game to receive parent messages.');
      }
    } catch (e) {
      console.warn('Error while attempting to inject bridge:', e);
    }
  };
  document.getElementById("container").style.display = "none";
  document.getElementById("openingVideo").style.zIndex = "10";
  document.getElementById("openingVideo").play();

  Axis.joystick1.removeEventListener("joystick:quickmove", joystickQuickmoveHandler);
  Axis.removeEventListener("keydown", keydownHandler);

  gameStarted = true;
  setTimeout(() => {
    gsap.to(".videoBack", { duration: 1, opacity: 0 });

    iframe.style.zIndex = "10";
    iframe.click();
    iframe.focus();
    try { iframe.contentWindow.focus(); } catch (_) { }
    setTimeout(() => {
      gsap.to("#gameIframe", { duration: 1, opacity: 1 });
    }, 500);
  }, 4000);
}

// Expose helper to console for easier testing
try { window.safePostToIframe = safePostToIframe; } catch (_) { }
try { window.testSendToIframe = (m) => { try { safePostToIframe(m); } catch (e) { console.error('testSendToIframe error', e); } }; } catch (_) { }
try { window.toggleScoreboard = toggleScoreboard; } catch (_) { }

// Receive commands from iframe games. Example message to trigger return:
// { type: 'elevator-command', action: 'backToElevator' }
window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type !== 'elevator-command') return;

  // Best-effort origin check: if gameFrameOrigin is known, require it
  try {
    if (gameFrameOrigin && gameFrameOrigin !== '*' && ev.origin !== gameFrameOrigin) {
      console.warn('[parent] ignored elevator-command from unknown origin', ev.origin);
      return;
    }
  } catch (_) { }

  if (msg.action === 'backToElevator') {
    console.log('[parent] received backToElevator command from iframe');
    try { backToElevator(); } catch (err) { console.error('backToElevator error', err); }
  }
  // Contrôle des LEDs depuis le jeu
  if (msg.action === 'setLeds' && typeof msg.color === 'string') {
    try {
      if (Axis.ledManager && Array.isArray(Axis.ledManager.leds)) {
        Axis.ledManager.leds.forEach(led => {
          if (led && typeof led.setColor === 'function') {
            led.setColor(msg.color);
          }
        });
        console.log(`[parent] LEDs set to color: ${msg.color}`);
      }
    } catch (err) {
      console.error('Erreur setLeds via postMessage', err);
    }
  }
});

// --- AU CHARGEMENT ---
loadScores(0);
setAllLedsWhite();