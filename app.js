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

/* =====================
   DASHBOARD INIT
===================== */
window.onload = async function () {

  if (!window.location.pathname.includes("dashboard")) return;

  employeeName.innerText = localStorage.getItem("employeeName");

  startClock();
  loadCategories();
  loadLastDuty();
};

/* =====================
   CLOCK
===================== */
function startClock() {
  setInterval(() => {
    const now = new Date();
    liveClock.innerText =
      now.toLocaleDateString() + " " + now.toLocaleTimeString();
  }, 1000);
}

/* =====================
   LAST DUTY
===================== */
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    lastDuty.innerText = "Last Duty: " + docSnap.data().employee;
  });
}

/* =====================
   LOAD CATEGORIES
===================== */
async function loadCategories() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const set = new Set();

  snapshot.forEach(doc => {
    set.add(doc.data().category);
  });

  categories.innerHTML = "";

  set.forEach(cat => {
    categories.innerHTML += `
      <div class="categoryBtn" onclick="selectCategory('${cat}')">
        ${cat.toUpperCase()}
      </div>
    `;
  });
}

/* =====================
   SELECT CATEGORY
===================== */
window.selectCategory = async function(cat) {

  selectedCategory = cat;
  beforeSaved = false;

  inventorySection.style.display = "block";
  afterSection.style.display = "none";
  wasteSection.style.display = "none";
  addStockSection.style.display = "none";

  categoryTitle.innerText = cat.toUpperCase();

  const snapshot = await getDocs(collection(db, "inventory"));

  beforeList.innerHTML = "";
  overallStocks.innerHTML = "";

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
            onchange="updateBefore('${docSnap.id}', this.value)">
        </div>
      `;
    }
  });
};

/* =====================
   UPDATE CACHE
===================== */
window.updateBefore = (id, val) => inventoryCache[id].before = Number(val);
window.updateAfter = (id, val) => inventoryCache[id].after = Number(val);
window.updateWasteQty = (id, val) => inventoryCache[id].wasteQty = Number(val);
window.updateWasteReason = (id, val) => inventoryCache[id].wasteReason = val;
window.updateAddQty = (id, val) => inventoryCache[id].addQty = Number(val);

/* =====================
   SAVE BEFORE
===================== */
window.confirmBefore = function() {
  if (!confirm("Proceed? Cannot edit later.")) return;

  beforeSaved = true;
  afterSection.style.display = "block";
  loadAfter();
};

/* =====================
   LOAD AFTER
===================== */
function loadAfter() {
  afterList.innerHTML = "";

  for (let id in inventoryCache) {
    afterList.innerHTML += `
      <div class="itemCard">
        ${itemMap[id]}
        <input type="number"
          value="${inventoryCache[id].after}"
          onchange="updateAfter('${id}', this.value)">
      </div>
    `;
  }
}

/* =====================
   WASTE
===================== */
window.toggleWaste = function() {
  wasteSection.style.display =
    wasteSection.style.display === "none" ? "block" : "none";

  wasteList.innerHTML = "";

  for (let id in inventoryCache) {
    wasteList.innerHTML += `
      <div class="itemCard">
        ${itemMap[id]}
        <input type="number" placeholder="Waste Qty"
          onchange="updateWasteQty('${id}', this.value)">
        <input type="text" placeholder="Reason"
          onchange="updateWasteReason('${id}', this.value)">
      </div>
    `;
  }
};

/* =====================
   ADD STOCK
===================== */
window.toggleAddStock = function() {
  addStockSection.style.display =
    addStockSection.style.display === "none" ? "block" : "none";

  addStockList.innerHTML = "";

  for (let id in inventoryCache) {
    addStockList.innerHTML += `
      <div class="itemCard">
        ${itemMap[id]}
        <input type="number" placeholder="Add Qty"
          onchange="updateAddQty('${id}', this.value)">
      </div>
    `;
  }
};

/* =====================
   COMPLETE SHIFT
===================== */
window.completeShift = async function() {

  if (!beforeSaved) {
    alert("Complete Before Shift first.");
    return;
  }

  if (!confirm("Complete shift? Cannot undo.")) return;

  const employee = localStorage.getItem("employeeName");

  let beforeData = {};
  let afterData = {};
  let summaryHTML = "";

  for (let id in inventoryCache) {

    const itemName = itemMap[id];

    beforeData[itemName] = inventoryCache[id].before;
    afterData[itemName] = inventoryCache[id].after;

    // UPDATE STOCK (After + Add - Waste)
    const finalStock =
      inventoryCache[id].after +
      (inventoryCache[id].addQty || 0) -
      (inventoryCache[id].wasteQty || 0);

    await updateDoc(doc(db, "inventory", id), {
      stock: finalStock
    });

    // LOG ADD STOCK
    if (inventoryCache[id].addQty > 0) {
      await addDoc(collection(db, "addedStocks"), {
        employee,
        itemName,
        qty: inventoryCache[id].addQty,
        timestamp: serverTimestamp()
      });
    }

    // LOG WASTE
    if (inventoryCache[id].wasteQty > 0) {
      await addDoc(collection(db, "wastes"), {
        employee,
        itemName,
        qty: inventoryCache[id].wasteQty,
        reason: inventoryCache[id].wasteReason,
        timestamp: serverTimestamp()
      });
    }

    summaryHTML += `
      <div>
        ${itemName}:
        Before ${inventoryCache[id].before} →
        After ${inventoryCache[id].after}
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

  shiftSummary.style.display = "block";
  summaryContent.innerHTML = summaryHTML;

  alert("Shift Completed!");
  loadLastDuty();
};

/* =====================
   LOGOUT
===================== */
window.logout = function() {
  localStorage.clear();
  window.location.href = "index.html";
};
