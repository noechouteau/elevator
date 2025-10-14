import { db } from "./firebase.js";
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
  addScore(0, randomPlayer, randomScore);
});



// --- AU CHARGEMENT ---
loadScores(0);
