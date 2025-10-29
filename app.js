const FEATURE_PACKAGES = true;
const AUTO_JUMP_NEXT_AVAILABLE = true;
const AUTO_JUMP_LOOKAHEAD = 6;
const DEBUG = false;

const BRAND_COLOR = "#f97316";

const state = {
  locations: [],
  locationId: null,
  currentMonth: startOfMonth(new Date()),
  selectedDateIso: null,
  status: "Pick a location to get started.",
  loading: false,
  autoJumpMessage: "",
  packagesConfig: {},
};

const monthCache = new Map();
let activeController = null;
let autoJumpInFlight = false;

const refs = {};

injectStyles();
bootstrap();

async function bootstrap() {
  buildLayout();
  await loadPackagesConfig();
  await loadLocations();
  updatePackageStepState();
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      margin: 0;
      background: #f6f7fb;
      color: #1f2937;
    }

    .app-shell {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .app-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .top-row {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .top-row .location-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .location-select {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #d1d5db;
      min-width: 200px;
      font-size: 15px;
    }

    .status-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 14px;
      color: #4b5563;
      align-items: center;
    }

    .status-chip {
      background: rgba(249, 115, 22, 0.12);
      color: ${BRAND_COLOR};
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 600;
      display: none;
    }

    .status-chip.is-visible {
      display: inline-flex;
    }

    .steps-header {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      font-weight: 600;
      font-size: 16px;
    }

    .step-pill {
      position: relative;
      padding-bottom: 6px;
    }

    .step-pill.is-active::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: ${BRAND_COLOR};
      border-radius: 999px;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
    }

    @media (min-width: 980px) {
      .layout {
        grid-template-columns: 60% 40%;
      }

      .steps-header {
        font-size: 18px;
      }
    }

    .panel {
      background: #fff;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }

    .calendar-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
    }

    .calendar-nav button {
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .calendar-nav button:hover:not(:disabled) {
      background: ${BRAND_COLOR};
      color: #fff;
      border-color: ${BRAND_COLOR};
    }

    .calendar-nav button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .calendar-title {
      font-weight: 700;
      font-size: 18px;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }

    .calendar-grid .weekday {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.1em;
      color: #9ca3af;
      text-align: center;
    }

    .day-cell {
      position: relative;
      border-radius: 12px;
      padding: 12px 8px 16px;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      min-height: 82px;
      transition: border 0.2s, transform 0.2s, box-shadow 0.2s;
    }

    .day-cell:hover:not(.is-disabled) {
      border-color: ${BRAND_COLOR};
      box-shadow: 0 6px 20px rgba(249, 115, 22, 0.15);
      transform: translateY(-1px);
    }

    .day-cell.is-today {
      border-color: ${BRAND_COLOR};
    }

    .day-cell.is-selected {
      background: ${BRAND_COLOR};
      border-color: ${BRAND_COLOR};
      color: #fff;
      box-shadow: 0 10px 24px rgba(249, 115, 22, 0.35);
    }

    .day-cell.is-past {
      opacity: 0.5;
      pointer-events: none;
    }

    .day-cell.is-empty {
      color: #9ca3af;
    }

    .day-number {
      font-size: 16px;
      font-weight: 600;
    }

    .slot-count {
      font-size: 12px;
      font-weight: 700;
      color: #047857;
      background: rgba(16, 185, 129, 0.12);
      padding: 2px 8px;
      border-radius: 999px;
    }

    .day-cell.is-selected .slot-count {
      background: rgba(255, 255, 255, 0.25);
      color: #fff;
    }

    .timeslots {
      margin-top: 20px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .timeslots h3 {
      margin: 0;
      font-size: 16px;
    }

    .timeslots .slots-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .slot-pill {
      padding: 8px 14px;
      border-radius: 999px;
      background: #111827;
      color: #fff;
      font-size: 13px;
    }

    .packages-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .packages-panel h2 {
      margin: 0;
      font-size: 20px;
    }

    .packages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .package-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #fff7ed;
      border: 1px solid rgba(249, 115, 22, 0.45);
      border-radius: 14px;
      padding: 14px 16px;
      text-decoration: none;
      color: #9a3412;
      font-weight: 600;
      text-align: center;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .package-button:hover {
      background: ${BRAND_COLOR};
      color: #fff;
      box-shadow: 0 10px 24px rgba(249, 115, 22, 0.25);
      transform: translateY(-1px);
    }

    .packages-note {
      font-size: 14px;
      color: #6b7280;
    }

    .empty-state {
      font-size: 14px;
      color: #6b7280;
    }
  `;
  document.head.appendChild(style);
}

function buildLayout() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="top-row">
          <div class="location-group">
            <label for="location-select"><strong>Location</strong></label>
            <select id="location-select" class="location-select" aria-label="Select a location"></select>
          </div>
          <div class="status-bar">
            <span class="status-label">Status:</span>
            <span class="status-text">${state.status}</span>
            <span class="status-chip" aria-live="polite"></span>
          </div>
        </div>
        <div class="steps-header">
          <span class="step-pill step1 is-active">Step 1: Check availability</span>
          <span aria-hidden="true">→</span>
          <span class="step-pill step2">Step 2: Choose a package</span>
        </div>
      </header>
      <div class="layout">
        <section class="panel calendar-panel">
          <div class="calendar-nav">
            <button type="button" class="btn-prev">Previous</button>
            <span class="calendar-title"></span>
            <button type="button" class="btn-next">Next</button>
          </div>
          <div class="calendar-grid"></div>
          <div class="timeslots" hidden>
            <h3>Available times</h3>
            <div class="slots-list"></div>
          </div>
        </section>
        <section class="panel packages-panel" hidden>
          <div>
            <h2>Step 2 — Choose your package</h2>
            <p class="packages-note" hidden></p>
          </div>
          <div class="packages-grid"></div>
          <p class="empty-state" hidden>Packages coming soon.</p>
        </section>
      </div>
    </div>
  `;

  refs.locationSelect = app.querySelector("#location-select");
  refs.statusText = app.querySelector(".status-text");
  refs.statusChip = app.querySelector(".status-chip");
  refs.calendarTitle = app.querySelector(".calendar-title");
  refs.prevBtn = app.querySelector(".btn-prev");
  refs.nextBtn = app.querySelector(".btn-next");
  refs.calendarGrid = app.querySelector(".calendar-grid");
  refs.timeslots = app.querySelector(".timeslots");
  refs.slotsList = app.querySelector(".slots-list");
  refs.packagesPanel = app.querySelector(".packages-panel");
  refs.packagesGrid = app.querySelector(".packages-grid");
  refs.packagesNote = app.querySelector(".packages-note");
  refs.packagesEmpty = app.querySelector(".empty-state");
  refs.step1 = app.querySelector(".steps-header .step1");
  refs.step2 = app.querySelector(".steps-header .step2");

  refs.locationSelect.addEventListener("change", () => {
    const value = refs.locationSelect.value;
    if (!value) {
      state.locationId = null;
      state.status = "Pick a location to get started.";
      state.selectedDateIso = null;
      state.autoJumpMessage = "";
      updateStatus();
      renderPackages();
      renderCalendar();
      refreshStepHighlights();
      return;
    }

    state.locationId = value;
    state.currentMonth = startOfMonth(new Date());
    state.selectedDateIso = null;
    state.autoJumpMessage = "";
    setStatus(`Loading availability for ${getLocationName(value)}…`);
    loadCurrentMonth();
    renderPackages();
    updatePackageStepState();
    refreshStepHighlights();
  });

  refs.prevBtn.addEventListener("click", () => changeMonth(-1));
  refs.nextBtn.addEventListener("click", () => changeMonth(1));

  renderCalendar();
}

async function loadPackagesConfig() {
  try {
    const response = await fetch("./packages.config.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load packages config (${response.status})`);
    }
    state.packagesConfig = await response.json();
  } catch (error) {
    if (DEBUG) {
      console.error("packages.config.json load failed", error);
    }
    state.packagesConfig = {};
  }
}

async function loadLocations() {
  try {
    const response = await fetch("/api/locations");
    if (!response.ok) {
      throw new Error(`Unable to load locations (${response.status})`);
    }
    const payload = await response.json();
    state.locations = normaliseLocations(payload);
  } catch (error) {
    if (DEBUG) {
      console.warn("Falling back to packages-based locations", error);
    }
    state.locations = Object.keys(state.packagesConfig || {}).map((key) => ({
      id: key,
      name: titleCase(key),
    }));
  }

  renderLocationSelect();
  refreshStepHighlights();
}

function normaliseLocations(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) =>
      typeof item === "string"
        ? { id: item, name: titleCase(item) }
        : { id: item.id || item.key || item.slug, name: item.name || titleCase(item.id || item.key || item.slug || "") }
    ).filter((item) => item.id);
  }

  if (Array.isArray(payload.locations)) {
    return normaliseLocations(payload.locations);
  }

  return [];
}

