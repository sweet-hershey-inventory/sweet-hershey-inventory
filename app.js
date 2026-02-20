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
let beforeLocked = false;

window.addEventListener("DOMContentLoaded", async () => {

  if (!window.location.pathname.includes("dashboard")) return;

  employeeName.innerText = localStorage.getItem("employeeName");

  startClock();
  loadCategories();
  loadLastDuty();

  logoutBtn.addEventListener("click", logout);
  saveBeforeBtn.addEventListener("click", saveBefore);
  toggleWasteBtn.addEventListener("click", toggleWaste);
  toggleAddStockBtn.addEventListener("click", toggleAddStock);
  completeShiftBtn.addEventListener("click", completeShift);
});

/* CLOCK */
function startClock() {
  setInterval(() => {
    const now = new Date();
    liveClock.innerText =
      now.toLocaleDateString() + " " + now.toLocaleTimeString();
  }, 1000);
}

/* LAST DUTY */
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => {
    lastDuty.innerText = "Last Duty: " + d.data().employee;
  });
}

/* LOAD CATEGORIES */
async function loadCategories() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const set = new Set();

  snapshot.forEach(doc => {
    set.add(doc.data().category);
  });

  categories.innerHTML = "";

  set.forEach(cat => {
    const btn = document.createElement("div");
    btn.className = "categoryBtn";
    btn.innerText = cat.toUpperCase();
    btn.onclick = () => selectCategory(cat);
    categories.appendChild(btn);
  });
}

/* SELECT CATEGORY */
async function selectCategory(cat) {

  selectedCategory = cat;

  inventorySection.style.display = "block";
  categoryTitle.innerText = cat.toUpperCase();

  beforeList.innerHTML = "";
  afterList.innerHTML = "";
  overallStocks.innerHTML = "";
  wasteSection.style.display = "none";
  addStockSection.style.display = "none";

  const snapshot = await getDocs(collection(db, "inventory"));

  snapshot.forEach(docSnap => {

    const data = docSnap.data();

    if (data.category === cat) {

      itemMap[docSnap.id] = data.name;

      if (!inventoryCache[docSnap.id]) {
        inventoryCache[docSnap.id] = {
          before: data.stock,
          after: data.stock,
          wasteQty: 0,
          wasteReason: "",
          addQty: 0
        };
      }

      overallStocks.innerHTML += `
        <div>${data.name}: <strong>${data.stock}</strong></div>
      `;

      beforeList.innerHTML += `
        <div class="itemCard">
          ${data.name}
          <input type="number"
            value="${inventoryCache[docSnap.id].before}"
            onchange="inventoryCache['${docSnap.id}'].before = Number(this.value)">
        </div>
      `;
    }
  });

  if (beforeLocked) loadAfterSection();
}

/* SAVE BEFORE */
function saveBefore() {
  if (!confirm("Proceed? This cannot be edited.")) return;

  beforeLocked = true;
  beforeSection.style.display = "none";
  afterSection.style.display = "block";
  loadAfterSection();
}

/* LOAD AFTER */
function loadAfterSection() {

  afterList.innerHTML = "";

  Object.keys(inventoryCache).forEach(id => {

    if (!itemMap[id]) return;

    afterList.innerHTML += `
      <div class="itemCard">
        ${itemMap[id]}
        <input type="number"
          value="${inventoryCache[id].after}"
          onchange="inventoryCache['${id}'].after = Number(this.value)">
      </div>
    `;
  });
}

/* WASTE PER CATEGORY */
function toggleWaste() {

  wasteSection.style.display =
    wasteSection.style.display === "none" ? "block" : "none";

  wasteList.innerHTML = "";

  Object.keys(inventoryCache).forEach(id => {

    if (!itemMap[id]) return;

    wasteList.innerHTML += `
      <div class="itemCard">
        ${itemMap[id]}
        <input type="number" placeholder="Qty"
          onchange="inventoryCache['${id}'].wasteQty = Number(this.value)">
        <input type="text" placeholder="Reason"
          onchange="inventoryCache['${id}'].wasteReason = this.value">
      </div>
    `;
  });
}

/* ADD STOCK PER CATEGORY */
function toggleAddStock() {

  addStockSection.style.display =
    addStockSection.style.display === "none" ? "block" : "none";

  addStockList.innerHTML = "";

  Object.keys(inventoryCache).forEach(id => {

    if (!itemMap[id]) return;

    addStockList.innerHTML += `
      <div class="itemCard">
        ${itemMap[id]}
        <input type="number" placeholder="Qty"
          onchange="inventoryCache['${id}'].addQty = Number(this.value)">
      </div>
    `;
  });
}

/* COMPLETE SHIFT */
async function completeShift() {

  if (!beforeLocked) {
    alert("Please Save Before Shift first.");
    return;
  }

  if (!confirm("Complete shift? Cannot undo.")) return;

  const employee = localStorage.getItem("employeeName");

  let beforeData = {};
  let afterData = {};
  let addedData = {};
  let wastedData = {};
  let summaryHTML = "";

  for (let id in inventoryCache) {

    if (!itemMap[id]) continue;

    const itemName = itemMap[id];

    const beforeVal = inventoryCache[id].before;
    const afterVal = inventoryCache[id].after;
    const addVal = inventoryCache[id].addQty || 0;
    const wasteVal = inventoryCache[id].wasteQty || 0;

    const finalStock = afterVal + addVal - wasteVal;

    beforeData[itemName] = beforeVal;
    afterData[itemName] = afterVal;
    addedData[itemName] = addVal;
    wastedData[itemName] = wasteVal;

    await updateDoc(doc(db, "inventory", id), {
      stock: finalStock
    });

    if (addVal > 0) {
      await addDoc(collection(db, "addedStocks"), {
        employee,
        category: selectedCategory,
        itemName,
        qty: addVal,
        timestamp: serverTimestamp()
      });
    }

    if (wasteVal > 0) {
      await addDoc(collection(db, "wastes"), {
        employee,
        category: selectedCategory,
        itemName,
        qty: wasteVal,
        reason: inventoryCache[id].wasteReason,
        timestamp: serverTimestamp()
      });
    }

    summaryHTML += `
      <div>
        ${itemName} → Before: ${beforeVal},
        After: ${afterVal},
        Added: ${addVal},
        Wasted: ${wasteVal},
        Final: ${finalStock}
      </div>
    `;
  }

  await addDoc(collection(db, "shifts"), {
    employee,
    category: selectedCategory,
    before: beforeData,
    after: afterData,
    added: addedData,
    wasted: wastedData,
    timestamp: serverTimestamp()
  });

  alert("You did a great work! Don't forget to rest and say thank you!");

  shiftSummary.style.display = "block";
  summaryContent.innerHTML = summaryHTML;

  loadLastDuty();
}

/* LOGOUT */
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
