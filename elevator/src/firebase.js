import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: "https://elevator-b7802-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "elevator-b7802.firebasestorage.app",
  messagingSenderId: "726914023287",
  appId: "1:726914023287:web:92c860cfd237e31c832b72",
  measurementId: "G-449KZMJD47"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
