/* ==========================================================
   Metro Manila Jeepney Route-Based Fare System
   ========================================================== */

const FARE_CONFIG = {
  freeKm: 4,                    // Kilometers covered by the minimum fare
  roundUpExtraDistance: true,   // true = a partial km beyond the minimum counts as a full km
  jeepneys: {
    traditional: { label: "Traditional", minimumFare: 14, perKm: 2.0 },
    modern:      { label: "Modern",      minimumFare: 17, perKm: 2.3 }
  },
  discounts: { regular: 0, student: 0.20, senior: 0.20, pwd: 0.20 }  // 0.20 = 20%
};
const PASSENGER_LABELS = { regular: "Regular", student: "Student", senior: "Senior Citizen", pwd: "PWD" };
const KEYS = { routes: "pujRoutes", state: "pujState", transactions: "pujTransactions" };

const SAMPLE_ROUTES = [
  { id: "r1", name: "Pasig – Pateros – Taguig (Sample)", active: true, verified: false, stops: [
    { name: "Pasig Palengke", gap: 0 }, { name: "Pasig Rotonda", gap: 1.5 },
    { name: "Pateros Church", gap: 2.5 }, { name: "Pateros Municipal Hall", gap: 0.8 },
    { name: "Taguig Market", gap: 2.2 } ] },
  { id: "r2", name: "Makati – Taguig (Sample)", active: true, verified: false, stops: [
    { name: "Guadalupe Terminal", gap: 0 }, { name: "Rembo Market", gap: 2.0 },
    { name: "Fort Bonifacio Gate", gap: 2.5 }, { name: "Taguig Market", gap: 2.0 } ] },
  { id: "r3", name: "Pasig – Makati (Sample)", active: false, verified: false, stops: [
    { name: "Pasig Palengke", gap: 0 }, { name: "Kapitolyo", gap: 2.0 },
    { name: "Ortigas Center", gap: 2.2 }, { name: "Guadalupe Terminal", gap: 4.0 } ] }
];

/* ---------- 3. HELPERS AND LOCALSTORAGE ---------- */
const $ = id => document.getElementById(id);
const round2 = n => Math.round(n * 100) / 100;
const peso = n => "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Makes user-typed text safe to place inside HTML (including attribute values)
function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/"/g, "&quot;");
}

// Reads saved data. Returns the fallback if nothing is saved or the data is broken.
function load(key, fallback) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return data === null ? fallback : data;
  } catch (error) {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage unavailable */ }
}

// Routes and driver settings (loaded once, saved after every change)
let routes = load(KEYS.routes, null);
if (!Array.isArray(routes) || routes.length === 0 || !routes.every(r => r && Array.isArray(r.stops))) {
  routes = JSON.parse(JSON.stringify(SAMPLE_ROUTES));
}
let state = load(KEYS.state, null);
if (!state || typeof state !== "object") state = { myRouteId: "r1", jeepType: "traditional" };
if (!FARE_CONFIG.jeepneys[state.jeepType]) state.jeepType = "traditional";
let selectedRouteId = routes.some(r => r.id === state.myRouteId) ? state.myRouteId : routes[0].id;

const saveRoutes = () => save(KEYS.routes, routes);
const saveState = () => save(KEYS.state, state);
const loadTransactions = () => { const d = load(KEYS.transactions, []); return Array.isArray(d) ? d : []; };
const findRoute = id => routes.find(r => r.id === id);
const currentRoute = () => findRoute(selectedRouteId);

// Total km from the first stop to each stop, e.g. [0, 1.5, 4, 4.8, 7]
function cumulative(route) {
  let total = 0;
  return route.stops.map((stop, i) => {
    if (i > 0) total += Number(stop.gap) || 0;
    return total;
  });
}

function showMsg(id, text, type) {
  const box = $(id);
  box.textContent = text;
  box.className = "msg " + type;
}
const hideMsg = id => { $(id).className = "msg hidden"; };

/* ---------- 4. NAVIGATION ---------- */
function showSection(id) {
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === id));
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.target === id));
  $("navLinks").classList.remove("open");
  if (id === "calculator") refreshCalculator(true);
  if (id === "driver") renderDriver();
  window.scrollTo(0, 0);
}

