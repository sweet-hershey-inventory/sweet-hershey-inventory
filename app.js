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

const path = window.location.pathname;

/* ================= LOGIN ================= */

if (path.includes("index")) {

  const toggle = document.getElementById("togglePassword");
  const password = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const errorText = document.getElementById("loginError");
  const pinSection = document.getElementById("pinSection");

  let tempRole = null;

  toggle.onclick = () => {
    password.type = password.type === "password" ? "text" : "password";
  };

  function clearError() {
    errorText.textContent = "";
  }

  document.getElementById("username").oninput = clearError;
  password.oninput = clearError;
  document.getElementById("pin").oninput = clearError;

  loginBtn.onclick = async () => {

    clearError();

    const username = document.getElementById("username").value;
    const pass = password.value;

    if (!tempRole) {
      if (username === "staff" && pass === "hershey123") {
        tempRole = "employee";
        pinSection.style.display = "block";
      } else if (username === "admin" && pass === "SWEEThershey2025") {
        tempRole = "admin";
        pinSection.style.display = "block";
      } else {
        errorText.textContent = "Invalid credentials";
      }
    } else {

      const pin = document.getElementById("pin").value;
      const snap = await getDocs(collection(db, "employees"));

      let foundUser = null;

      snap.forEach(d => {
        const data = d.data();
        if (data.pin === pin && data.role === tempRole) {
          foundUser = data;
        }
      });

      if (!foundUser) {
        errorText.textContent = "Invalid PIN";
        return;
      }

      sessionStorage.setItem("name", foundUser.name);
      sessionStorage.setItem("role", foundUser.role);
      sessionStorage.setItem("pin", foundUser.pin);

      if (foundUser.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "dashboard.html";
      }
    }
  };
}

/* ================= STAFF DASHBOARD ================= */

if (path.includes("dashboard")) {

  const role = sessionStorage.getItem("role");
  if (role !== "employee") window.location.href = "index.html";

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  };

  setInterval(() => {
    document.getElementById("liveClock").textContent =
      new Date().toLocaleString();
  }, 1000);

  let inventoryData = [];
  let categories = [];
  let selectedCategory = null;

  let stage = "before";

  let state = {
    before: {},
    after: {},
    added: [],
    wasted: []
  };

  async function loadInventory() {
    const snap = await getDocs(collection(db, "inventory"));
    inventoryData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(i => i.active === true);

    categories = [...new Set(inventoryData.map(i => i.category))];
    renderCategories();
    updateUI();
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
        renderItems();
      };
      container.appendChild(btn);
    });
  }

  function renderItems() {

    if (!selectedCategory) return;

    const container = document.getElementById("inventoryContainer");
    container.innerHTML = "";

    inventoryData
      .filter(i => i.category === selectedCategory)
      .forEach(item => {

        const card = document.createElement("div");
        card.className = "item-card";

        if (stage === "before") {
          const val = state.before[item.id] ?? item.stock;
          card.innerHTML = `
            <h4>${item.name}</h4>
            <input type="number" value="${val}">
          `;
          card.querySelector("input").oninput = e => {
            state.before[item.id] = Number(e.target.value);
          };
        }

        if (stage === "after") {
          const val = state.after[item.id] ?? "";
          card.innerHTML = `
            <h4>${item.name}</h4>
            <p>Before: ${state.before[item.id]}</p>
            <input type="number" value="${val}">
          `;
          card.querySelector("input").oninput = e => {
            state.after[item.id] = Number(e.target.value);
          };
        }

        container.appendChild(card);
      });
  }

  function updateUI() {

    const title = document.getElementById("shiftTitle");
    const btn = document.getElementById("mainActionBtn");
    const side = document.getElementById("sidePanel");

    if (stage === "before") {
      title.textContent = "Before Inventory Shift";
      btn.textContent = "Submit Before Shift";
      side.style.display = "none";
    }

    if (stage === "after") {
      title.textContent = "After Inventory Shift";
      btn.textContent = "Complete Shift";
      side.style.display = "block";
    }
  }

  document.getElementById("mainActionBtn").onclick = async () => {

    if (stage === "before") {
      stage = "after";
      updateUI();
      renderItems();
      return;
    }

    if (stage === "after") {

      for (let item of inventoryData) {
        const final =
          state.after[item.id] ?? state.before[item.id];

        await updateDoc(doc(db, "inventory", item.id), {
          stock: final
        });
      }

      await addDoc(collection(db, "shifts"), {
        employeeName: sessionStorage.getItem("name"),
        employeePin: sessionStorage.getItem("pin"),
        role: "employee",
        beforeInventory: state.before,
        afterInventory: state.after,
        addedStock: state.added,
        wastedItems: state.wasted,
        status: "completed",
        voidedBy: null,
        startTime: serverTimestamp(),
        endTime: serverTimestamp()
      });

      document.body.innerHTML =
        "<h2>Shift Completed Successfully</h2>";
    }
  };

  loadInventory();
}

/* ================= ADMIN DASHBOARD ================= */

if (path.includes("admin")) {

  const role = sessionStorage.getItem("role");
  if (role !== "admin") window.location.href = "index.html";

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  };

  const list = document.getElementById("shiftList");
  const details = document.getElementById("shiftDetails");

  const snap = await getDocs(
    query(collection(db, "shifts"), orderBy("endTime", "desc"))
  );

  snap.forEach(d => {

    const data = d.data();

    const btn = document.createElement("button");
    btn.textContent =
      data.employeeName + " - " + data.status;

    btn.onclick = () => {
      details.innerHTML = `
        <h3>${data.employeeName}</h3>
        <pre>${JSON.stringify(data, null, 2)}</pre>
        ${data.status === "completed"
          ? `<button onclick="voidShift('${d.id}')">VOID SHIFT</button>`
          : ""}
      `;
    };

    list.appendChild(btn);
  });

  window.voidShift = async (id) => {

    const shiftDoc = await getDocs(
      query(collection(db, "shifts"))
    );

    const shiftData =
      (await (await fetch())).data; // placeholder

    alert("Void system can be expanded further.");
  };
}
