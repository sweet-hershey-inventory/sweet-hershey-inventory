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
let shiftData = {}; 
let inventoryDocs = {};
let shiftCompleted = false;

window.addEventListener("DOMContentLoaded", async () => {

  if (!window.location.pathname.includes("dashboard")) return;

  employeeName.innerText = localStorage.getItem("employeeName");

  startClock();
  loadCategories();
  loadLastDuty();

  logoutBtn.onclick = logout;
  saveBeforeBtn.onclick = saveBefore;
  toggleWasteBtn.onclick = toggleWaste;
  toggleAddStockBtn.onclick = toggleAddStock;
  completeShiftBtn.onclick = completeShift;
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

  snapshot.forEach(docSnap => {
    set.add(docSnap.data().category);
    inventoryDocs[docSnap.id] = docSnap.data();
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
function selectCategory(cat) {

  selectedCategory = cat;
  inventorySection.style.display = "block";
  categoryTitle.innerText = cat.toUpperCase();

  beforeSection.style.display = shiftData[cat]?.locked ? "none" : "block";
  afterSection.style.display = shiftData[cat]?.locked ? "block" : "none";

  renderCategory();
}

function renderCategory() {

  beforeList.innerHTML = "";
  afterList.innerHTML = "";
  wasteSection.innerHTML = "";
  addStockSection.innerHTML = "";
  overallStocks.innerHTML = "";

  Object.entries(inventoryDocs).forEach(([id, data]) => {

    if (data.category !== selectedCategory) return;

    if (!shiftData[selectedCategory]) {
      shiftData[selectedCategory] = { items: {}, locked: false };
    }

    if (!shiftData[selectedCategory].items[id]) {
      shiftData[selectedCategory].items[id] = {
        before: data.stock,
        after: data.stock,
        wasteQty: 0,
        wasteReason: "",
        addQty: 0
      };
    }

    const item = shiftData[selectedCategory].items[id];

    overallStocks.innerHTML += `
      <div>${data.name}: <strong>${data.stock}</strong></div>
    `;

    if (!shiftData[selectedCategory].locked) {
      beforeList.innerHTML += `
        <div class="itemCard">
          ${data.name}
          <input type="number" value="${item.before}"
          onchange="shiftData['${selectedCategory}'].items['${id}'].before = Number(this.value)">
        </div>
      `;
    }

    afterList.innerHTML += `
      <div class="itemCard">
        ${data.name}
        <input type="number" value="${item.after}"
        onchange="shiftData['${selectedCategory}'].items['${id}'].after = Number(this.value)">
      </div>
    `;
  });
}

/* SAVE BEFORE */
function saveBefore() {
  if (!confirm("Proceed? Cannot edit later.")) return;

  shiftData[selectedCategory].locked = true;

  beforeSection.style.display = "none";
  afterSection.style.display = "block";
}

/* WASTE */
function toggleWaste() {
  wasteSection.style.display =
    wasteSection.style.display === "none" ? "block" : "none";

  wasteSection.innerHTML = "";

  Object.entries(shiftData[selectedCategory].items).forEach(([id, item]) => {
    wasteSection.innerHTML += `
      <div class="itemCard">
        ${inventoryDocs[id].name}
        <input type="number" placeholder="Qty"
        onchange="shiftData['${selectedCategory}'].items['${id}'].wasteQty = Number(this.value)">
        <input type="text" placeholder="Reason"
        onchange="shiftData['${selectedCategory}'].items['${id}'].wasteReason = this.value">
      </div>
    `;
  });
}

/* ADD STOCK */
function toggleAddStock() {
  addStockSection.style.display =
    addStockSection.style.display === "none" ? "block" : "none";

  addStockSection.innerHTML = "";

  Object.entries(shiftData[selectedCategory].items).forEach(([id, item]) => {
    addStockSection.innerHTML += `
      <div class="itemCard">
        ${inventoryDocs[id].name}
        <input type="number" placeholder="Qty"
        onchange="shiftData['${selectedCategory}'].items['${id}'].addQty = Number(this.value)">
      </div>
    `;
  });
}

/* COMPLETE SHIFT */
async function completeShift() {

  if (!shiftData[selectedCategory]?.locked) {
    alert("Save Before Shift first.");
    return;
  }

  if (!confirm("Complete shift? Cannot undo.")) return;

  const employee = localStorage.getItem("employeeName");

  let previewHTML = `<h4>${selectedCategory.toUpperCase()}</h4>`;

  for (let [id, item] of Object.entries(shiftData[selectedCategory].items)) {

    const name = inventoryDocs[id].name;
    const finalStock = item.after + item.addQty - item.wasteQty;

    await updateDoc(doc(db, "inventory", id), {
      stock: finalStock
    });

    if (item.addQty > 0) {
      await addDoc(collection(db, "addedStocks"), {
        employee,
        category: selectedCategory,
        itemName: name,
        qty: item.addQty,
        timestamp: serverTimestamp()
      });
    }

    if (item.wasteQty > 0) {
      await addDoc(collection(db, "wastes"), {
        employee,
        category: selectedCategory,
        itemName: name,
        qty: item.wasteQty,
        reason: item.wasteReason,
        timestamp: serverTimestamp()
      });
    }

    previewHTML += `
      <div>
        ${name} → Final: ${finalStock}
      </div>
    `;
  }

  await addDoc(collection(db, "shifts"), {
    employee,
    category: selectedCategory,
    data: shiftData[selectedCategory].items,
    timestamp: serverTimestamp()
  });

  alert("You did a great work! Don't forget to rest and say thank you!");

  inventorySection.style.display = "none";
  previewSection.style.display = "block";
  previewContent.innerHTML = previewHTML;

  loadLastDuty();
}

/* LOGOUT */
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