function renderLocationSelect() {
  const options = ["<option value=\"\">Select a location</option>"];
  state.locations.forEach((loc) => {
    options.push(`<option value="${loc.id}">${loc.name}</option>`);
  });
  refs.locationSelect.innerHTML = options.join("");
}

function setStatus(message) {
  state.status = message;
  updateStatus();
}

function updateStatus() {
  refs.statusText.textContent = state.status;
  if (state.autoJumpMessage) {
    refs.statusChip.textContent = state.autoJumpMessage;
    refs.statusChip.classList.add("is-visible");
  } else {
    refs.statusChip.textContent = "";
    refs.statusChip.classList.remove("is-visible");
  }
}

function changeMonth(offset) {
  if (!state.locationId) return;
  const newDate = startOfMonth(new Date(state.currentMonth));
  newDate.setMonth(newDate.getMonth() + offset);
  state.currentMonth = newDate;
  state.selectedDateIso = null;
  setStatus(`Loading availability for ${getLocationName(state.locationId)}…`);
  loadCurrentMonth();
  refreshStepHighlights();
}

async function loadCurrentMonth() {
  if (!state.locationId) return;

  state.loading = true;
  renderLoadingState();

  const key = cacheKey(state.locationId, state.currentMonth);
  let monthData = monthCache.get(key);

  try {
    if (!monthData) {
      monthData = await fetchMonthData(state.locationId, state.currentMonth, { prefetch: false });
    }
  } catch (error) {
    if (DEBUG) {
      console.error("Availability fetch failed", error);
    }
    monthData = { days: [], fetchedAt: Date.now() };
  }

  monthCache.set(key, monthData);

  state.loading = false;
  state.status = `Showing availability for ${getLocationName(state.locationId)}.`;
  updateStatus();
  renderCalendar(monthData);
  prefetchAdjacentMonths();
  updateTimeslots();
  updatePackageStepState();

  if (AUTO_JUMP_NEXT_AVAILABLE) {
    handleAutoJumpIfNeeded(monthData);
  }

  refreshStepHighlights();
}