/* ---------- 5. DRIVER DASHBOARD ---------- */
function renderDriver() {
  const route = currentRoute();
  const stops = route.stops;
  const cum = cumulative(route);

  $("routeSelect").innerHTML = routes.map(r => `<option value="${escapeHTML(r.id)}">${escapeHTML(r.name)}</option>`).join("");
  $("routeSelect").value = route.id;
  $("jeepType").value = state.jeepType;

  const first = stops.length ? stops[0].name : "(no stops yet)";
  const last = stops.length ? stops[stops.length - 1].name : "(no stops yet)";
  $("routeInfo").innerHTML =
    `<p><strong>Starting terminal:</strong> ${escapeHTML(first)}</p>` +
    `<p><strong>Ending terminal:</strong> ${escapeHTML(last)}</p>` +
    `<p><strong>Total route distance:</strong> ${stops.length ? cum[cum.length - 1].toFixed(1) : 0} km (${stops.length} stops)</p>` +
    `<p><span class="badge ${route.active ? "on" : "off"}">${route.active ? "Active" : "Inactive"}</span>` +
    (state.myRouteId === route.id ? '<span class="badge mine">My jeepney route</span>' : "") +
    (route.verified ? "" : '<span class="badge warn">Unverified sample data</span>') + "</p>";
  $("toggleBtn").textContent = route.active ? "Deactivate route" : "Activate route";

  $("stopsBody").innerHTML = stops.length === 0
    ? '<tr><td colspan="4">No stops yet. Add the first stop below.</td></tr>'
    : stops.map((s, i) =>
      `<tr><td>${i + 1}</td>` +
      `<td><input type="text" maxlength="40" data-i="${i}" data-f="name" value="${escapeHTML(s.name)}"></td>` +
      `<td><input type="number" step="0.1" min="0" data-i="${i}" data-f="gap" value="${i === 0 ? 0 : s.gap}" ${i === 0 ? "disabled" : ""}></td>` +
      `<td class="acts"><button class="mini" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>↑</button>` +
      `<button class="mini" data-act="down" data-i="${i}" ${i === stops.length - 1 ? "disabled" : ""}>↓</button>` +
      `<button class="mini danger" data-act="del" data-i="${i}">✕</button></td></tr>`
    ).join("");
}

// Saves route changes and refreshes every screen that uses routes
function routesChanged() {
  saveRoutes();
  renderDriver();
  updateDashboard();
  refreshCalculator(false);
}

// Edit a stop name or distance (saved as soon as the box loses focus)
function handleStopEdit(event) {
  const input = event.target;
  const stop = currentRoute().stops[Number(input.dataset.i)];
  if (!stop) return;
  if (input.dataset.f === "name") {
    if (input.value.trim() === "") showMsg("driverMsg", "A stop name cannot be empty.", "error");
    else { stop.name = input.value.trim(); showMsg("driverMsg", "Stop saved.", "success"); }
  } else {
    const gap = Number(input.value);
    if (input.value === "" || isNaN(gap) || gap < 0) showMsg("driverMsg", "Distance must be 0 km or more.", "error");
    else { stop.gap = gap; showMsg("driverMsg", "Stop saved.", "success"); }
  }
  routesChanged(); // redraws the table, which also restores any invalid value
}

// Move a stop up or down, or remove it
function handleStopButton(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const route = currentRoute();
  const stops = route.stops;
  const i = Number(button.dataset.i);
  if (button.dataset.act === "up") [stops[i - 1], stops[i]] = [stops[i], stops[i - 1]];
  if (button.dataset.act === "down") [stops[i], stops[i + 1]] = [stops[i + 1], stops[i]];
  if (button.dataset.act === "del") {
    if (!confirm("Remove the stop " + stops[i].name + "?")) return;
    stops.splice(i, 1);
    if (stops.length < 2) route.active = false; // a route needs at least 2 stops
  }
  showMsg("driverMsg", "Route updated.", "success");
  routesChanged();
}

