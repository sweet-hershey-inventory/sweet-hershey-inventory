import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   GLOBAL STATE
================================ */

let inventory = [];
let shiftState = {};
let currentCategory = null;

/* ===============================
   INIT
================================ */

window.addEventListener("DOMContentLoaded", async () => {

  if (!window.location.pathname.includes("dashboard")) return;

  employeeName.innerText = localStorage.getItem("employeeName");

  startClock();
  await loadInventory();   // WAIT properly
  buildCategories();
  loadLastDuty();

  logoutBtn.onclick = logout;
  saveBeforeBtn.onclick = saveBefore;
  toggleWasteBtn.onclick = toggleWaste;
  toggleAddBtn.onclick = toggleAdd;
  completeShiftBtn.onclick = completeShift;
});

/* ===============================
   LOAD INVENTORY (FIXED)
================================ */

async function loadInventory() {

  const snap = await getDocs(collection(db, "inventory"));

  inventory = [];

  snap.forEach(docSnap => {
    const data = docSnap.data();

    if (!data.category || !data.name) return;

    inventory.push({
      id: docSnap.id,
      name: data.name,
      category: data.category.trim().toLowerCase(),
      stock: Number(data.stock)
    });
  });

  console.log("Inventory loaded:", inventory);
}

/* ===============================
   BUILD CATEGORIES
================================ */

function buildCategories() {

  const categorySet = new Set(inventory.map(i => i.category));

  categories.innerHTML = "";

  categorySet.forEach(cat => {

    const btn = document.createElement("div");
    btn.className = "categoryBtn";
    btn.innerText = cat.toUpperCase();

    btn.onclick = () => openCategory(cat);

    categories.appendChild(btn);
  });
}

/* ===============================
   OPEN CATEGORY
================================ */

function openCategory(cat) {

  currentCategory = cat;

  if (!shiftState[cat]) {
    shiftState[cat] = {
      locked: false,
      items: {}
    };
  }

  inventorySection.style.display = "block";
  categoryTitle.innerText = cat.toUpperCase();

  renderCategory();
}

/* ===============================
   RENDER CATEGORY (FIXED SAFE)
================================ */

function renderCategory() {

  const state = shiftState[currentCategory];

  beforeList.innerHTML = "";
  afterList.innerHTML = "";
  wasteSection.innerHTML = "";
  addSection.innerHTML = "";
  overallStocks.innerHTML = "";

  const filteredItems = inventory.filter(i => i.category === currentCategory);

  if (filteredItems.length === 0) {
    beforeList.innerHTML = "<p>No items found in this category.</p>";
    return;
  }

  filteredItems.forEach(item => {

    if (!state.items[item.id]) {
      state.items[item.id] = {
        before: item.stock,
        after: item.stock,
        waste: 0,
        wasteReason: "",
        add: 0
      };
    }

    const s = state.items[item.id];

    overallStocks.innerHTML += `
      <div>${item.name}: <strong>${item.stock}</strong></div>
    `;

    if (!state.locked) {

      const beforeInput = document.createElement("input");
      beforeInput.type = "number";
      beforeInput.value = s.before;
      beforeInput.oninput = e => {
        s.before = Number(e.target.value);
      };

      const div = document.createElement("div");
      div.className = "itemCard";
      div.innerText = item.name;
      div.appendChild(beforeInput);

      beforeList.appendChild(div);
    }

    const afterInput = document.createElement("input");
    afterInput.type = "number";
    afterInput.value = s.after;
    afterInput.oninput = e => {
      s.after = Number(e.target.value);
    };

    const div2 = document.createElement("div");
    div2.className = "itemCard";
    div2.innerText = item.name;
    div2.appendChild(afterInput);

    afterList.appendChild(div2);
  });

  beforeSection.style.display = state.locked ? "none" : "block";
  afterSection.style.display = state.locked ? "block" : "none";
}

/* ===============================
   SAVE BEFORE
================================ */

function saveBefore() {

  const state = shiftState[currentCategory];

  if (!confirm("Lock Before Shift? Cannot edit later.")) return;

  state.locked = true;
  renderCategory();
}

/* ===============================
   TOGGLE WASTE
================================ */

function toggleWaste() {

  const state = shiftState[currentCategory];

  wasteSection.style.display =
    wasteSection.style.display === "none" ? "block" : "none";

  wasteSection.innerHTML = "";

  Object.entries(state.items).forEach(([id, s]) => {

    const item = inventory.find(i => i.id === id);

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${item.name}
      <input type="number" placeholder="Qty"
        oninput="shiftState['${currentCategory}'].items['${id}'].waste = Number(this.value)">
      <input type="text" placeholder="Reason"
        oninput="shiftState['${currentCategory}'].items['${id}'].wasteReason = this.value)">
    `;

    wasteSection.appendChild(div);
  });
}

/* ===============================
   TOGGLE ADD STOCK
================================ */

function toggleAdd() {

  const state = shiftState[currentCategory];

  addSection.style.display =
    addSection.style.display === "none" ? "block" : "none";

  addSection.innerHTML = "";

  Object.entries(state.items).forEach(([id, s]) => {

    const item = inventory.find(i => i.id === id);

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${item.name}
      <input type="number" placeholder="Qty"
        oninput="shiftState['${currentCategory}'].items['${id}'].add = Number(this.value)">
    `;

    addSection.appendChild(div);
  });
}

/* ===============================
   COMPLETE SHIFT
================================ */

async function completeShift() {

  const state = shiftState[currentCategory];

  if (!state.locked) {
    alert("Save Before Shift first.");
    return;
  }

  if (!confirm("Complete shift? Cannot undo.")) return;

  const employee = localStorage.getItem("employeeName");

  let previewHTML = `<h4>${currentCategory.toUpperCase()}</h4>`;

  for (let [id, s] of Object.entries(state.items)) {

    const finalStock = s.after + s.add - s.waste;

    await updateDoc(doc(db, "inventory", id), {
      stock: finalStock
    });

    previewHTML += `
      <div>
        ${inventory.find(i => i.id === id).name}
        → Final: ${finalStock}
        | Added: ${s.add}
        | Waste: ${s.waste}
      </div>
    `;
  }

  await addDoc(collection(db, "shifts"), {
    employee,
    category: currentCategory,
    data: state.items,
    timestamp: serverTimestamp()
  });

  alert("You did a great work! Don't forget to rest and say thank you!");

  categoryContainer.style.display = "none";
  inventorySection.style.display = "none";
  previewSection.style.display = "block";
  previewContent.innerHTML = previewHTML;

  loadLastDuty();
}

/* ===============================
   LAST DUTY
================================ */

async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => {
    lastDuty.innerText = "Last Duty: " + d.data().employee;
  });
}

/* ===============================
   LOGOUT
================================ */

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
