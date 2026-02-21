import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyjwL_zA6VT6GMO2XUxXKNhYpeP6LHI0U",
  authDomain: "sweethersheytrackinventory.firebaseapp.com",
  projectId: "sweethersheytrackinventory",
  storageBucket: "sweethersheytrackinventory.firebasestorage.app",
  messagingSenderId: "1070869731224",
  appId: "1:1070869731224:web:cda15c136ab95cc6c5bded"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