function handleAddStop(event) {
  event.preventDefault();
  const route = currentRoute();
  const name = $("newStopName").value.trim();
  const gapText = $("newStopGap").value.trim();
  const gap = route.stops.length === 0 ? 0 : Number(gapText);
  if (name === "") return showMsg("driverMsg", "Enter a name for the new stop.", "error");
  if (route.stops.length > 0 && (gapText === "" || isNaN(gap) || gap < 0)) {
    return showMsg("driverMsg", "Enter the km from the previous stop (0 or more).", "error");
  }
  route.stops.push({ name: name, gap: gap });
  $("addStopForm").reset();
  showMsg("driverMsg", name + " was added at the end of the route.", "success");
  routesChanged();
}

// The driver sets the route once; passengers then use it automatically
function handleSetMyRoute() {
  const route = currentRoute();
  if (route.stops.length < 2) return showMsg("driverMsg", "Add at least 2 stops before using this route.", "error");
  route.active = true;
  state.myRouteId = route.id;
  saveState();
  routesChanged();
  showMsg("driverMsg", route.name + " is now your active route. Passengers will use it automatically.", "success");
}

function handleToggleRoute() {
  const route = currentRoute();
  if (!route.active && route.stops.length < 2) return showMsg("driverMsg", "Add at least 2 stops before activating this route.", "error");
  route.active = !route.active;
  routesChanged();
  showMsg("driverMsg", route.name + (route.active ? " is now active." : " is now inactive and hidden from passengers."), "success");
}

/* ---------- 6. PASSENGER FARE CALCULATOR ---------- */
// Routes passengers can use: active and with at least 2 stops
const availableRoutes = () => routes.filter(r => r.active && r.stops.length >= 2);

// Fills the route list. If preferMine is true, the driver's active route is selected.
function refreshCalculator(preferMine) {
  const list = availableRoutes();
  const select = $("routeChoice");
  const previous = select.value;
  select.innerHTML = list.length
    ? list.map(r => `<option value="${escapeHTML(r.id)}">${escapeHTML(r.name)}</option>`).join("")
    : '<option value="">No route available</option>';
  if (list.length) {
    const mine = list.some(r => r.id === state.myRouteId);
    const keep = list.some(r => r.id === previous);
    select.value = (preferMine && mine) ? state.myRouteId : (keep ? previous : (mine ? state.myRouteId : list[0].id));
  }
  fillBoarding();
}

// Boarding can be any stop except the last one
function fillBoarding() {
  const route = findRoute($("routeChoice").value);
  $("board").innerHTML = '<option value="">Select boarding location</option>' +
    (route ? route.stops.slice(0, -1).map((s, i) => `<option value="${i}">${escapeHTML(s.name)}</option>`).join("") : "");
  fillDrop();
}

// Drop-off can only be a stop AFTER the boarding stop
function fillDrop() {
  const route = findRoute($("routeChoice").value);
  const boardIndex = $("board").value === "" ? -1 : Number($("board").value);
  $("drop").innerHTML = '<option value="">Select drop-off location</option>' +
    (route && boardIndex >= 0
      ? route.stops.map((s, i) => i > boardIndex ? `<option value="${i}">${escapeHTML(s.name)}</option>` : "").join("")
      : "");
  updateInfo();
}

// Short helper text under the dropdowns
function updateInfo() {
  const route = findRoute($("routeChoice").value);
  const info = $("distanceInfo");
  if (!route) { info.textContent = "No jeepney route is active right now. Ask the driver to activate a route."; return; }
  const type = FARE_CONFIG.jeepneys[state.jeepType].label;
  const last = route.stops.length - 1;
  if ($("board").value !== "" && $("drop").value !== "") {
    const cum = cumulative(route);
    info.textContent = "Estimated ride: " + round2(cum[Number($("drop").value)] - cum[Number($("board").value)]) + " km on a " + type + " jeepney";
  } else {
    info.textContent = route.stops[0].name + " → " + route.stops[last].name + " (" + type + " jeepney)";
  }
}

