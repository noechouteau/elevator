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
  Timestamp
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
]

let selectedButton=0;

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

  });
  document.getElementById("jeu"+i+"bouton").addEventListener("click",()=>{
    document.getElementById("gameIframe").src=gameUrls[i-1];
    document.getElementById("container").style.display="none";
    document.getElementById("right-container").style.display="none";
    document.getElementById("openingVideo").style.zIndex="10";
    document.getElementById("openingVideo").play();
          setTimeout(()=>{
            gsap.to(".videoBack", {duration: 1, opacity: 0});
            console.log("test");
            document.getElementById("gameIframe").style.zIndex="10";
            setTimeout(()=>{
              gsap.to("#gameIframe", {duration: 1, opacity: 1});
            },500);
          },4000);
  });
}

function joystickQuickmoveHandler(e) {
    if (e.direction === "up"){
      if(selectedButton>0){
        selectedButton--;
        loadScores(selectedButton);
        document.getElementById("previewImage").src=images[selectedButton];
      }
    }
    if (e.direction === "down"){
      if(selectedButton<5){
        selectedButton++;
        loadScores(selectedButton);
        document.getElementById("previewImage").src=images[selectedButton];
      }
    };
}

function keydownHandler(e) {
    if (e.key === "a") {
      document.getElementById("gameIframe").src=gameUrls[i-1];
      document.getElementById("container").style.display="none";
      document.getElementById("openingVideo").style.zIndex="10";
      document.getElementById("openingVideo").play();
      setTimeout(()=>{
        gsap.to(".videoBack", {duration: 1, opacity: 0});
        console.log("test");
      },3000);
    }
}

Axis.joystick1.addEventListener("joystick:quickmove", joystickQuickmoveHandler);
Axis.addEventListener("keydown", keydownHandler);

// --- AU CHARGEMENT ---
loadScores(0);
