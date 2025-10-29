const FEATURE_PACKAGES = true; // set false to hide Step 2 block
const AUTO_JUMP_NEXT_AVAILABLE = true; // set false to keep current month even if empty
const AUTO_JUMP_LOOKAHEAD = 6; // months to scan forward

const DEBUG = false;

const BRAND_COLOR = "#ff6b2c";
const STEP_INACTIVE = "#8a8a8a";

const state = {
  packagesConfig: {},
  locations: [],
  selectedLocation: null,
  today: startOfDay(new Date()),
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selectedDate: null,
  monthCache: new Map(),
  pendingFetch: null,
  activeMonthKey: null,
};

const ui = {
  stepHeader: null,
  step1El: null,
  step2El: null,
  locationSelect: null,
  monthLabel: null,
  statusText: null,
  statusChip: null,
  calendarGrid: null,
  timeList: null,
  timeHeader: null,
  packagesPanel: null,
  packagesTitle: null,
  packagesNotice: null,
  packagesList: null,
  root: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  buildLayout();
  await bootstrapData();
});

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "Inter", "Segoe UI", sans-serif;
      background: #fafafa;
      color: #1a1a1a;
    }

    body {
      margin: 0;
      padding: 1.5rem;
      background: #fafafa;
      min-height: 100vh;
    }

    a {
      color: ${BRAND_COLOR};
    }

    #app {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .step-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .step-header .step {
      position: relative;
      padding-bottom: 0.35rem;
      color: ${STEP_INACTIVE};
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .step-header .step.is-active {
      color: #1a1a1a;
    }

    .step-header .step::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 2px;
      background: transparent;
      transition: background 0.3s ease;
    }

    .step-header .step.is-active::after {
      background: ${BRAND_COLOR};
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.1fr);
      gap: 1.5rem;
    }

    @media (max-width: 900px) {
      body {
        padding: 1rem;
      }
      .layout {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: #ffffff;
      border-radius: 1rem;
      padding: 1.25rem;
      box-shadow: 0 10px 30px rgba(16, 21, 30, 0.08);
    }

    .calendar-section header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .location-select {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .location-select label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #545454;
    }

    .location-select select {
      font-size: 1rem;
      padding: 0.65rem 0.85rem;
      border-radius: 0.75rem;
      border: 1px solid #d8d8d8;
      outline: none;
      transition: box-shadow 0.2s ease;
    }

    .location-select select:focus {
      box-shadow: 0 0 0 3px rgba(255, 107, 44, 0.2);
      border-color: ${BRAND_COLOR};
    }

    .month-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .month-nav h2 {
      font-size: 1.35rem;
      margin: 0;
    }

    .month-nav .nav-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .month-nav button {
      border: none;
      background: #f1f1f1;
      color: #333;
      border-radius: 999px;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 600;
      transition: background 0.2s ease;
    }

    .month-nav button:hover:not(:disabled) {
      background: rgba(255, 107, 44, 0.15);
      color: ${BRAND_COLOR};
    }

    .month-nav button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-size: 0.9rem;
      color: #555;
    }

    .status-chip {
      padding: 0.3rem 0.6rem;
      border-radius: 999px;
      background: rgba(26, 26, 26, 0.08);
      color: #333;
      font-weight: 600;
    }

    .calendar-grid {
      margin-top: 1rem;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.5rem;
      font-size: 0.95rem;
    }

    .calendar-day-name {
      text-align: center;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #777;
    }

    .calendar-day {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      align-items: flex-start;
      justify-content: flex-start;
      border-radius: 0.9rem;
      padding: 0.65rem;
      background: #f6f6f6;
      border: none;
      cursor: pointer;
      min-height: 90px;
      text-align: left;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .calendar-day:hover:not(.is-past):not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(16, 21, 30, 0.12);
      background: #fff;
    }

    .calendar-day:disabled {
      cursor: not-allowed;
    }

    .calendar-day .day-number {
      font-size: 1.15rem;
      font-weight: 600;
    }

    .calendar-day .slot-count {
      font-size: 0.75rem;
      font-weight: 700;
      color: #126e3d;
      background: rgba(25, 180, 84, 0.12);
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
    }

    .calendar-day.is-empty {
      color: #9a9a9a;
      background: #f0f0f0;
    }

    .calendar-day.is-past {
      color: #b1b1b1;
      background: #f5f5f5;
      opacity: 0.5;
    }

    .calendar-day.is-selected {
      outline: 2px solid ${BRAND_COLOR};
      background: #fff2ec;
    }

    .time-panel {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .time-panel h3 {
      margin: 0;
      font-size: 1.05rem;
    }

    .time-list {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .time-slot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 0.75rem;
      border-radius: 0.65rem;
      border: 1px solid #e0e0e0;
      background: #fff;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .packages-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .packages-panel h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .packages-notice {
      margin: 0;
      font-size: 0.9rem;
      color: #6a6a6a;
    }

    .packages-list {
      display: grid;
      gap: 0.65rem;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }

    .package-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1rem;
      border-radius: 0.9rem;
      border: 1px solid rgba(26, 26, 26, 0.12);
      background: linear-gradient(135deg, #fff, #f8f8f8);
      font-weight: 600;
      font-size: 0.95rem;
      color: #1a1a1a;
      text-decoration: none;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }

    .package-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(16, 21, 30, 0.16);
      border-color: ${BRAND_COLOR};
    }

    .hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function buildLayout() {
  ui.root = document.getElementById("app");

  const stepHeader = document.createElement("div");
  stepHeader.className = "step-header";
  ui.stepHeader = stepHeader;

  const step1 = document.createElement("span");
  step1.className = "step is-active";
  step1.textContent = "Step 1: Check availability";
  ui.step1El = step1;

  const arrow = document.createElement("span");
  arrow.textContent = "→";
  arrow.style.color = STEP_INACTIVE;

  const step2 = document.createElement("span");
  step2.className = "step";
  step2.textContent = "Step 2: Choose a package";
  ui.step2El = step2;

  stepHeader.append(step1, arrow, step2);
  ui.root.appendChild(stepHeader);

  const layout = document.createElement("div");
  layout.className = "layout";
  ui.root.appendChild(layout);

  const calendarSection = document.createElement("section");
  calendarSection.className = "calendar-section card";
  layout.appendChild(calendarSection);

  const calendarHeader = document.createElement("header");
  calendarSection.appendChild(calendarHeader);

  const locationWrap = document.createElement("div");
  locationWrap.className = "location-select";
  calendarHeader.appendChild(locationWrap);

  const locationLabel = document.createElement("label");
  locationLabel.setAttribute("for", "location");
  locationLabel.textContent = "Location";
  locationWrap.appendChild(locationLabel);

  const locationSelect = document.createElement("select");
  locationSelect.id = "location";
  locationWrap.appendChild(locationSelect);
  ui.locationSelect = locationSelect;

  const monthNav = document.createElement("div");
  monthNav.className = "month-nav";
  calendarHeader.appendChild(monthNav);

  const monthLabel = document.createElement("h2");
  monthLabel.textContent = "";
  monthNav.appendChild(monthLabel);
  ui.monthLabel = monthLabel;

  const navButtons = document.createElement("div");
  navButtons.className = "nav-buttons";
  monthNav.appendChild(navButtons);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "← Prev";
  navButtons.appendChild(prevBtn);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = "Next →";
  navButtons.appendChild(nextBtn);

  prevBtn.addEventListener("click", () => {
    const { year, month } = addMonths(state.viewYear, state.viewMonth, -1);
    navigateToMonth(year, month);
  });

  nextBtn.addEventListener("click", () => {
    const { year, month } = addMonths(state.viewYear, state.viewMonth, 1);
    navigateToMonth(year, month);
  });

  const statusRow = document.createElement("div");
  statusRow.className = "status-row";
  calendarHeader.appendChild(statusRow);

  const statusText = document.createElement("span");
  statusText.textContent = "Status: Ready";
  statusRow.appendChild(statusText);
  ui.statusText = statusText;

  const statusChip = document.createElement("span");
  statusChip.className = "status-chip hidden";
  statusChip.textContent = "";
  statusRow.appendChild(statusChip);
  ui.statusChip = statusChip;

  const calendarGrid = document.createElement("div");
  calendarGrid.className = "calendar-grid";
  calendarSection.appendChild(calendarGrid);
  ui.calendarGrid = calendarGrid;

  const timePanel = document.createElement("div");
  timePanel.className = "time-panel";
  calendarSection.appendChild(timePanel);

  const timeHeader = document.createElement("h3");
  timeHeader.textContent = "Available times";
  timePanel.appendChild(timeHeader);
  ui.timeHeader = timeHeader;

  const timeList = document.createElement("div");
  timeList.className = "time-list";
  timePanel.appendChild(timeList);
  ui.timeList = timeList;

  const packagesSection = document.createElement("aside");
  packagesSection.className = "packages-section card";
  layout.appendChild(packagesSection);

  const packagesPanel = document.createElement("div");
  packagesPanel.className = "packages-panel";
  packagesSection.appendChild(packagesPanel);
  ui.packagesPanel = packagesPanel;

  const packagesTitle = document.createElement("h2");
  packagesTitle.textContent = "Step 2 — Choose your package";
  packagesPanel.appendChild(packagesTitle);
  ui.packagesTitle = packagesTitle;

  const packagesNotice = document.createElement("p");
  packagesNotice.className = "packages-notice hidden";
  packagesNotice.textContent = "";
  packagesPanel.appendChild(packagesNotice);
  ui.packagesNotice = packagesNotice;

  const packagesList = document.createElement("div");
  packagesList.className = "packages-list";
  packagesPanel.appendChild(packagesList);
  ui.packagesList = packagesList;

  if (!FEATURE_PACKAGES) {
    packagesSection.classList.add("hidden");
  }
}