// Computes every part of the fare for one ride
function calculateFare(km, jeepType, passType) {
  const rate = FARE_CONFIG.jeepneys[jeepType];
  let extraKm = Math.max(0, km - FARE_CONFIG.freeKm);
  if (FARE_CONFIG.roundUpExtraDistance) extraKm = Math.ceil(extraKm);
  const base = rate.minimumFare;
  const extra = round2(extraKm * rate.perKm);
  const subtotal = round2(base + extra);
  const discount = round2(subtotal * FARE_CONFIG.discounts[passType]);
  return { extraKm, base, extra, subtotal, discount, total: round2(subtotal - discount) };
}

function makeTransactionNumber(date, count) {
  const pad = n => String(n).padStart(2, "0");
  return "JF-" + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "-" + String(count).padStart(4, "0");
}

function handleCalculate() {
  const route = findRoute($("routeChoice").value);
  const boardText = $("board").value;
  const dropText = $("drop").value;
  const passType = $("passType").value;
  const fail = text => { showMsg("formMsg", text, "error"); $("breakdown").classList.add("hidden"); };

  if (!route) return fail("No jeepney route is active right now. Ask the driver to activate a route.");
  if (boardText === "" || dropText === "") return fail("Choose both your boarding and drop-off locations.");
  const boardIndex = Number(boardText);
  const dropIndex = Number(dropText);
  if (dropIndex <= boardIndex) return fail("Your drop-off must come after your boarding location on this route.");

  const cum = cumulative(route);
  const km = round2(cum[dropIndex] - cum[boardIndex]);
  if (km <= 0) return fail("These stops have no distance between them. Ask the driver to update the stop distances.");

  const list = loadTransactions();
  const now = new Date();
  const tx = Object.assign({
    id: makeTransactionNumber(now, list.length + 1),
    dateTime: now.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
    routeName: route.name,
    board: route.stops[boardIndex].name,
    drop: route.stops[dropIndex].name,
    km: km,
    jeepType: state.jeepType,
    passType: passType,
    passLabel: PASSENGER_LABELS[passType]
  }, calculateFare(km, state.jeepType, passType));

  list.push(tx);
  save(KEYS.transactions, list);
  updateDashboard();
  renderHistory();
  renderReceipt(tx);
  renderBreakdown(tx);
  showMsg("formMsg", "Fare calculated. Your receipt is ready.", "success");
}

function clearForm() {
  $("fareForm").reset();
  hideMsg("formMsg");
  $("breakdown").classList.add("hidden");
  refreshCalculator(true);
}

/* ---------- 7. BREAKDOWN, RECEIPT, HISTORY, DASHBOARD ---------- */
function rowHTML(label, value, extraClass) {
  return `<div class="row ${extraClass || ""}"><span>${escapeHTML(label)}</span><span>${escapeHTML(value)}</span></div>`;
}

function renderBreakdown(tx) {
  const rate = FARE_CONFIG.jeepneys[tx.jeepType];
  $("breakdownRows").innerHTML =
    rowHTML("Estimated ride", tx.km + " km") +
    rowHTML("Minimum fare (first " + FARE_CONFIG.freeKm + " km)", peso(tx.base)) +
    rowHTML("Additional: " + tx.extraKm + " km × " + peso(rate.perKm), peso(tx.extra)) +
    rowHTML("Base fare", peso(tx.subtotal)) +
    rowHTML("Discount (" + FARE_CONFIG.discounts[tx.passType] * 100 + "% " + tx.passLabel + ")", "−" + peso(tx.discount)) +
    rowHTML("Final fare", peso(tx.total), "total");
  $("breakdown").classList.remove("hidden");
}

function renderReceipt(tx) {
  const box = $("receiptBox");
  if (!tx) {
    box.innerHTML = '<p class="empty">No receipt yet. Calculate a fare to create one.</p>';
    $("printBtn").disabled = true;
    return;
  }
  $("printBtn").disabled = false;
  box.innerHTML =
    '<div class="receipt"><div class="receipt-head"><svg viewBox="0 0 120 60"><use href="#jeep"/></svg>' +
    "<h3>Jeepney Fare Receipt</h3><p>Metro Manila</p></div>" +
    rowHTML("Transaction No.", tx.id) +
    rowHTML("Date and time", tx.dateTime) +
    rowHTML("Jeepney route", tx.routeName) +
    rowHTML("Boarding location", tx.board) +
    rowHTML("Drop-off location", tx.drop) +
    rowHTML("Passenger category", tx.passLabel) +
    rowHTML("Estimated distance", tx.km + " km") +
    rowHTML("Base fare", peso(tx.subtotal)) +
    rowHTML("Discount", "−" + peso(tx.discount)) +
    rowHTML("Final fare", peso(tx.total), "total") +
    '<p class="receipt-foot">Estimated fare from sample route data. Not an official receipt.</p></div>';
}

