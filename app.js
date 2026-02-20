import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let selectedCategory = null;
let inventoryCache = {};
let itemMap = {};
let beforeSaved = false;

/* ================= INIT ================= */

window.addEventListener("DOMContentLoaded", async () => {

  if (!window.location.pathname.includes("dashboard")) return;

  document.getElementById("employeeName").innerText =
    localStorage.getItem("employeeName");

  startClock();
  loadCategories();
  loadLastDuty();

  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("saveBeforeBtn").addEventListener("click", saveBefore);
  document.getElementById("completeShiftBtn").addEventListener("click", completeShift);
  document.getElementById("toggleWasteBtn").addEventListener("click", toggleWaste);
  document.getElementById("toggleAddStockBtn").addEventListener("click", toggleAddStock);

});

/* ================= CLOCK ================= */

function startClock() {
  setInterval(() => {
    const now = new Date();
    document.getElementById("liveClock").innerText =
      now.toLocaleDateString() + " " + now.toLocaleTimeString();
  }, 1000);
}

/* ================= LAST DUTY ================= */

async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => {
    document.getElementById("lastDuty").innerText =
      "Last Duty: " + d.data().employee;
  });
}

/* ================= CATEGORIES ================= */

async function loadCategories() {

  const snapshot = await getDocs(collection(db, "inventory"));
  const set = new Set();

  snapshot.forEach(doc => {
    set.add(doc.data().category);
  });

  const container = document.getElementById("categories");
  container.innerHTML = "";

  set.forEach(cat => {

    const btn = document.createElement("div");
    btn.className = "categoryBtn";
    btn.innerText = cat.toUpperCase();
    btn.onclick = () => selectCategory(cat);

    container.appendChild(btn);
  });
}

/* ================= SELECT CATEGORY ================= */

async function selectCategory(cat) {

  selectedCategory = cat;
  beforeSaved = false;

  document.getElementById("inventorySection").style.display = "block";
  document.getElementById("beforeSection").style.display = "block";
  document.getElementById("afterSection").style.display = "none";

  document.getElementById("categoryTitle").innerText = cat.toUpperCase();

  const snapshot = await getDocs(collection(db, "inventory"));

  const beforeList = document.getElementById("beforeList");
  const overallStocks = document.getElementById("overallStocks");

  beforeList.innerHTML = "";
  overallStocks.innerHTML = "";

  snapshot.forEach(docSnap => {

    const data = docSnap.data();

    if (data.category === cat) {

      itemMap[docSnap.id] = data.name;

      inventoryCache[docSnap.id] = {
        before: data.stock,
        after: data.stock,
        wasteQty: 0,
        wasteReason: "",
        addQty: 0
      };

      overallStocks.innerHTML += `
        <div>${data.name}: <strong>${data.stock}</strong></div>
      `;

      const div = document.createElement("div");
      div.className = "itemCard";
      div.innerHTML = `
        ${data.name}
        <input type="number" value="${data.stock}"
          onchange="inventoryCache['${docSnap.id}'].before = Number(this.value)">
      `;

      beforeList.appendChild(div);
    }
  });
}

/* ================= SAVE BEFORE ================= */

function saveBefore() {

  if (!confirm("Proceed? Cannot edit later.")) return;

  beforeSaved = true;

  document.getElementById("beforeSection").style.display = "none";
  document.getElementById("afterSection").style.display = "block";

  loadAfterSection();
}

/* ================= LOAD AFTER ================= */

function loadAfterSection() {

  const afterList = document.getElementById("afterList");
  afterList.innerHTML = "";

  for (let id in inventoryCache) {

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${itemMap[id]}
      <input type="number"
        value="${inventoryCache[id].after}"
        onchange="inventoryCache['${id}'].after = Number(this.value)">
    `;

    afterList.appendChild(div);
  }
}

/* ================= WASTE ================= */

function toggleWaste() {

  const section = document.getElementById("wasteSection");
  section.style.display =
    section.style.display === "none" ? "block" : "none";

  const wasteList = document.getElementById("wasteList");
  wasteList.innerHTML = "";

  for (let id in inventoryCache) {

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${itemMap[id]}
      <input type="number" placeholder="Qty"
        onchange="inventoryCache['${id}'].wasteQty = Number(this.value)">
      <input type="text" placeholder="Reason"
        onchange="inventoryCache['${id}'].wasteReason = this.value">
    `;

    wasteList.appendChild(div);
  }
}

/* ================= ADD STOCK ================= */

function toggleAddStock() {

  const section = document.getElementById("addStockSection");
  section.style.display =
    section.style.display === "none" ? "block" : "none";

  const list = document.getElementById("addStockList");
  list.innerHTML = "";

  for (let id in inventoryCache) {

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${itemMap[id]}
      <input type="number" placeholder="Qty"
        onchange="inventoryCache['${id}'].addQty = Number(this.value)">
    `;

    list.appendChild(div);
  }
}

/* ================= COMPLETE SHIFT ================= */

async function completeShift() {

  if (!beforeSaved) {
    alert("Save Before Shift first.");
    return;
  }

  if (!confirm("Complete shift? Cannot undo.")) return;

  const employee = localStorage.getItem("employeeName");

  let beforeData = {};
  let afterData = "";
  let summaryHTML = "";

  for (let id in inventoryCache) {

    const itemName = itemMap[id];

    beforeData[itemName] = inventoryCache[id].before;
    afterData[itemName] = inventoryCache[id].after;

    const finalStock =
      inventoryCache[id].after +
      inventoryCache[id].addQty -
      inventoryCache[id].wasteQty;

    await updateDoc(doc(db, "inventory", id), {
      stock: finalStock
    });

    if (inventoryCache[id].wasteQty > 0) {
      await addDoc(collection(db, "wastes"), {
        employee,
        itemName,
        qty: inventoryCache[id].wasteQty,
        reason: inventoryCache[id].wasteReason,
        timestamp: serverTimestamp()
      });
    }

    if (inventoryCache[id].addQty > 0) {
      await addDoc(collection(db, "addedStocks"), {
        employee,
        itemName,
        qty: inventoryCache[id].addQty,
        timestamp: serverTimestamp()
      });
    }

    summaryHTML += `
      <div>
        ${itemName}: ${inventoryCache[id].before} → ${finalStock}
      </div>
    `;
  }

  await addDoc(collection(db, "shifts"), {
    employee,
    category: selectedCategory,
    before: beforeData,
    after: afterData,
    timestamp: serverTimestamp()
  });

  document.getElementById("shiftSummary").style.display = "block";
  document.getElementById("summaryContent").innerHTML = summaryHTML;

  loadLastDuty();
}

/* ================= LOGOUT ================= */

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
