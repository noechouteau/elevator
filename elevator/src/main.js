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

// --- AJOUTER UN SCORE ---
async function addScore(gameId, playerName, score) {
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

let selectedButton=0;
let gameFrameLoaded = false;
let gameFrameOrigin = '*';
const messageQueue = [];
let finishedGames = [];

const input = document.querySelector("input#username");

Axis.virtualKeyboard.open();

Axis.virtualKeyboard.addEventListener("input", (username) => {
    input.value = username;
});

Axis.virtualKeyboard.addEventListener("validate", (username) => {
    Axis.virtualKeyboard.close(); // ✅ corrige la référence
    // leaderboard.postScore({
    //     username,
    //     value: 100098796,
    // });
    createSession(username);
});

function joystickQuickmoveHandler(e) {
    console.log(e);
    if (gameStarted) return;
    if (e.direction === "up"){
      if(selectedButton>0){
        selectedButton--;
        loadScores(selectedButton);
        document.getElementById("previewImage").src=images[selectedButton];
        document.getElementById("jeu"+(selectedButton+1)+"bouton").classList.add("hovered");
        document.getElementById("jeu"+(selectedButton+2)+"bouton").classList.remove("hovered");
      }
    }
    if (e.direction === "down"){
      if(selectedButton<5){
        selectedButton++;
        loadScores(selectedButton);
        document.getElementById("previewImage").src=images[selectedButton];
        document.getElementById("jeu"+(selectedButton+1)+"bouton").classList.add("hovered");
        document.getElementById("jeu"+(selectedButton)+"bouton").classList.remove("hovered");
      }
    };
    console.log(selectedButton);
}

// Forward Axis events to iframe so embedded games can receive controls (safe, ignores cross-origin errors)
function safePostToIframe(message) {
  const iframe = document.getElementById("gameIframe");
  if (!iframe || !iframe.src) return;
  // queue messages until iframe has loaded to avoid origin mismatch errors
  if (!gameFrameLoaded) {
    console.log('[parent] queueing message until iframe loaded', message);
    messageQueue.push(message);
    return;
  }
  try {
    console.log('[parent] sending to iframe', { message, targetOrigin: gameFrameOrigin || '*' });
    iframe.contentWindow.postMessage(message, gameFrameOrigin || '*');
  } catch (err) {
    // If origin mismatch or any failure, retry with '*'
    try {
      console.warn('[parent] send failed, retrying with *', err);
      iframe.contentWindow.postMessage(message, '*');
    } catch (err2) {
      console.error('[parent] postMessage failed (final):', err2);
    }
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
  if (!gameStarted) return;
  // pick only serializable fields
  const payload = { direction: ev?.direction, id: ev?.id || 1, joystick: 1 };
  safePostToIframe({ type: 'axis-event', event: 'joystick:quickmove', payload });
});

// if a second physical joystick is present, forward its quickmove too
try {
  if (Axis.joystick2 && typeof Axis.joystick2.addEventListener === 'function') {
    Axis.joystick2.addEventListener('joystick:quickmove', (ev) => {
      if (!gameStarted) return;
      const payload = { direction: ev?.direction, id: ev?.id || 2, joystick: 2 };
      safePostToIframe({ type: 'axis-event', event: 'joystick:quickmove', payload });
    });
  }
} catch (_) {}

// forward keydown events to iframe (serialize only needed props)
Axis.addEventListener('keydown', (ev) => {
  if (!gameStarted) return;
  const controllerId = ev?.id || '';
  const rawKey = (ev?.key || '');
  const payload = {
    // suffix key with controller id so parent sends 'a1' or 'a2'
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

for(let i=1;i<=6;i++){
  document.getElementById("jeu"+i+"bouton")
  .addEventListener("mouseover",()=>{
    loadScores(i-1);
    document.getElementById("previewImage").src=images[i-1];
    selectedButton=i-1;
  });
  document.getElementById("jeu"+i+"bouton").addEventListener("click",()=>{
    launchGame(i-1);
  });
}

//appeler joystickQuickmoveHandler quand flèche haut ou bas pressée
document.addEventListener("keydown", (e) => {
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

      // Mettre à jour les boutons de jeu en fonction des finishedGames

    } else {
      console.log("⚠️ Document supprimé ou inexistant");
    }
  });
}

async function backToElevator(){
  // Logique pour revenir à l'ascenseur
  document.getElementById("gameIframe").style.zIndex="-1";
  document.getElementById("openingVideo").style.zIndex="-1";
  document.getElementById("openingVideo").currentTime = 0;
  gsap.to(".videoBack", {duration: 1, opacity: 1});
  gsap.to("#gameIframe", {duration: 1, opacity: 0});
  setTimeout(()=>{
    document.getElementById("container").style.display="flex";
    gameStarted = false;
    Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
    Axis.addEventListener("keydown", keydownHandler);
  },1000);


}

function launchGame(index) {
  const iframe = document.getElementById("gameIframe");
  gameFrameLoaded = false;
  gameFrameOrigin = '*';
  // set src then wait on load to flush queue
  iframe.src = gameUrls[index];
  iframe.onload = () => {
    gameFrameLoaded = true;
    try {
      gameFrameOrigin = new URL(iframe.src, window.location.href).origin;
    } catch (_) {
      gameFrameOrigin = '*';
    }
    // flush queued messages
    while (messageQueue.length) {
      const msg = messageQueue.shift();
      safePostToIframe(msg);
    }
    // If iframe is same-origin, try injecting the bridge script automatically so games don't need to include it.
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
          // fallback: might fail if iframe isn't fully ready for DOM injection yet
          console.warn('Injection into iframe failed:', injErr);
        }
      } else {
        console.log('Iframe is cross-origin; include iframe-bridge.js inside the game to receive parent messages.');
      }
    } catch (e) {
      console.warn('Error while attempting to inject bridge:', e);
    }
  };
  document.getElementById("container").style.display="none";
  document.getElementById("openingVideo").style.zIndex="10";
  document.getElementById("openingVideo").play();
  console.log(Axis.joystick1.removeEventListener);

  Axis.joystick1.removeEventListener("joystick:quickmove", joystickQuickmoveHandler);
  Axis.removeEventListener("keydown", keydownHandler);
  
  gameStarted = true;
  setTimeout(()=>{
    gsap.to(".videoBack", {duration: 1, opacity: 0});
    console.log("test");
    
  iframe.style.zIndex="10";
  iframe.click();
  iframe.focus();
  try { iframe.contentWindow.focus(); } catch(_) {}
    setTimeout(()=>{
      gsap.to("#gameIframe", {duration: 1, opacity: 1});
    },500);
  },4000);

  // setTimeout(()=>{
  //   backToElevator();
  // },8000);
}

// Expose helper to console for easier testing
try { window.safePostToIframe = safePostToIframe; } catch (_) {}
try { window.testSendToIframe = (m) => { try { safePostToIframe(m); } catch(e){ console.error('testSendToIframe error', e);} }; } catch(_) {}

// --- AU CHARGEMENT ---
loadScores(0);