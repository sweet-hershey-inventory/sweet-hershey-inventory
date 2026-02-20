import { db } from "./firebase.js";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// SYSTEM LOGIN
window.mainLogin = function() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (
    (username === "staff" && password === "hershey123") ||
    (username === "admin" && password === "SWEEThershey2025")
  ) {
    localStorage.setItem("systemRole", username);
    document.getElementById("pinSection").style.display = "block";
    document.getElementById("error").innerText = "";
  } else {
    document.getElementById("error").innerText = "Invalid system login";
  }
};

// PIN VERIFY
window.verifyPin = async function() {
  const pin = document.getElementById("pin").value;
  const snapshot = await getDocs(collection(db, "employees"));

  snapshot.forEach(docSnap => {
    if (docSnap.data().pin === pin) {
      localStorage.setItem("employeeName", docSnap.data().name);
      localStorage.setItem("role", docSnap.data().role);
      window.location.href = "dashboard.html";
    }
  });
};

// DASHBOARD LOAD
window.onload = async function() {
  if (!window.location.pathname.includes("dashboard")) return;

  const name = localStorage.getItem("employeeName");
  const role = localStorage.getItem("role");
  document.getElementById("employeeName").innerText = "Logged in as: " + name;

  if (role === "admin") {
    document.getElementById("adminSection").style.display = "block";
  }

  loadInventory();
  loadLastShift();
};

// LOAD INVENTORY INPUTS
async function loadInventory() {
  const snapshot = await getDocs(collection(db, "inventory"));

  const beforeDiv = document.getElementById("beforeInventory");
  const afterDiv = document.getElementById("afterInventory");
  const addStockSelect = document.getElementById("addStockItem");

  beforeDiv.innerHTML = "";
  afterDiv.innerHTML = "";
  if (addStockSelect) addStockSelect.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    beforeDiv.innerHTML += `
      <div>${data.name} 
        <input type="number" id="before_${docSnap.id}" value="${data.stock}">
      </div>
    `;

    afterDiv.innerHTML += `
      <div>${data.name} 
        <input type="number" id="after_${docSnap.id}" value="${data.stock}">
      </div>
    `;

    if (addStockSelect) {
      addStockSelect.innerHTML += `
        <option value="${docSnap.id}">${data.name}</option>
      `;
    }
  });
}

// SAVE SHIFT
window.saveShift = async function(type) {
  const snapshot = await getDocs(collection(db, "inventory"));
  const employee = localStorage.getItem("employeeName");

  let shiftData = {};

  snapshot.forEach(docSnap => {
    const inputId = `${type}_${docSnap.id}`;
    const value = document.getElementById(inputId).value;
    shiftData[docSnap.id] = Number(value);
  });

  await addDoc(collection(db, "shifts"), {
    employee: employee,
    type: type,
    data: shiftData,
    date: new Date(),
    timestamp: serverTimestamp()
  });

  alert("Shift saved successfully!");
};

// LOAD LAST SHIFT
async function loadLastShift() {
  const snapshot = await getDocs(collection(db, "shifts"));
  let last = null;

  snapshot.forEach(docSnap => {
    last = docSnap.data();
  });

  if (last) {
    document.getElementById("lastShiftInfo").innerText =
      "Last Inventory: " + last.employee + 
      " | Type: " + last.type +
      " | Date: " + new Date(last.date).toLocaleString();
  }
}

// ADD STOCK (ADMIN ONLY)
window.addStock = async function() {
  const itemId = document.getElementById("addStockItem").value;
  const qty = Number(document.getElementById("addStockQty").value);

  const ref = doc(db, "inventory", itemId);
  const snap = await getDoc(ref);

  const current = snap.data().stock;

  await updateDoc(ref, {
    stock: current + qty
  });

  alert("Stock added!");
  loadInventory();
};

window.logout = function() {
  localStorage.clear();
  window.location.href = "index.html";
};