function renderHistory() {
  const list = loadTransactions().slice().reverse();
  $("historyEmpty").classList.toggle("hidden", list.length > 0);
  $("historyBody").innerHTML = list.map(tx =>
    `<tr><td>${escapeHTML(tx.id)}</td><td>${escapeHTML(tx.routeName)}</td>` +
    `<td>${escapeHTML(tx.board)} → ${escapeHTML(tx.drop)}</td><td>${escapeHTML(tx.passLabel)}</td>` +
    `<td><strong>${peso(tx.total)}</strong></td></tr>`
  ).join("");
}

function updateDashboard() {
  const list = loadTransactions();
  const sum = list.reduce((total, tx) => total + tx.total, 0);
  const mine = findRoute(state.myRouteId);
  $("statCount").textContent = list.length;
  $("statTotal").textContent = peso(round2(sum));
  $("statRoute").textContent = mine && mine.active ? mine.name : "None";
}

function clearHistory() {
  if (!confirm("Delete all saved transactions? This cannot be undone.")) return;
  try { localStorage.removeItem(KEYS.transactions); } catch (error) { /* ignore */ }
  updateDashboard();
  renderHistory();
  renderReceipt(null);
  $("breakdown").classList.add("hidden");
}

/* ---------- 8. START THE APP ---------- */
function init() {
  const t = FARE_CONFIG.jeepneys.traditional;
  const m = FARE_CONFIG.jeepneys.modern;
  $("rateNote").textContent =
    "Traditional: " + peso(t.minimumFare) + " for the first " + FARE_CONFIG.freeKm + " km, then " + peso(t.perKm) + " per km. " +
    "Modern: " + peso(m.minimumFare) + " for the first " + FARE_CONFIG.freeKm + " km, then " + peso(m.perKm) + " per km. " +
    "Students, senior citizens, and PWD get 20% off. Route data is unverified sample data, and distances are estimates.";

  document.querySelectorAll("[data-target]").forEach(el => el.addEventListener("click", () => showSection(el.dataset.target)));
  $("menuBtn").addEventListener("click", () => $("navLinks").classList.toggle("open"));

  // Driver dashboard
  $("routeSelect").addEventListener("change", () => { selectedRouteId = $("routeSelect").value; hideMsg("driverMsg"); renderDriver(); });
  $("jeepType").addEventListener("change", () => {
    state.jeepType = $("jeepType").value;
    saveState();
    updateInfo();
    showMsg("driverMsg", "Jeepney type set to " + FARE_CONFIG.jeepneys[state.jeepType].label + ".", "success");
  });
  $("stopsBody").addEventListener("change", handleStopEdit);
  $("stopsBody").addEventListener("click", handleStopButton);
  $("addStopForm").addEventListener("submit", handleAddStop);
  $("setMyRouteBtn").addEventListener("click", handleSetMyRoute);
  $("toggleBtn").addEventListener("click", handleToggleRoute);

  // Passenger calculator, receipt, history
  $("routeChoice").addEventListener("change", fillBoarding);
  $("board").addEventListener("change", fillDrop);
  $("drop").addEventListener("change", updateInfo);
  $("fareForm").addEventListener("submit", event => { event.preventDefault(); handleCalculate(); });
  $("clearBtn").addEventListener("click", clearForm);
  $("printBtn").addEventListener("click", () => window.print());
  $("clearHistoryBtn").addEventListener("click", clearHistory);

  const saved = loadTransactions();
  updateDashboard();
  renderHistory();
  renderReceipt(saved.length ? saved[saved.length - 1] : null);
  renderDriver();
  refreshCalculator(true);
  showSection("home");
}

init();
