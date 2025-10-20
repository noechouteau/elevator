import { db } from "./firebase.js";
import Axis from "axis-api";
import Leaderboard from "./leaderboard.js";
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


let finishedGames = [];

async function addScore(gameId, playerName, score) {
  await createSession();
  await addDoc(collection(db, "highscores"), {
    gameId,
    playerName,
    score,
    createdAt: Timestamp.now()
  });
  console.log(`✅ Score ajouté pour ${playerName} (${score})`);
  loadScores(gameId); // recharge le classement
}

let gameStarted = false;
let username = localStorage.getItem("username") || "";
const leaderboard = new Leaderboard();

const images = [
  "/game1.jpg",
  "/game2.jpg",
  "/game3.jpg",
  "/game4.jpg",
  "/game5.jpg",
  "/game6.jpg"
];

const gameUrls = [
  "https://gamejame.vercel.app/",
  "https://bruno-simon.com/",
  "https://stake.bet/fr",
  "https://miamo.fun/",
  "https://matias.me/nsfw/",
  "https://neal.fun/"

]

let selectedButton = 0;

function joystickQuickmoveHandler(e) {
  console.log(e);
  if (gameStarted) return;
  if (e.direction === "up") {
    if (selectedButton > 0) {
      selectedButton--;
      loadScores(selectedButton);
      document.getElementById("previewImage").src = images[selectedButton];
      document.getElementById("jeu" + (selectedButton + 1) + "bouton").classList.add("hovered");
      document.getElementById("jeu" + (selectedButton + 2) + "bouton").classList.remove("hovered");
    }
  }
  if (e.direction === "down") {
    if (selectedButton < 5) {
      selectedButton++;
      loadScores(selectedButton);
      document.getElementById("previewImage").src = images[selectedButton];
      document.getElementById("jeu" + (selectedButton + 1) + "bouton").classList.add("hovered");
      document.getElementById("jeu" + (selectedButton) + "bouton").classList.remove("hovered");
    }
  };
  console.log(selectedButton);
}

// Forward Axis events to iframe so embedded games can receive controls (safe, ignores cross-origin errors)
function safePostToIframe(message) {
  const iframe = document.getElementById("gameIframe");
  if (!iframe || !iframe.src) return;
  try {
    // use '*' because many game urls are cross-origin; the target page should verify origin if needed
    iframe.contentWindow.postMessage(message, '*');
  } catch (err) {
    // ignore cross-origin/frame not ready errors
    console.warn('postMessage failed:', err);
  }
}

function keydownHandler(e) {

  console.log(e);
  if (gameStarted) return;
  if (e.key === "a" && !gameStarted) {
    launchGame(selectedButton);
  }
}

Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
Axis.addEventListener("keydown", keydownHandler);

// forward joystick quickmove events to iframe
Axis.joystick1.addEventListener('joystick:quickmove', (ev) => {
  safePostToIframe({ type: 'joystick:quickmove', detail: ev });
});