function renderLoadingState() {
  const shouldDisableNav = state.loading || !state.locationId;
  refs.calendarGrid.classList.toggle("is-loading", Boolean(state.loading));
  refs.prevBtn.disabled = shouldDisableNav;
  refs.nextBtn.disabled = shouldDisableNav;
}

async function fetchMonthData(locationId, monthDate, { prefetch } = {}) {
  const key = cacheKey(locationId, monthDate);
  if (monthCache.has(key)) {
    return monthCache.get(key);
  }

  const url = new URL("/api/availability", window.location.origin);
  url.searchParams.set("location", locationId);
  url.searchParams.set("year", monthDate.getFullYear());
  url.searchParams.set("month", monthDate.getMonth() + 1);

  const controller = new AbortController();
  const signal = controller.signal;

  if (!prefetch) {
    if (activeController) {
      activeController.abort();
    }
    activeController = controller;
  }

  let payload = null;

  try {
    const response = await fetch(url.toString(), { signal });
    if (!response.ok) {
      throw new Error(`Availability request failed (${response.status})`);
    }
    payload = await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    if (DEBUG) {
      console.error("Availability fetch error", error);
    }
    payload = { days: [] };
  } finally {
    if (!prefetch && activeController === controller) {
      activeController = null;
    }
  }

  const normalised = normaliseAvailability(payload, monthDate);
  const data = { days: normalised, fetchedAt: Date.now() };
  monthCache.set(key, data);
  return data;
}

function normaliseAvailability(payload, monthDate) {
  const sourceDays = extractDaysArray(payload);
  const dayMap = new Map();
  sourceDays.forEach((entry) => {
    const parsed = parseAvailabilityEntry(entry);
    if (!parsed) return;
    dayMap.set(parsed.iso, parsed);
  });

  const daysInMonth = getDaysInMonth(monthDate);
  const result = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = buildIso(monthDate.getFullYear(), monthDate.getMonth(), day);
    if (dayMap.has(iso)) {
      result.push(dayMap.get(iso));
    } else {
      result.push({
        iso,
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
        count: 0,
        slots: [],
      });
    }
  }
  return result;
}

function extractDaysArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.days)) return payload.days;
  if (Array.isArray(payload.dates)) return payload.dates;
  if (Array.isArray(payload.availability)) return payload.availability;
  if (payload.calendar && Array.isArray(payload.calendar.days)) return payload.calendar.days;
  return [];
}

function parseAvailabilityEntry(entry) {
  if (!entry) return null;
  const dateValue = entry.date || entry.day || entry.iso || entry.dateISO;
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const iso = dateValue.slice(0, 10);
  const slots = Array.isArray(entry.slots)
    ? entry.slots
    : Array.isArray(entry.times)
    ? entry.times
    : Array.isArray(entry.availability)
    ? entry.availability
    : [];
  const count =
    typeof entry.count === "number"
      ? entry.count
      : typeof entry.total === "number"
      ? entry.total
      : typeof entry.available === "number"
      ? entry.available
      : slots.length;
  return {
    iso,
    date,
    count,
    slots,
  };
}

function renderCalendar(monthData = null) {
  const monthName = state.currentMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  refs.calendarTitle.textContent = monthName;

  const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((day) => `<div class="weekday">${day}</div>`)
    .join("");

  if (!state.locationId) {
    refs.calendarGrid.innerHTML =
      weekdayHeaders +
      '<div class="empty-state" style="grid-column: span 7; text-align: center; padding: 24px;">Select a location to view availability.</div>';
    renderLoadingState();
    return;
  }

  const data = monthData || monthCache.get(cacheKey(state.locationId, state.currentMonth)) || { days: [] };
  const firstDayOfWeek = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth(), 1).getDay();
  const leading = Array.from({ length: firstDayOfWeek })
    .map(() => `<div></div>`)
    .join("");

  const todayIso = buildIsoDate(new Date());

  const daysHtml = (data.days || [])
    .map((item) => {
      const classes = ["day-cell"];
      if (item.iso === todayIso) classes.push("is-today");
      if (state.selectedDateIso === item.iso) classes.push("is-selected");
      if (isPastDate(item.iso)) classes.push("is-past", "is-disabled");
      if ((item.count || 0) === 0) classes.push("is-empty");
      const slotHtml = item.count > 0 ? `<span class="slot-count">×${item.count}</span>` : "";
      return `<button type="button" class="${classes.join(" ")}" data-iso="${item.iso}">
        <span class="day-number">${Number(item.iso.slice(-2))}</span>
        ${slotHtml}
      </button>`;
    })
    .join("");

  const totalCells = firstDayOfWeek + (data.days || []).length;
  const trailingCount = (7 - (totalCells % 7)) % 7;
  const trailing = Array.from({ length: trailingCount })
    .map(() => `<div></div>`)
    .join("");

  refs.calendarGrid.innerHTML = weekdayHeaders + leading + daysHtml + trailing;

  refs.calendarGrid.querySelectorAll(".day-cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const iso = btn.getAttribute("data-iso");
      state.selectedDateIso = iso;
      renderCalendar();
      updateTimeslots();
      refreshStepHighlights();
    });
  });

  renderLoadingState();
}

function updateTimeslots() {
  if (!state.selectedDateIso || !state.locationId) {
    refs.timeslots.hidden = true;
    refs.slotsList.innerHTML = "";
    return;
  }

  const monthData = monthCache.get(cacheKey(state.locationId, state.currentMonth));
  if (!monthData) {
    refs.timeslots.hidden = true;
    return;
  }

  const day = monthData.days.find((item) => item.iso === state.selectedDateIso);
  if (!day) {
    refs.timeslots.hidden = true;
    return;
  }

  refs.timeslots.hidden = false;
  if (!day.slots || day.slots.length === 0) {
    refs.slotsList.innerHTML = '<span class="empty-state">No times available for this day.</span>';
    return;
  }

  refs.slotsList.innerHTML = day.slots
    .map((slot) => `<span class="slot-pill">${typeof slot === "string" ? slot : slot.label || slot.time || slot.start || "Time"}</span>`)
    .join("");
}