async function bootstrapData() {
  await Promise.all([loadPackagesConfig(), loadLocations()]);
  populateLocations();
  bindLocationChange();
  if (state.locations.length > 0) {
    const defaultLocation = state.locations[0].value;
    state.selectedLocation = defaultLocation;
    ui.locationSelect.value = defaultLocation;
    updateStepStates();
    await navigateToMonth(state.viewYear, state.viewMonth, { skipScroll: true });
    renderPackages(defaultLocation);
  } else {
    setStatus("No locations available.");
  }
}

async function loadPackagesConfig() {
  try {
    const res = await fetch("packages.config.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load packages.config.json: ${res.status}`);
    state.packagesConfig = await res.json();
  } catch (error) {
    console.error("Unable to load package config", error);
    state.packagesConfig = {};
  }
}

async function loadLocations() {
  try {
    const res = await fetch("/api/locations", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load locations: ${res.status}`);
    const payload = await res.json();
    if (Array.isArray(payload.locations)) {
      state.locations = payload.locations.map((loc) => ({
        value: loc.id || loc.value || loc.key || loc.slug || loc,
        label: loc.label || loc.name || capitalizeWords(loc.id || loc.value || loc.key || loc.slug || loc),
      }));
    }
  } catch (error) {
    if (DEBUG) {
      console.warn("Falling back to package config keys for locations", error);
    }
    if (!state.locations.length) {
      state.locations = Object.keys(state.packagesConfig).map((key) => ({
        value: key,
        label: capitalizeWords(key),
      }));
    }
  }

  state.locations.sort((a, b) => a.label.localeCompare(b.label));
}

function populateLocations() {
  ui.locationSelect.innerHTML = "";
  state.locations.forEach((loc) => {
    const option = document.createElement("option");
    option.value = loc.value;
    option.textContent = loc.label;
    ui.locationSelect.appendChild(option);
  });
}

function bindLocationChange() {
  ui.locationSelect.addEventListener("change", async (event) => {
    const value = event.target.value;
    state.selectedLocation = value;
    state.selectedDate = null;
    updateStepStates();
    highlightSelectedDay(null);
    renderPackages(value);
    await navigateToMonth(state.viewYear, state.viewMonth, { skipScroll: true });
  });
}

async function navigateToMonth(year, month, options = {}) {
  if (!state.selectedLocation) return;
  state.viewYear = year;
  state.viewMonth = month;
  ui.monthLabel.textContent = formatMonthYear(year, month);
  setStatus("Loading availability…");
  if (!options.preserveStatusChip) {
    setStatusChip("");
  }
  await loadMonthData(year, month, options);
}

async function loadMonthData(year, month, options = {}) {
  const location = state.selectedLocation;
  if (!location) return;
  const key = monthKey(location, year, month);
  state.activeMonthKey = key;

  if (state.pendingFetch && state.pendingFetch.controller) {
    state.pendingFetch.controller.abort();
  }

  const cacheEntry = state.monthCache.get(key);
  if (cacheEntry) {
    setStatus(`Loaded ${formatMonthYear(year, month)} (cached)`);
    renderCalendar(cacheEntry);
    if (!cacheEntry.hasDays && AUTO_JUMP_NEXT_AVAILABLE && !options.skipAutoJump) {
      await attemptAutoJump(year, month);
    }
    return;
  }

  const controller = new AbortController();
  state.pendingFetch = { controller, key };

  try {
    const data = await fetchMonthAvailability(location, year, month, controller.signal);
    if (state.pendingFetch?.key !== key) {
      return;
    }
    const normalized = normalizeMonthData(data, year, month);
    state.monthCache.set(key, normalized);
    renderCalendar(normalized);
    setStatus(`Loaded ${formatMonthYear(year, month)}`);
    if (!normalized.hasDays && AUTO_JUMP_NEXT_AVAILABLE && !options.skipAutoJump) {
      await attemptAutoJump(year, month);
    } else if (AUTO_JUMP_NEXT_AVAILABLE && normalized.hasDays) {
      prefetchUpcomingMonths(year, month, 2);
    }
    state.pendingFetch = null;
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.error("Failed to fetch availability", error);
    const fallback = normalizeMonthData(null, year, month);
    state.monthCache.set(key, fallback);
    renderCalendar(fallback);
    setStatus("Unable to load availability.");
    if (!fallback.hasDays && AUTO_JUMP_NEXT_AVAILABLE && !options.skipAutoJump) {
      await attemptAutoJump(year, month);
    }
    state.pendingFetch = null;
  }
}

async function fetchMonthAvailability(location, year, month, signal) {
  const params = new URLSearchParams({
    location,
    year: String(year),
    month: String(month + 1),
  });
  const response = await fetch(`/api/availability?${params.toString()}`, {
    signal,
    cache: "no-cache",
  });
  if (!response.ok) {
    throw new Error(`Availability request failed (${response.status})`);
  }
  return response.json();
}

function normalizeMonthData(data, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totals = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    count: 0,
    slots: [],
  }));
  const slotsByDate = new Map();

  if (data && typeof data === "object") {
    if (Array.isArray(data.days)) {
      data.days.forEach((entry) => processEntry(entry, slotsByDate, totals, year, month));
    }

    if (data.availability && typeof data.availability === "object") {
      Object.entries(data.availability).forEach(([date, entry]) => {
        const normalizedEntry = Array.isArray(entry)
          ? { date, slots: entry }
          : { date, ...(entry || {}) };
        processEntry(normalizedEntry, slotsByDate, totals, year, month);
      });
    }
  }

  const hasDays = totals.some((day) => day.count > 0);

  return {
    year,
    month,
    totals,
    slotsByDate,
    hasDays,
  };
}

function processEntry(entry, slotsByDate, totals, year, month) {
  if (!entry || !entry.date) return;
  const entryDate = new Date(entry.date);
  if (Number.isNaN(entryDate.getTime())) return;
  if (entryDate.getFullYear() !== year || entryDate.getMonth() !== month) return;

  const dayIndex = entryDate.getDate() - 1;
  if (!totals[dayIndex]) return;

  const slots = Array.isArray(entry.slots || entry.times)
    ? entry.slots || entry.times
    : Array.isArray(entry.availability)
    ? entry.availability
    : [];

  const count = typeof entry.count === "number"
    ? entry.count
    : typeof entry.available === "number"
    ? entry.available
    : typeof entry.availableSlots === "number"
    ? entry.availableSlots
    : slots.length;

  totals[dayIndex].count = count;
  totals[dayIndex].slots = slots.slice();
  slotsByDate.set(formatISODate(entryDate), slots.slice());
}

function renderCalendar(monthRecord) {
  ui.calendarGrid.innerHTML = "";

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayLabels.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "calendar-day-name";
    cell.textContent = label;
    ui.calendarGrid.appendChild(cell);
  });

  const firstDay = new Date(monthRecord.year, monthRecord.month, 1).getDay();
  for (let i = 0; i < firstDay; i += 1) {
    const spacer = document.createElement("div");
    ui.calendarGrid.appendChild(spacer);
  }

  monthRecord.totals.forEach((dayInfo) => {
    const dateObj = new Date(monthRecord.year, monthRecord.month, dayInfo.day);
    const iso = formatISODate(dateObj);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(dayInfo.day);
    button.appendChild(dayNumber);

    if (dayInfo.count > 0) {
      const badge = document.createElement("span");
      badge.className = "slot-count";
      badge.textContent = `×${dayInfo.count}`;
      button.appendChild(badge);
    } else {
      button.classList.add("is-empty");
    }

    const isPast = dateObj < state.today;
    if (isPast) {
      button.classList.add("is-past");
      button.disabled = true;
    }

    if (state.selectedDate && formatISODate(state.selectedDate) === iso) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      if (isPast) return;
      state.selectedDate = dateObj;
      highlightSelectedDay(iso);
      renderTimes(iso, monthRecord.slotsByDate.get(iso) || []);
    });

    ui.calendarGrid.appendChild(button);
  });

  if (!state.selectedDate) {
    renderTimes(null, []);
  }
}

function renderTimes(isoDate, slots) {
  ui.timeList.innerHTML = "";
  if (!isoDate) {
    ui.timeHeader.textContent = "Available times";
    const message = document.createElement("span");
    message.textContent = "Select a date to view available times.";
    ui.timeList.appendChild(message);
    return;
  }

  const parsedDate = parseISODate(isoDate);
  ui.timeHeader.textContent = parsedDate
    ? `Available times for ${formatDisplayDate(parsedDate)}`
    : "Available times";

  if (!slots || slots.length === 0) {
    const message = document.createElement("span");
    message.textContent = "No times available for this date.";
    ui.timeList.appendChild(message);
    return;
  }

  slots.forEach((slot) => {
    const slotEl = document.createElement("div");
    slotEl.className = "time-slot";
    let label = null;
    if (slot && typeof slot === "object") {
      if (slot.label) {
        label = slot.label;
      } else if (slot.start && slot.end) {
        label = `${slot.start} – ${slot.end}`;
      } else if (slot.time) {
        label = slot.time;
      } else if (slot.start) {
        label = slot.start;
      }
    }
    if (!label) {
      label = String(slot);
    }
    slotEl.textContent = label;
    ui.timeList.appendChild(slotEl);
  });
}

function renderPackages(locationKey) {
  if (!FEATURE_PACKAGES) return;
  if (!ui.packagesPanel) return;

  const packages = state.packagesConfig[locationKey];
  ui.packagesList.innerHTML = "";

  if (!packages || packages.length === 0) {
    ui.packagesNotice.textContent = "Packages coming soon.";
    ui.packagesNotice.classList.remove("hidden");
    updateStepStates();
    return;
  }

  if (locationKey === "casagrande") {
    ui.packagesNotice.textContent = "Casa Grande currently offers the Early Bird package only.";
    ui.packagesNotice.classList.remove("hidden");
  } else {
    ui.packagesNotice.classList.add("hidden");
  }

  packages.forEach((pkg) => {
    const link = document.createElement("a");
    link.className = "package-button";
    link.href = pkg.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = pkg.label;
    ui.packagesList.appendChild(link);
  });

  updateStepStates();
}

function highlightSelectedDay(iso) {
  const buttons = ui.calendarGrid.querySelectorAll(".calendar-day");
  buttons.forEach((button) => {
    const dayNumber = button.querySelector(".day-number");
    if (!dayNumber) return;
    const day = parseInt(dayNumber.textContent || "", 10);
    const date = new Date(state.viewYear, state.viewMonth, day);
    const matches = iso && formatISODate(date) === iso;
    button.classList.toggle("is-selected", Boolean(matches));
  });
}

async function attemptAutoJump(year, month) {
  if (!AUTO_JUMP_NEXT_AVAILABLE) return;
  const location = state.selectedLocation;
  if (!location) return;

  const lookahead = Math.max(1, AUTO_JUMP_LOOKAHEAD);
  const offsets = Array.from({ length: lookahead }, (_, index) => index + 1);
  const emptyOffsets = new Set();
  const results = new Map();

  setStatusChip("Searching for next available month…");

  const resolution = await new Promise((resolve, reject) => {
    let settledEmpty = 0;

    offsets.forEach((offset) => {
      const target = addMonths(year, month, offset);
      prefetchMonthForLocation(location, target.year, target.month)
        .then((record) => {
          if (record.hasDays) {
            results.set(offset, { offset, target, record });
          } else {
            emptyOffsets.add(offset);
            settledEmpty += 1;
          }
          evaluate();
        })
        .catch((error) => {
          if (DEBUG) console.warn("Prefetch failed", error);
          emptyOffsets.add(offset);
          settledEmpty += 1;
          evaluate();
        });
    });

    function evaluate() {
      for (let i = 1; i <= lookahead; i += 1) {
        if (results.has(i)) {
          let earlierConfirmed = true;
          for (let j = 1; j < i; j += 1) {
            if (!emptyOffsets.has(j)) {
              earlierConfirmed = false;
              break;
            }
          }
          if (earlierConfirmed) {
            resolve(results.get(i));
            return;
          }
        }
        if (!emptyOffsets.has(i) && !results.has(i)) {
          return;
        }
      }
      if (settledEmpty >= lookahead) {
        reject(new Error("no-availability"));
      }
    }
  }).catch((error) => {
    if (error && error.message === "no-availability") {
      setStatusChip(`No availability found in the next ${lookahead} months.`);
    } else {
      setStatusChip("Unable to locate upcoming availability.");
    }
    return null;
  });

  if (!resolution) return;

  const { target, record } = resolution;
  if (state.selectedLocation !== location) {
    return;
  }
  if (DEBUG) {
    console.info("Auto-jump resolved", target);
  } else {
    console.info(`Jumped to next available month: ${formatMonthYear(target.year, target.month)}`);
  }
  setStatusChip(`Jumped to next available month: ${formatMonthYear(target.year, target.month)}`);
  state.monthCache.set(monthKey(state.selectedLocation, target.year, target.month), record);
  await navigateToMonth(target.year, target.month, { skipAutoJump: true, preserveStatusChip: true });
}

async function prefetchMonthForLocation(location, year, month) {
  if (!location) return normalizeMonthData(null, year, month);
  const key = monthKey(location, year, month);
  const cached = state.monthCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const data = await fetchMonthAvailability(location, year, month, controller.signal);
  const normalized = normalizeMonthData(data, year, month);
  state.monthCache.set(key, normalized);
  return normalized;
}

function prefetchUpcomingMonths(year, month, count) {
  if (!AUTO_JUMP_NEXT_AVAILABLE) return;
  const location = state.selectedLocation;
  if (!location) return;
  const limit = Math.max(0, count || 0);
  for (let i = 1; i <= limit; i += 1) {
    const target = addMonths(year, month, i);
    const key = monthKey(location, target.year, target.month);
    if (!state.monthCache.has(key)) {
      prefetchMonthForLocation(location, target.year, target.month).catch(() => {});
    }
  }
}

function setStatus(message) {
  ui.statusText.textContent = `Status: ${message}`;
}

function setStatusChip(message) {
  if (!message) {
    ui.statusChip.classList.add("hidden");
    ui.statusChip.textContent = "";
    return;
  }
  ui.statusChip.classList.remove("hidden");
  ui.statusChip.textContent = message;
}

function updateStepStates() {
  if (!FEATURE_PACKAGES) {
    ui.step2El.classList.remove("is-active");
    return;
  }

  const packages = state.packagesConfig[state.selectedLocation];
  if (state.selectedLocation && Array.isArray(packages) && packages.length) {
    ui.step2El.classList.add("is-active");
  } else {
    ui.step2El.classList.remove("is-active");
  }
}

function addMonths(year, month, offset) {
  const date = new Date(year, month + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function formatMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatDisplayDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function parseISODate(iso) {
  if (!iso || typeof iso !== "string") return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10));
  if ([year, month, day].some((value) => Number.isNaN(value))) return null;
  return new Date(year, month - 1, day);
}

function monthKey(location, year, month) {
  return `${location}:${year}-${String(month + 1).padStart(2, "0")}`;
}

function capitalizeWords(text) {
  return text
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
