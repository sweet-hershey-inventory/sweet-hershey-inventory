import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy, limit, addDoc, doc, getDoc, updateDoc, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let systemRole = null;
let selectedCategory = null;

// LOGIN FORM
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

      // STRICT ROLE CHECK
      if (systemRole === "staff" && data.role !== "employee") {
        error.innerText = "Staff cannot access admin PIN";
        return;
      }

      if (systemRole === "admin" && data.role !== "admin") {
        error.innerText = "Admin login required for this PIN";
        return;
      }

      localStorage.setItem("employeeName", data.name);
      localStorage.setItem("role", data.role);
      window.location.href = "dashboard.html";
    }
  });
});

// DASHBOARD LOAD
window.onload = async function() {
  if (!window.location.pathname.includes("dashboard")) return;

  const name = localStorage.getItem("employeeName");
  const role = localStorage.getItem("role");

  employeeName.innerText = name;

  if (role === "admin") {
    adminSection.style.display = "block";
  }

  loadCategories();
  loadLastDuty();
};

// LOAD CATEGORIES
async function loadCategories() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const categories = new Set();

  snapshot.forEach(doc => {
    categories.add(doc.data().category);
  });

  categories.forEach(cat => {
    categoriesDiv.innerHTML += `
      <div class="categoryBtn" onclick="selectCategory('${cat}')">
        ${cat.toUpperCase()}
      </div>
    `;
  });
}

window.selectCategory = async function(cat) {
  selectedCategory = cat;
  itemsSection.style.display = "block";
  selectedCategoryTitle.innerText = cat.toUpperCase();
  itemsList.innerHTML = "";

  const snapshot = await getDocs(collection(db, "inventory"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.category === cat) {
      itemsList.innerHTML += `
        <div class="itemCard">
          ${data.name}
          <input type="number" id="item_${docSnap.id}" value="${data.stock}">
        </div>
      `;
    }
  });
};

// SAVE SHIFT
window.saveShift = async function() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const employee = localStorage.getItem("employeeName");

  let shiftData = {};

  snapshot.forEach(docSnap => {
    if (docSnap.data().category === selectedCategory) {
      const val = document.getElementById("item_" + docSnap.id).value;
      shiftData[docSnap.id] = Number(val);
    }
  });

  await addDoc(collection(db, "shifts"), {
    employee,
    category: selectedCategory,
    data: shiftData,
    timestamp: serverTimestamp()
  });

  alert("Inventory saved!");
};

// LAST DUTY
async function loadLastDuty() {
  const q = query(collection(db, "shifts"), orderBy("timestamp", "desc"), limit(1));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    lastDuty.innerText = "Last Duty: " + docSnap.data().employee;
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
