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

/* GLOBAL STATE */
let inventory = [];
let shiftData = {};
let currentCategory = null;

/* INIT */
window.addEventListener("DOMContentLoaded", async () => {

  if (!window.location.pathname.includes("dashboard")) return;

  document.getElementById("employeeName").innerText =
    localStorage.getItem("employeeName");

  startClock();
  await loadInventory();
  buildCategories();
  loadLastDuty();
});

/* CLOCK */
function startClock() {
  setInterval(() => {
    const now = new Date();
    document.getElementById("liveClock").innerText =
      now.toLocaleDateString() + " " + now.toLocaleTimeString();
  }, 1000);
}

/* LOAD INVENTORY */
async function loadInventory() {
  const snap = await getDocs(collection(db, "inventory"));
  inventory = [];
  snap.forEach(d => {
    const data = d.data();
    inventory.push({
      id: d.id,
      name: data.name,
      category: data.category,
      stock: Number(data.stock)
    });
  });
}

/* BUILD CATEGORIES */
function buildCategories() {
  const set = new Set(inventory.map(i => i.category));
  const container = document.getElementById("categories");
  container.innerHTML = "";

  set.forEach(cat => {
    const btn = document.createElement("div");
    btn.className = "categoryBtn";
    btn.innerText = cat;
    btn.onclick = () => openCategory(cat);
    container.appendChild(btn);
  });
}

/* OPEN CATEGORY */
function openCategory(cat) {

  currentCategory = cat;

  if (!shiftData[cat]) {
    shiftData[cat] = {
      locked: false,
      items: {}
    };
  }

  document.getElementById("inventorySection").style.display = "block";
  document.getElementById("categoryTitle").innerText = cat;

  renderCategory();
}

/* RENDER CATEGORY */
function renderCategory() {

  const state = shiftData[currentCategory];

  const beforeList = document.getElementById("beforeList");
  const afterList = document.getElementById("afterList");
  const overallStocks = document.getElementById("overallStocks");

  beforeList.innerHTML = "";
  afterList.innerHTML = "";
  overallStocks.innerHTML = "";

  inventory
    .filter(i => i.category === currentCategory)
    .forEach(item => {

      if (!state.items[item.id]) {
        state.items[item.id] = {
          before: item.stock,
          after: item.stock,
          add: 0,
          waste: 0,
          reason: ""
        };
      }

      const s = state.items[item.id];

      overallStocks.innerHTML +=
        `<div>${item.name}: ${item.stock}</div>`;

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

  document.getElementById("beforeSection").style.display =
    state.locked ? "none" : "block";

  document.getElementById("afterSection").style.display =
    state.locked ? "block" : "none";
}

/* SAVE BEFORE */
window.saveBefore = function() {
  if (!confirm("Lock Before Shift?")) return;
  shiftData[currentCategory].locked = true;
  renderCategory();
};

/* ADD STOCK */
window.toggleAdd = function() {

  const section = document.getElementById("addSection");
  section.style.display =
    section.style.display === "none" ? "block" : "none";

  section.innerHTML = "";

  const state = shiftData[currentCategory];

  Object.entries(state.items).forEach(([id, s]) => {

    const item = inventory.find(i => i.id === id);

    const div = document.createElement("div");
    div.className = "itemCard";

    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = "Add Qty";
    input.oninput = e => s.add = Number(e.target.value);

    div.innerText = item.name;
    div.appendChild(input);

    section.appendChild(div);
  });
};

/* WASTE */
window.toggleWaste = function() {

  const section = document.getElementById("wasteSection");
  section.style.display =
    section.style.display === "none" ? "block" : "none";

  section.innerHTML = "";

  const state = shiftData[currentCategory];

  Object.entries(state.items).forEach(([id, s]) => {

    const item = inventory.find(i => i.id === id);

    const div = document.createElement("div");
    div.className = "itemCard";

    const qty = document.createElement("input");
    qty.type = "number";
    qty.placeholder = "Waste Qty";
    qty.oninput = e => s.waste = Number(e.target.value);

    const reason = document.createElement("input");
    reason.type = "text";
    reason.placeholder = "Reason";
    reason.oninput = e => s.reason = e.target.value;

    div.innerText = item.name;
    div.appendChild(qty);
    div.appendChild(reason);

    section.appendChild(div);
  });
};

/* COMPLETE SHIFT */
window.completeShift = async function() {

  const state = shiftData[currentCategory];

  if (!state.locked) {
    alert("Save Before Shift first.");
    return;
  }

  if (!confirm("Complete shift?")) return;

  const employee = localStorage.getItem("employeeName");

  let summary = "";

  for (let [id, s] of Object.entries(state.items)) {

    const finalStock = s.after + s.add - s.waste;

    await updateDoc(doc(db, "inventory", id), {
      stock: finalStock
    });

    summary += `
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

  document.getElementById("categoryContainer").style.display = "none";
  document.getElementById("inventorySection").style.display = "none";
  document.getElementById("previewSection").style.display = "block";
  document.getElementById("previewContent").innerHTML = summary;

  loadLastDuty();
};

/* LAST DUTY */
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  snap.forEach(d => {
    document.getElementById("lastDuty").innerText =
      "Last Duty: " + d.data().employee;
  });
}

/* LOGOUT */
window.logout = function() {
  localStorage.clear();
  window.location.href = "index.html";
};
