import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.login = async function() {
  const pin = document.getElementById("pin").value;
  const snapshot = await getDocs(collection(db, "employees"));

  let found = false;

  snapshot.forEach(doc => {
    if (doc.data().pin === pin) {
      localStorage.setItem("employeeName", doc.data().name);
      localStorage.setItem("role", doc.data().role);
      window.location.href = "dashboard.html";
      found = true;
    }
  });

  if (!found) {
    document.getElementById("error").innerText = "Invalid PIN";
  }
};
