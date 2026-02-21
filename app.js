import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const currentPage = window.location.pathname.includes("dashboard")
  ? "dashboard"
  : "login";

/* ================= LOGIN SYSTEM ================= */

if (currentPage === "login") {

  const loginBtn = document.getElementById("loginBtn");
  const pinSection = document.getElementById("pinSection");
  const errorText = document.getElementById("loginError");

  let tempUser = null;

  loginBtn.onclick = async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!tempUser) {
      if (
        (username === "staff" && password === "hershey123") ||
        (username === "admin" && password === "SWEEThershey2025")
      ) {
        tempUser = username;
        pinSection.style.display = "block";
      } else {
        errorText.textContent = "Invalid credentials";
      }
    } else {
      const pin = document.getElementById("pin").value;
      const snapshot = await getDocs(collection(db, "employees"));

      let valid = false;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (
          data.pin === pin &&
          ((tempUser === "staff" && data.role === "employee") ||
           (tempUser === "admin" && data.role === "admin"))
        ) {
          valid = true;
          sessionStorage.setItem("employeeName", data.name);
        }
      });

      if (valid) {
        window.location.href = "dashboard.html";
      } else {
        errorText.textContent = "Invalid PIN";
      }
    }
  };
}

/* ================= DASHBOARD ================= */

if (currentPage === "dashboard") {

  const employeeName = sessionStorage.getItem("employeeName");
  if (!employeeName) window.location.href = "index.html";

  const categoryContainer = document.getElementById("categoryContainer");
  const inventoryContainer = document.getElementById("inventoryContainer");

  let inventoryData = [];
  let categories = [];
  let selectedCategory = null;

  let shiftState = {
    before: {},
    after: {},
    beforeSaved: false
  };

  /* Live Clock */
  function startClock() {
    const clock = document.getElementById("liveClock");
    setInterval(() => {
      const now = new Date();
      clock.textContent = now.toLocaleString();
    }, 1000);
  }
  startClock();

  /* Load Last Duty */
  async function loadLastDuty() {
    const q = query(collection(db, "shifts"), orderBy("createdAt", "desc"), limit(1));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      document.getElementById("lastDuty").textContent =
        docSnap.data().employee;
    });
  }
  loadLastDuty();

  /* Load Inventory */
  async function loadInventory() {
    const snapshot = await getDocs(collection(db, "inventory"));
    inventoryData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.active === true);

    categories = [...new Set(inventoryData.map(i => i.category))];
    renderCategories();
  }

  function renderCategories() {
    categoryContainer.innerHTML = "";
    categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.textContent = cat;
      btn.className = "category-btn";
      btn.onclick = () => {
        selectedCategory = cat;
        renderItems(cat);
      };
      categoryContainer.appendChild(btn);
    });
  }

  function renderItems(category) {
    inventoryContainer.innerHTML = "";
    const items = inventoryData.filter(i => i.category === category);

    items.forEach(item => {
      const beforeVal = shiftState.before[item.id] ?? item.stock;
      const afterVal = shiftState.after[item.id] ?? "";

      const card = document.createElement("div");
      card.className = "item-card";

      card.innerHTML = `
        <h4>${item.name}</h4>
        ${!shiftState.beforeSaved ? `
          <label>Before</label>
          <input type="number" value="${beforeVal}" data-id="${item.id}" class="beforeInput">
        ` : `
          <p>Before: ${beforeVal}</p>
          <label>After</label>
          <input type="number" value="${afterVal}" data-id="${item.id}" class="afterInput">
        `}
      `;

      inventoryContainer.appendChild(card);
    });

    attachInputListeners();
  }

  function attachInputListeners() {
    document.querySelectorAll(".beforeInput").forEach(input => {
      input.oninput = e => {
        shiftState.before[e.target.dataset.id] = Number(e.target.value);
      };
    });

    document.querySelectorAll(".afterInput").forEach(input => {
      input.oninput = e => {
        shiftState.after[e.target.dataset.id] = Number(e.target.value);
      };
    });
  }

  document.getElementById("saveBeforeBtn").onclick = () => {
    shiftState.beforeSaved = true;
    if (selectedCategory) renderItems(selectedCategory);
  };

  document.getElementById("completeShiftBtn").onclick = async () => {

    if (!shiftState.beforeSaved) {
      alert("Save Before Shift first!");
      return;
    }

    for (let item of inventoryData) {
      const before = shiftState.before[item.id] ?? item.stock;
      const after = shiftState.after[item.id] ?? before;

      await updateDoc(doc(db, "inventory", item.id), {
        stock: after
      });
    }

    await addDoc(collection(db, "shifts"), {
      employee: employeeName,
      before: shiftState.before,
      after: shiftState.after,
      createdAt: serverTimestamp()
    });

    alert("You did a great work! Don't forget to rest and say thank you!");

    sessionStorage.clear();
    window.location.href = "index.html";
  };

  loadInventory();
}