// forward keydown events to iframe
Axis.addEventListener('keydown', (ev) => {
  safePostToIframe({ type: 'keydown', detail: ev });
});

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
  const tbody = document.querySelector("#scoreTable tbody");
  tbody.innerHTML = "<tr><td colspan='3'>Chargement...</td></tr>";

  const scores = await getTopScores(gameId);
  tbody.innerHTML = ""; // clear

  if (scores.length === 0) {
    tbody.innerHTML = "<tr><td colspan='3'>Aucun score pour l’instant</td></tr>";
    return;
  }

  scores.forEach((s, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.playerName}</td>
      <td>${s.score}</td>
    `;
    tbody.appendChild(row);
  });
}

// --- ÉVÉNEMENT : AJOUT SCORE ALÉATOIRE ---
document.getElementById("addScoreBtn").addEventListener("click", () => {
  console.log("Ajout d’un score aléatoire...");
  const randomScore = Math.floor(Math.random() * 10000);
  const randomPlayer = "Player" + Math.floor(Math.random() * 100);
  const randomGameId = Math.floor(Math.random() * 6); // 0 à 5
  addScore(randomGameId, randomPlayer, randomScore);
});

for (let i = 1; i <= 6; i++) {
  document.getElementById("jeu" + i + "bouton")
    .addEventListener("mouseover", () => {
      loadScores(i - 1);
      document.getElementById("previewImage").src = images[i - 1];
      selectedButton = i - 1;
    });
  document.getElementById("jeu" + i + "bouton").addEventListener("click", () => {
    launchGame(i - 1);
  });
}

//appeler joystickQuickmoveHandler quand flèche haut ou bas pressée
document.addEventListener("keydown", (e) => {
  // If username overlay is active, ignore global mappings and let input handle Enter
  const overlay = document.getElementById("usernameOverlay");
  if (overlay && !overlay.classList.contains("hidden")) {
    return;
  }
  if (e.key === "ArrowUp") {
    joystickQuickmoveHandler({ direction: "up" });
  } else if (e.key === "ArrowDown") {
    joystickQuickmoveHandler({ direction: "down" });
  } else if (e.key === "Enter") {
    keydownHandler({ key: "a" });
  } else if (e.key === "x") {
    keydownHandler({ key: "x" });
  } else if (e.key === "i") {
    keydownHandler({ key: "i" });
  } else if (e.key === "s") {
    keydownHandler({ key: "s" });
  }
});

function launchGame(index) {
  document.getElementById("gameIframe").src = gameUrls[index];
  document.getElementById("container").style.display = "none";
  document.getElementById("openingVideo").style.zIndex = "10";
  document.getElementById("openingVideo").play();
  console.log(Axis.joystick1.removeEventListener);

  Axis.joystick1.removeEventListener("joystick:quickmove", joystickQuickmoveHandler);
  Axis.removeEventListener("keydown", keydownHandler);

  gameStarted = true;
  setTimeout(() => {
    gsap.to(".videoBack", { duration: 1, opacity: 0 });
    console.log("test");

    document.getElementById("gameIframe").style.zIndex = "10";
    document.getElementById("gameIframe").click();
    document.getElementById("gameIframe").focus();
    document.getElementById("gameIframe").contentWindow.focus();
    setTimeout(() => {
      gsap.to("#gameIframe", { duration: 1, opacity: 1 });
    }, 500);
  }, 4000);
}

async function createSession() {
  const testId = "jvcRmaty6Rks8DbckK1B"
  // const ref = doc(db, "session");
  const ref = doc(db, "sessions", testId);

  onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      console.log("💡 Document mis à jour :", docSnap.data());
      finishedGames = docSnap.data().finishedGames || [];
      console.log("Finished games mis à jour :", finishedGames);

      // Mettre à jour les boutons de jeu en fonction des finishedGames

    } else {
      console.log("⚠️ Document supprimé ou inexistant");
    }
  });
}

createSession();


// --- USERNAME OVERLAY & VIRTUAL KEYBOARD FLOW ---
function initUsernameFlow() {
  const overlay = document.getElementById("usernameOverlay");
  const inputEl = document.getElementById("usernameInput");
  const container = document.getElementById("container");
  const right = document.getElementById("right-container");

  // If username already exists, skip overlay
  if (username && username.trim().length > 0) {
    overlay?.classList.add("hidden");
    container?.classList.remove("hidden");
    right?.classList.remove("hidden");
    return;
  }

  // Show overlay, hide the rest
  overlay?.classList.remove("hidden");
  container?.classList.add("hidden");
  right?.classList.add("hidden");

  // Ensure typing and Enter work immediately
  setTimeout(() => {
    try { inputEl?.focus(); inputEl?.select?.(); } catch {}
  }, 0);

  // Open Axis virtual keyboard
  try {
    Axis.virtualKeyboard.open();
  } catch (e) {
    console.warn("Axis.virtualKeyboard.open failed or not available", e);
  }

  // Mirror keyboard input into the field
  const inputHandler = (value) => {
    inputEl.value = value ?? "";
  };

  // Validate: save username, close keyboard, reveal UI
  const validateHandler = async (value) => {
    try {
      username = (value || inputEl.value || "").trim();
      if (!username) return;
      localStorage.setItem("username", username);
      try {
        Axis.virtualKeyboard.close();
        Axis.virtualKeyboard.removeEventListener("input", inputHandler);
        Axis.virtualKeyboard.removeEventListener("validate", validateHandler);
      } catch {}
      overlay?.classList.add("hidden");
      container?.classList.remove("hidden");
      right?.classList.remove("hidden");
    } catch (err) {
      console.error("Validation failed:", err);
    }
  };

  // Attach listeners
  Axis.virtualKeyboard.addEventListener("input", inputHandler);
  Axis.virtualKeyboard.addEventListener("validate", validateHandler);

  // Fallback: allow Enter key on physical keyboard
document.addEventListener("keydown", (e) => {
  // Si overlay visible, on veut que Enter valide
  if (!overlay.classList.contains("hidden") && e.key === "Enter") {
    validateHandler();
  }
});
}

// --- AU CHARGEMENT ---
loadScores(0);
initUsernameFlow();