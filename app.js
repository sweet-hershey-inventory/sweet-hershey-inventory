import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let selectedCategory = null;
let currentInventory = [];
let beforeSaved = false;

// DASHBOARD LOAD
window.onload = async function () {
  if (!window.location.pathname.includes("dashboard")) return;

  document.getElementById("employeeName").innerText =
    localStorage.getItem("employeeName");

  startClock();
  loadCategories();
  loadLastDuty();
};

// LIVE CLOCK
function startClock() {
  setInterval(() => {
    const now = new Date();
    document.getElementById("liveClock").innerText =
      now.toLocaleDateString() + " " + now.toLocaleTimeString();
  }, 1000);
}

// LOAD LAST DUTY
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    document.getElementById("lastDuty").innerText =
      "Last Duty: " + docSnap.data().employee;
  });
}

// LOAD CATEGORIES
async function loadCategories() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const set = new Set();

  snapshot.forEach(doc => {
    set.add(doc.data().category);
  });

  const container = document.getElementById("categories");
  container.innerHTML = "";

  set.forEach(cat => {
    container.innerHTML += `
      <div class="categoryBtn" onclick="selectCategory('${cat}')">
        ${cat.toUpperCase()}
      </div>
    `;
  });
}

// SELECT CATEGORY
window.selectCategory = async function(cat) {
  selectedCategory = cat;
  beforeSaved = false;

  document.getElementById("inventorySection").style.display = "block";
  document.getElementById("afterSection").style.display = "none";
  document.getElementById("categoryTitle").innerText = cat.toUpperCase();

  const snapshot = await getDocs(collection(db, "inventory"));

  const beforeDiv = document.getElementById("beforeList");
  const afterDiv = document.getElementById("afterList");
  const overallDiv = document.getElementById("overallStocks");

  beforeDiv.innerHTML = "";
  afterDiv.innerHTML = "";
  overallDiv.innerHTML = "";

  currentInventory = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.category === cat) {

      currentInventory.push({ id: docSnap.id, stock: data.stock });

      overallDiv.innerHTML += `
        <div>${data.name}: <strong>${data.stock}</strong></div>
      `;

      beforeDiv.innerHTML += `
        <div class="itemCard">
          ${data.name}
          <input type="number" id="before_${docSnap.id}" value="${data.stock}">
        </div>
      `;
    }
  });
};

// SAVE BEFORE SHIFT
window.saveBefore = function() {
  beforeSaved = true;
  document.getElementById("afterSection").style.display = "block";

  const afterDiv = document.getElementById("afterList");
  afterDiv.innerHTML = "";

  currentInventory.forEach(item => {
    const val = document.getElementById("before_" + item.id).value;

    afterDiv.innerHTML += `
      <div class="itemCard">
        ${item.id}
        <input type="number" id="after_${item.id}" value="${val}">
      </div>
    `;
  });

  alert("Before Shift saved. Now fill After Shift.");
};

// SAVE AFTER SHIFT
window.saveAfter = async function() {

  if (!beforeSaved) {
    alert("Please complete Before Shift first.");
    return;
  }

  const employee = localStorage.getItem("employeeName");
  let beforeData = {};
  let afterData = {};

  for (let item of currentInventory) {
    beforeData[item.id] = Number(document.getElementById("before_" + item.id).value);
    afterData[item.id] = Number(document.getElementById("after_" + item.id).value);

    // UPDATE MASTER STOCK
    const ref = doc(db, "inventory", item.id);
    await updateDoc(ref, {
      stock: afterData[item.id]
    });
  }

  await addDoc(collection(db, "shifts"), {
    employee,
    category: selectedCategory,
    before: beforeData,
    after: afterData,
    timestamp: serverTimestamp()
  });

  alert("Shift completed!");
  loadLastDuty();
  selectCategory(selectedCategory);
};

window.logout = function() {
  localStorage.clear();
  window.location.href = "index.html";
};