function renderPackages() {
  if (!FEATURE_PACKAGES) {
    refs.packagesPanel.hidden = true;
    refreshStepHighlights();
    return;
  }
  if (!state.locationId) {
    refs.packagesPanel.hidden = true;
    refreshStepHighlights();
    return;
  }

  const packages = state.packagesConfig[state.locationId];
  if (!packages || packages.length === 0) {
    refs.packagesPanel.hidden = false;
    refs.packagesGrid.innerHTML = "";
    refs.packagesEmpty.hidden = false;
    refs.packagesNote.hidden = true;
    updatePackageStepState();
    refreshStepHighlights();
    return;
  }

  refs.packagesPanel.hidden = false;
  refs.packagesGrid.innerHTML = packages
    .map(
      (pkg) => `
        <a class="package-button" href="${pkg.url}" target="_blank" rel="noopener">
          ${pkg.label}
        </a>
      `
    )
    .join("");
  refs.packagesEmpty.hidden = true;

  if (state.locationId === "casagrande") {
    refs.packagesNote.hidden = false;
    refs.packagesNote.textContent = "Casa Grande currently offers the Early Bird package only.";
  } else {
    refs.packagesNote.hidden = true;
    refs.packagesNote.textContent = "";
  }

  updatePackageStepState();
  refreshStepHighlights();
}

function updatePackageStepState() {
  if (FEATURE_PACKAGES && state.locationId) {
    refs.packagesPanel.hidden = false;
  } else {
    if (refs.packagesPanel) refs.packagesPanel.hidden = true;
  }
}

function refreshStepHighlights() {
  if (!refs.step1 || !refs.step2) return;
  const hasDateSelected = Boolean(state.selectedDateIso);
  const canShowPackages = FEATURE_PACKAGES && state.locationId;

  if (hasDateSelected && canShowPackages) {
    refs.step1.classList.remove("is-active");
    refs.step2.classList.add("is-active");
  } else {
    refs.step1.classList.add("is-active");
    refs.step2.classList.remove("is-active");
  }
}

function prefetchAdjacentMonths() {
  if (!state.locationId) return;
  const nextMonth = startOfMonth(new Date(state.currentMonth));
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  fetchMonthData(state.locationId, nextMonth, { prefetch: true }).catch(() => {});
}

async function handleAutoJumpIfNeeded(currentMonthData) {
  if (autoJumpInFlight) return;
  if (!state.locationId) return;
  const hasDays = (currentMonthData.days || []).some((day) => day.count > 0);
  if (hasDays) {
    state.autoJumpMessage = "";
    updateStatus();
    refreshStepHighlights();
    return;
  }

  autoJumpInFlight = true;
  try {
    const next = await findNextAvailableMonth(state.locationId, state.currentMonth);
    if (next) {
      state.currentMonth = startOfMonth(next.date);
      state.autoJumpMessage = `Jumped to next available month: ${next.date.toLocaleString(undefined, { month: "short", year: "numeric" })}`;
      monthCache.set(cacheKey(state.locationId, state.currentMonth), next.data);
      renderCalendar(next.data);
      updateStatus();
      updateTimeslots();
      renderPackages();
      refreshStepHighlights();
    } else {
      state.autoJumpMessage = `No availability found in the next ${AUTO_JUMP_LOOKAHEAD} months.`;
      updateStatus();
    }
  } finally {
    autoJumpInFlight = false;
  }
}

async function findNextAvailableMonth(locationId, fromMonth) {
  const lookaheadDates = [];
  for (let i = 1; i <= AUTO_JUMP_LOOKAHEAD; i += 1) {
    const date = startOfMonth(new Date(fromMonth));
    date.setMonth(date.getMonth() + i);
    lookaheadDates.push(date);
  }

  const tasks = lookaheadDates.map((date) =>
    (async () => {
      const data = await fetchMonthData(locationId, date, { prefetch: true });
      const hasAvailability = (data.days || []).some((day) => day.count > 0);
      if (hasAvailability) {
        return { date, data };
      }
      throw new Error("empty-month");
    })()
  );

  try {
    const winner = await Promise.any(tasks);
    console.info(`Auto-jump resolved to ${winner.date.toISOString().slice(0, 7)}`);
    return winner;
  } catch (aggregateError) {
    return null;
  }
}

function cacheKey(locationId, date) {
  return `${locationId}:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getLocationName(id) {
  const item = state.locations.find((loc) => loc.id === id);
  return item ? item.name : titleCase(id || "");
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function buildIso(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildIsoDate(date) {
  return buildIso(date.getFullYear(), date.getMonth(), date.getDate());
}

function isPastDate(iso) {
  const todayIso = buildIsoDate(new Date());
  return iso < todayIso;
}

function titleCase(value) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
