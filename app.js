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

const page = window.location.pathname.includes("dashboard")
  ? "dashboard"
  : "login";

/* ================= LOGIN ================= */

if (page === "login") {

  const loginBtn = document.getElementById("loginBtn");
  const errorText = document.getElementById("loginError");
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  const pinSection = document.getElementById("pinSection");

  let tempUser = null;

  togglePassword.onclick = () => {
    passwordInput.type =
      passwordInput.type === "password" ? "text" : "password";
  };

  function clearError() {
    errorText.textContent = "";
  }

  document.getElementById("username").oninput = clearError;
  document.getElementById("password").oninput = clearError;
  document.getElementById("pin").oninput = clearError;

  loginBtn.onclick = async () => {
    clearError();

    const username = document.getElementById("username").value;
    const password = passwordInput.value;

    if (!tempUser) {
      if (
        (username === "staff" && password === "hershey123") ||
        (username === "admin" && password === "SWEEThershey2025")
      ) {
        tempUser = username;
        pinSection.style.display = "block";
      } else {
        errorText.textContent = "Invalid username or password";
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

if (page === "dashboard") {

  const employeeName = sessionStorage.getItem("employeeName");
  if (!employeeName) window.location.href = "index.html";

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  };

  function startClock() {
    const clock = document.getElementById("liveClock");
    setInterval(() => {
      clock.textContent = new Date().toLocaleString();
    }, 1000);
  }
  startClock();

  async function loadLastDuty() {
    const q = query(collection(db, "shifts"), orderBy("createdAt", "desc"), limit(1));
    const snap = await getDocs(q);
    snap.forEach(d => {
      document.getElementById("lastDuty").textContent = d.data().employee;
    });
  }
  loadLastDuty();

  let inventoryData = [];
  let categories = [];
  let selectedCategory = null;

  let shiftState = {
    before: {},
    after: {},
    added: {},
    wastes: {},
    stage: "before"
  };

  async function loadInventory() {
    const snap = await getDocs(collection(db, "inventory"));
    inventoryData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.active === true);

    categories = [...new Set(inventoryData.map(i => i.category))];
    renderCategories();
  }

  function renderCategories() {
    const container = document.getElementById("categoryContainer");
    container.innerHTML = "";

    categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.textContent = cat;
      btn.className = "category-btn";
      btn.onclick = () => {
        selectedCategory = cat;
        renderItems(cat);
      };
      container.appendChild(btn);
    });
  }

  function renderItems(category) {
    const container = document.getElementById("inventoryContainer");
    container.innerHTML = "";

    const items = inventoryData.filter(i => i.category === category);

    items.forEach(item => {

      const card = document.createElement("div");
      card.className = "item-card";

      if (shiftState.stage === "before") {
        const val = shiftState.before[item.id] ?? item.stock;
        card.innerHTML = `
          <h4>${item.name}</h4>
          <input type="number" value="${val}" data-id="${item.id}" class="beforeInput">
        `;
      }

      if (shiftState.stage === "after") {
        const val = shiftState.after[item.id] ?? "";
        card.innerHTML = `
          <h4>${item.name}</h4>
          <p>Before: ${shiftState.before[item.id]}</p>
          <input type="number" value="${val}" data-id="${item.id}" class="afterInput">
        `;
      }

      container.appendChild(card);
    });

    attachInputs();
  }

  function attachInputs() {
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

  document.getElementById("submitShiftBtn").onclick = async () => {

    if (shiftState.stage === "before") {
      shiftState.stage = "after";
      document.getElementById("shiftTitle").textContent = "After Inventory Shift";
      document.getElementById("sideActions").style.display = "block";
      if (selectedCategory) renderItems(selectedCategory);
      return;
    }

    if (shiftState.stage === "after") {

      for (let item of inventoryData) {
        const after = shiftState.after[item.id] ?? shiftState.before[item.id];
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

      document.getElementById("categoryContainer").style.display = "none";
      document.getElementById("inventoryContainer").style.display = "none";
      document.getElementById("sideActions").style.display = "none";
      document.getElementById("submitShiftBtn").style.display = "none";
      document.getElementById("shiftTitle").style.display = "none";

      const preview = document.getElementById("finalPreview");
      preview.style.display = "block";
      preview.innerHTML = `
        <h3>Shift Completed</h3>
        <p>Employee: ${employeeName}</p>
        <pre>${JSON.stringify(shiftState, null, 2)}</pre>
        <p>You did a great work! Don't forget to rest and say thank you!</p>
      `;
    }
  };

  loadInventory();
}
