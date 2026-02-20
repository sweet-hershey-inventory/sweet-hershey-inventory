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

/* ===========================
   GLOBAL VARIABLES
=========================== */

let selectedCategory = null;
let inventoryCache = {};
let itemMap = {};
let beforeSaved = false;

/* ===========================
   LOGIN LOGIC
=========================== */

const loginForm = document.getElementById("loginForm");
const pinForm = document.getElementById("pinForm");

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (username === "staff" && password === "hershey123") {
      localStorage.setItem("systemRole", "staff");
      document.getElementById("pinSection").style.display = "block";
    }
    else if (username === "admin" && password === "SWEEThershey2025") {
      localStorage.setItem("systemRole", "admin");
      document.getElementById("pinSection").style.display = "block";
    }
    else {
      document.getElementById("error").innerText = "Invalid username or password";
    }
  });
}

if (pinForm) {
  pinForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const enteredPin = document.getElementById("pin").value;
    const systemRole = localStorage.getItem("systemRole");

    const snapshot = await getDocs(collection(db, "employees"));
    let found = false;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();

      if (data.pin === enteredPin) {

        if (systemRole === "staff" && data.role !== "employee") {
          document.getElementById("error").innerText = "Staff cannot use admin PIN";
          return;
        }

        if (systemRole === "admin" && data.role !== "admin") {
          document.getElementById("error").innerText = "Admin PIN required";
          return;
        }

        found = true;
        localStorage.setItem("employeeName", data.name);
        localStorage.setItem("role", data.role);
      }
    });

    if (found) {
      window.location.href = "dashboard.html";
    } else {
      document.getElementById("error").innerText = "Invalid PIN";
    }
  });
}

/* ===========================
   DASHBOARD LOGIC
=========================== */

window.onload = async function () {

  if (!window.location.pathname.includes("dashboard")) return;

  document.getElementById("employeeName").innerText =
    localStorage.getItem("employeeName");

  startClock();
  loadCategories();
  loadLastDuty();
};

/* CLOCK */
function startClock() {
  setInterval(() => {
    const now = new Date();
    document.getElementById("liveClock").innerText =
      now.toLocaleDateString() + " " + now.toLocaleTimeString();
  }, 1000);
}

/* LAST DUTY */
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    document.getElementById("lastDuty").innerText =
      "Last Duty: " + docSnap.data().employee;
  });
}

/* LOAD CATEGORIES */
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

/* SELECT CATEGORY */
window.selectCategory = async function(cat) {

  selectedCategory = cat;
  beforeSaved = false;

  document.getElementById("inventorySection").style.display = "block";
  document.getElementById("afterSection").style.display = "none";
  document.getElementById("wasteSection").style.display = "none";

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

      if (!inventoryCache[docSnap.id]) {
        inventoryCache[docSnap.id] = {
          before: data.stock,
          after: data.stock,
          wasteQty: 0,
          wasteReason: ""
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

window.updateBefore = function(id, val) {
  inventoryCache[id].before = Number(val);
};

window.confirmBefore = function() {
  if (!confirm("Proceed? This cannot be edited.")) return;
  beforeSaved = true;
  document.getElementById("afterSection").style.display = "block";
  loadAfter();
};

function loadAfter() {
  const afterList = document.getElementById("afterList");
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

window.updateAfter = function(id, val) {
  inventoryCache[id].after = Number(val);
};

window.logout = function() {
  localStorage.clear();
  window.location.href = "index.html";
};
