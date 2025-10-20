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
  loadScores(gameId);
}

let gameStarted = false;
let inputActive = true; // vrai tant que l'utilisateur saisit son pseudo
let selectedButton = 0;
let gameFrameLoaded = false;
let gameFrameOrigin = '*';
const messageQueue = [];
let finishedGames = [];

const images = [
  "/game1.jpg","/game2.jpg","/game3.jpg","/game4.jpg","/game5.jpg","/game6.jpg"
];

const gameUrls = [
  "https://gamejame.vercel.app/",
  "https://bruno-simon.com/",
  "https://stake.bet/fr",
  "https://miamo.fun/",
  "https://matias.me/nsfw/",
  "https://neal.fun/"
];

const input = document.querySelector("input#username");

// --- Clavier virtuel Axis ---
Axis.virtualKeyboard.open();

Axis.virtualKeyboard.addEventListener("input", (username) => {
  input.value = username;
});

Axis.virtualKeyboard.addEventListener("validate", (username) => {
  Axis.virtualKeyboard.close();
  input.style.display = "none";
  inputActive = false; // On peut maintenant utiliser le joystick / clavier
  createSession(username);

      // console log user id 
  console.log("Pseudo validé :", username);

  // Attacher les events maintenant que le pseudo est validé
  Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
  Axis.addEventListener("keydown", keydownHandler);
});

// --- HANDLERS ---
function joystickQuickmoveHandler(e) {
  if (gameStarted || inputActive) return;

  if (e.direction === "up" && selectedButton > 0) {
    selectedButton--;
    loadScores(selectedButton);
    document.getElementById("previewImage").src = images[selectedButton];
    document.getElementById("jeu"+(selectedButton+1)+"bouton").classList.add("hovered");
    document.getElementById("jeu"+(selectedButton+2)+"bouton").classList.remove("hovered");
  }
  if (e.direction === "down" && selectedButton < 5) {
    selectedButton++;
    loadScores(selectedButton);
    document.getElementById("previewImage").src = images[selectedButton];
    document.getElementById("jeu"+(selectedButton+1)+"bouton").classList.add("hovered");
    document.getElementById("jeu"+(selectedButton)+"bouton").classList.remove("hovered");
  }
  console.log("Selected:", selectedButton);
}

function keydownHandler(e) {
  if (gameStarted || inputActive) return;

  if (e.key === "a") launchGame(selectedButton);
}

// --- FORWARD EVENTS TO IFRAME ---
Axis.joystick1.addEventListener('joystick:quickmove', (ev) => {
  if (!gameStarted) return;
  safePostToIframe({ type: 'axis-event', event: 'joystick:quickmove', payload: { direction: ev.direction } });
});

Axis.addEventListener('keydown', (ev) => {
  if (!gameStarted) return;
  const payload = {
    key: ev.key, code: ev.code, keyCode: ev.keyCode,
    metaKey: !!ev.metaKey, ctrlKey: !!ev.ctrlKey, altKey: !!ev.altKey, shiftKey: !!ev.shiftKey
  };
  safePostToIframe({ type: 'axis-event', event: 'keydown', payload });
});

Axis.addEventListener('keyup', (ev) => {
  if (!gameStarted) return;
  const payload = {
    key: ev.key, code: ev.code, keyCode: ev.keyCode,
    metaKey: !!ev.metaKey, ctrlKey: !!ev.ctrlKey, altKey: !!ev.altKey, shiftKey: !!ev.shiftKey
  };
  safePostToIframe({ type: 'axis-event', event: 'keyup', payload });
});

// --- SCORES ---
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

async function loadScores(gameId) {
  const tbody = document.querySelector("#scoreTable tbody");
  tbody.innerHTML = "<tr><td colspan='3'>Chargement...</td></tr>";

  const scores = await getTopScores(gameId);
  tbody.innerHTML = "";

  if (scores.length === 0) {
    tbody.innerHTML = "<tr><td colspan='3'>Aucun score pour l’instant</td></tr>";
    return;
  }

  scores.forEach((s, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${i+1}</td><td>${s.playerName}</td><td>${s.score}</td>`;
    tbody.appendChild(row);
  });
}

// --- BOUTONS ---
for(let i=1; i<=6; i++){
  document.getElementById("jeu"+i+"bouton").addEventListener("mouseover", ()=>{
    if (inputActive) return;
    loadScores(i-1);
    document.getElementById("previewImage").src = images[i-1];
    selectedButton = i-1;
  });
  document.getElementById("jeu"+i+"bouton").addEventListener("click", ()=>{
    if (inputActive) return;
    launchGame(i-1);
  });
}

document.addEventListener("keydown", (e)=>{
  if (e.key === "ArrowUp") joystickQuickmoveHandler({ direction: "up" });
  else if (e.key === "ArrowDown") joystickQuickmoveHandler({ direction: "down" });
  else if (["Enter","x","i","s"].includes(e.key)) keydownHandler({ key: e.key });
});

// --- SESSION ---
async function createSession(playerName) {
  const docRef = await addDoc(collection(db, "sessions"), { playerName });
  const ref = doc(db, "sessions", docRef.id);


  onSnapshot(ref, (docSnap)=>{
    if (docSnap.exists()){
      finishedGames = docSnap.data().finishedGames || [];
      console.log("Finished games:", finishedGames);
      
    }
  });
}

// --- IFRAME ---
function safePostToIframe(message){
  const iframe = document.getElementById("gameIframe");
  if (!iframe || !iframe.src) return;
  if (!gameFrameLoaded) { messageQueue.push(message); return; }
  try { iframe.contentWindow.postMessage(message, gameFrameOrigin || '*'); } 
  catch { try { iframe.contentWindow.postMessage(message, '*'); } catch(e){ console.error(e); } }
}

function launchGame(index){
  const iframe = document.getElementById("gameIframe");
  gameFrameLoaded = false;
  gameFrameOrigin = '*';
  iframe.src = gameUrls[index];
  iframe.onload = ()=>{
    gameFrameLoaded = true;
    try { gameFrameOrigin = new URL(iframe.src, window.location.href).origin; } catch { gameFrameOrigin='*'; }
    while(messageQueue.length) safePostToIframe(messageQueue.shift());
  };

  document.getElementById("container").style.display = "none";
  document.getElementById("openingVideo").style.zIndex = 10;
  document.getElementById("openingVideo").play();

  Axis.joystick1.removeEventListener("joystick:quickmove", joystickQuickmoveHandler);
  Axis.removeEventListener("keydown", keydownHandler);
  gameStarted = true;

  setTimeout(()=>{
    gsap.to(".videoBack", { duration: 1, opacity: 0 });
    iframe.style.zIndex="10";
    iframe.click(); iframe.focus();
    try { iframe.contentWindow.focus(); } catch{}
    setTimeout(()=>{ gsap.to("#gameIframe",{ duration:1, opacity:1 }); },500);
  },4000);

  setTimeout(backToElevator, 8000);
}

async function backToElevator(){
  document.getElementById("gameIframe").style.zIndex="-1";
  document.getElementById("openingVideo").style.zIndex="-1";
  document.getElementById("openingVideo").currentTime=0;
  gsap.to(".videoBack",{duration:1,opacity:1});
  gsap.to("#gameIframe",{duration:1,opacity:0});
  setTimeout(()=>{
    document.getElementById("container").style.display="flex";
    gameStarted=false;
    Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
    Axis.addEventListener("keydown", keydownHandler);
  },1000);
}

// --- AU CHARGEMENT ---
loadScores(0);
