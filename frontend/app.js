// Frontend and backend now run as separate apps on separate ports.
// Change this if your backend runs somewhere else.
const API_BASE = "https://url-short-d4o1.onrender.com";

// ---------- State ----------
function getToken() {
  return localStorage.getItem("token");
}
function setToken(t) {
  localStorage.setItem("token", t);
}
function clearToken() {
  localStorage.removeItem("token");
}
function getEmail() {
  return localStorage.getItem("email");
}
function setEmail(e) {
  localStorage.setItem("email", e);
}

function getSavedLinks() {
  return JSON.parse(localStorage.getItem("myLinks") || "[]");
}
function saveLink(link) {
  const links = getSavedLinks();
  links.unshift(link);
  localStorage.setItem("myLinks", JSON.stringify(links));
}

// ---------- Auth UI ----------
function renderAuthArea() {
  const el = document.getElementById("authArea");
  const token = getToken();
  if (token) {
    el.innerHTML = `Signed in as <strong>${getEmail() || "user"}</strong> <button id="logoutBtn">Log out</button>`;
    document.getElementById("logoutBtn").onclick = () => {
      clearToken();
      localStorage.removeItem("email");
      renderAuthArea();
      renderLinksList();
    };
  } else {
    el.innerHTML = `<span>Not signed in</span>`;
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "Form").classList.add("active");
  });
});

// ---------- Register ----------
document
  .getElementById("registerForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const resultEl = document.getElementById("authResult");

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setToken(data.token);
      setEmail(data.user.email);
      resultEl.textContent = "Account created — you're signed in.";
      resultEl.className = "result success";
      renderAuthArea();
    } catch (err) {
      resultEl.textContent = err.message;
      resultEl.className = "result error";
    }
  });

// ---------- Login ----------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const resultEl = document.getElementById("authResult");

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    setToken(data.token);
    setEmail(data.user.email);
    resultEl.textContent = "Signed in.";
    resultEl.className = "result success";
    renderAuthArea();
  } catch (err) {
    resultEl.textContent = err.message;
    resultEl.className = "result error";
  }
});

// ---------- Shorten ----------
document.getElementById("shortenForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const longUrl = document.getElementById("longUrlInput").value;
  const resultEl = document.getElementById("shortenResult");
  const token = getToken();

  try {
    const res = await fetch(`${API_BASE}/api/shorten`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ longUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to shorten URL");

    resultEl.innerHTML = `Short link: <a href="${data.shortUrl}" target="_blank">${data.shortUrl}</a>`;
    resultEl.className = "result success";

    if (token) {
      saveLink({
        shortCode: data.shortCode,
        shortUrl: data.shortUrl,
        longUrl: data.longUrl,
      });
      renderLinksList();
    }
    document.getElementById("longUrlInput").value = "";
  } catch (err) {
    resultEl.textContent = err.message;
    resultEl.className = "result error";
  }
});

// ---------- My Links ----------
function renderLinksList() {
  const list = document.getElementById("linksList");
  const links = getSavedLinks();

  if (!getToken()) {
    list.innerHTML = `<li class="hint">Log in to save links here and view analytics.</li>`;
    return;
  }
  if (links.length === 0) {
    list.innerHTML = `<li class="hint">No links yet — shorten one above.</li>`;
    return;
  }

  list.innerHTML = links
    .map(
      (l) => `
      <li>
        <a href="${l.shortUrl}" target="_blank">${l.shortCode}</a>
        <span class="long-url">${l.longUrl}</span>
        <button data-code="${l.shortCode}" class="viewAnalyticsBtn">Analytics</button>
      </li>`,
    )
    .join("");

  document.querySelectorAll(".viewAnalyticsBtn").forEach((btn) => {
    btn.addEventListener("click", () => loadAnalytics(btn.dataset.code));
  });
}

// ---------- Analytics ----------
async function loadAnalytics(code) {
  const card = document.getElementById("analyticsCard");
  const body = document.getElementById("analyticsBody");
  document.getElementById("analyticsCode").textContent = code;
  card.hidden = false;
  body.innerHTML = "Loading...";

  try {
    const res = await fetch(`${API_BASE}/api/analytics/${code}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load analytics");

    const rows = data.referrerBreakdown
      .map((r) => `<tr><td>${r._id}</td><td>${r.count}</td></tr>`)
      .join("");

    body.innerHTML = `
      <p><strong>Total clicks:</strong> ${data.totalClicks}</p>
      <p><strong>Created:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
      <table>
        <thead><tr><th>Referrer</th><th>Clicks</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="2">No clicks yet</td></tr>`}</tbody>
      </table>`;
  } catch (err) {
    body.innerHTML = `<p class="result error">${err.message}</p>`;
  }
}

// ---------- Init ----------
renderAuthArea();
renderLinksList();
