import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJm4zIkv3BGdJKdPO7UZLV7-R9gl1JkLE",
  authDomain: "elevator-b7802.firebaseapp.com",
  databaseURL: "https://elevator-b7802-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "elevator-b7802",
  storageBucket: "elevator-b7802.firebasestorage.app",
  messagingSenderId: "726914023287",
  appId: "1:726914023287:web:92c860cfd237e31c832b72",
  measurementId: "G-449KZMJD47"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
