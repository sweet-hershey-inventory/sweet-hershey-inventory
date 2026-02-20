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

let inventory = {};
let shiftState = {};
let currentCategory = null;

window.addEventListener("DOMContentLoaded", async () => {

  if (!window.location.pathname.includes("dashboard")) return;

  employeeName.innerText = localStorage.getItem("employeeName");

  startClock();
  await loadInventory();
  loadCategories();
  loadLastDuty();

  logoutBtn.onclick = logout;
  saveBeforeBtn.onclick = saveBefore;
  toggleWasteBtn.onclick = toggleWaste;
  toggleAddBtn.onclick = toggleAdd;
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

/* LOAD INVENTORY ONCE */
async function loadInventory() {
  const snap = await getDocs(collection(db, "inventory"));

  snap.forEach(d => {
    inventory[d.id] = { ...d.data(), id: d.id };
  });
}

/* LOAD CATEGORIES */
function loadCategories() {
  const set = new Set(Object.values(inventory).map(i => i.category));
  categories.innerHTML = "";

  set.forEach(cat => {
    const btn = document.createElement("div");
    btn.className = "categoryBtn";
    btn.innerText = cat.toUpperCase();
    btn.onclick = () => openCategory(cat);
    categories.appendChild(btn);
  });
}

/* OPEN CATEGORY */
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

/* RENDER CATEGORY */
function renderCategory() {

  beforeList.innerHTML = "";
  afterList.innerHTML = "";
  wasteSection.innerHTML = "";
  addSection.innerHTML = "";
  overallStocks.innerHTML = "";

  const state = shiftState[currentCategory];

  Object.values(inventory).forEach(item => {

    if (item.category !== currentCategory) return;

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
      const input = document.createElement("input");
      input.type = "number";
      input.value = s.before;
      input.oninput = e => s.before = Number(e.target.value);

      const div = document.createElement("div");
      div.className = "itemCard";
      div.innerText = item.name;
      div.appendChild(input);

      beforeList.appendChild(div);
    }

    const afterInput = document.createElement("input");
    afterInput.type = "number";
    afterInput.value = s.after;
    afterInput.oninput = e => s.after = Number(e.target.value);

    const div2 = document.createElement("div");
    div2.className = "itemCard";
    div2.innerText = item.name;
    div2.appendChild(afterInput);

    afterList.appendChild(div2);
  });

  beforeSection.style.display = state.locked ? "none" : "block";
  afterSection.style.display = state.locked ? "block" : "none";
}

/* SAVE BEFORE */
function saveBefore() {
  if (!confirm("Lock Before Shift? Cannot edit later.")) return;
  shiftState[currentCategory].locked = true;
  renderCategory();
}

/* TOGGLE WASTE */
function toggleWaste() {
  wasteSection.style.display =
    wasteSection.style.display === "none" ? "block" : "none";

  wasteSection.innerHTML = "";

  const state = shiftState[currentCategory];

  Object.entries(state.items).forEach(([id, s]) => {

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${inventory[id].name}
      <input type="number" placeholder="Qty"
        oninput="shiftState['${currentCategory}'].items['${id}'].waste = Number(this.value)">
      <input type="text" placeholder="Reason"
        oninput="shiftState['${currentCategory}'].items['${id}'].wasteReason = this.value">
    `;

    wasteSection.appendChild(div);
  });
}

/* TOGGLE ADD */
function toggleAdd() {
  addSection.style.display =
    addSection.style.display === "none" ? "block" : "none";

  addSection.innerHTML = "";

  const state = shiftState[currentCategory];

  Object.entries(state.items).forEach(([id, s]) => {

    const div = document.createElement("div");
    div.className = "itemCard";

    div.innerHTML = `
      ${inventory[id].name}
      <input type="number" placeholder="Qty"
        oninput="shiftState['${currentCategory}'].items['${id}'].add = Number(this.value)">
    `;

    addSection.appendChild(div);
  });
}

/* COMPLETE SHIFT */
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
        ${inventory[id].name}
        → Final: ${finalStock}
        | Added: ${s.add}
        | Waste: ${s.waste}
      </div>
    `;

    if (s.add > 0) {
      await addDoc(collection(db, "addedStocks"), {
        employee,
        category: currentCategory,
        itemName: inventory[id].name,
        qty: s.add,
        timestamp: serverTimestamp()
      });
    }

    if (s.waste > 0) {
      await addDoc(collection(db, "wastes"), {
        employee,
        category: currentCategory,
        itemName: inventory[id].name,
        qty: s.waste,
        reason: s.wasteReason,
        timestamp: serverTimestamp()
      });
    }
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

/* LAST DUTY */
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => {
    lastDuty.innerText = "Last Duty: " + d.data().employee;
  });
}

/* LOGOUT */
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
