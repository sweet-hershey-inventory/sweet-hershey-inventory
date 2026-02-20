import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyjwL_zA6VT6GMO2XUxXKNhYpeP6LHI0U",
  authDomain: "sweethersheytrackinventory.firebaseapp.com",
  projectId: "sweethersheytrackinventory",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
