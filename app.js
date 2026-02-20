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

let systemRole = null;
let selectedCategory = null;

// LOGIN
document.getElementById("loginForm")?.addEventListener("submit", e => {
  e.preventDefault();

  const u = username.value;
  const p = password.value;

  if (u === "staff" && p === "hershey123") {
    systemRole = "staff";
    pinSection.style.display = "block";
  }
  else if (u === "admin" && p === "SWEEThershey2025") {
    systemRole = "admin";
    pinSection.style.display = "block";
  }
  else {
    error.innerText = "Invalid login";
  }
});

// PIN VERIFY
document.getElementById("pinForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const snapshot = await getDocs(collection(db, "employees"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    if (data.pin === pin.value) {

      if (systemRole === "staff" && data.role !== "employee") {
        error.innerText = "Staff cannot use admin PIN";
        return;
      }

      if (systemRole === "admin" && data.role !== "admin") {
        error.innerText = "Admin login required";
        return;
      }

      localStorage.setItem("employeeName", data.name);
      localStorage.setItem("role", data.role);
      window.location.href = "dashboard.html";
    }
  });
});

// DASHBOARD LOAD
window.onload = async function () {
  if (!window.location.pathname.includes("dashboard")) return;

  const name = localStorage.getItem("employeeName");
  const role = localStorage.getItem("role");

  document.getElementById("employeeName").innerText = name;

  if (role === "admin") {
    document.getElementById("adminSection").style.display = "block";
  }

  startClock();
  loadCategories();
  loadLastDuty();
  loadAdminItems();
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
  document.getElementById("inventorySection").style.display = "block";
  document.getElementById("categoryTitle").innerText = cat.toUpperCase();

  const snapshot = await getDocs(collection(db, "inventory"));
  const beforeDiv = document.getElementById("beforeList");
  const afterDiv = document.getElementById("afterList");

  beforeDiv.innerHTML = "";
  afterDiv.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.category === cat) {
      beforeDiv.innerHTML += `
        <div class="itemCard">
          ${data.name}
          <input type="number" id="before_${docSnap.id}" value="${data.stock}">
        </div>
      `;
      afterDiv.innerHTML += `
        <div class="itemCard">
          ${data.name}
          <input type="number" id="after_${docSnap.id}" value="${data.stock}">
        </div>
      `;
    }
  });
};

// SAVE SHIFT
window.saveShift = async function() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const employee = localStorage.getItem("employeeName");

  let before = {};
  let after = {};

  snapshot.forEach(docSnap => {
    if (docSnap.data().category === selectedCategory) {
      before[docSnap.id] = Number(document.getElementById("before_" + docSnap.id).value);
      after[docSnap.id] = Number(document.getElementById("after_" + docSnap.id).value);
    }
  });

  await addDoc(collection(db, "shifts"), {
    employee,
    category: selectedCategory,
    before,
    after,
    timestamp: serverTimestamp()
  });

  alert("Inventory saved!");
  loadLastDuty();
};

// ADMIN LOAD ITEMS
async function loadAdminItems() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const select = document.getElementById("adminItem");
  if (!select) return;

  snapshot.forEach(docSnap => {
    select.innerHTML += `
      <option value="${docSnap.id}">
        ${docSnap.data().name}
      </option>
    `;
  });
}

// ADMIN ADD STOCK
window.addStock = async function() {
  const id = adminItem.value;
  const qty = Number(adminQty.value);

  const ref = doc(db, "inventory", id);
  const snap = await getDoc(ref);

  await updateDoc(ref, {
    stock: snap.data().stock + qty
  });

  alert("Stock updated!");
};

window.logout = function() {
  localStorage.clear();
  window.location.href = "index.html";
};
