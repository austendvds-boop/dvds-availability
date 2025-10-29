const FEATURE_PACKAGES = true;
const AUTO_JUMP_NEXT_AVAILABLE = true;
const AUTO_JUMP_LOOKAHEAD = 6;
const DEBUG = false;

const BRAND_COLOR = "#ea580c";

const fallbackLocations = [
  { id: "ahwatukee", name: "Ahwatukee" },
  { id: "anthem", name: "Anthem" },
  { id: "apachejunction", name: "Apache Junction" },
  { id: "casagrande", name: "Casa Grande" },
  { id: "cavecreek", name: "Cave Creek" },
  { id: "chandler", name: "Chandler" },
  { id: "downtownphx", name: "Downtown Phoenix" },
  { id: "gilbert", name: "Gilbert" },
  { id: "glendale", name: "Glendale" },
  { id: "mesa", name: "Mesa" },
  { id: "northphx", name: "North Phoenix" },
  { id: "peoria", name: "Peoria" },
  { id: "queencreek", name: "Queen Creek" },
  { id: "santanvalley", name: "San Tan Valley" },
  { id: "scottsdale", name: "Scottsdale" },
  { id: "suncity", name: "Sun City" },
  { id: "surprise", name: "Surprise" },
  { id: "tempe", name: "Tempe" },
  { id: "westvalley", name: "West Valley" }
];

const state = {
  locationId: null,
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  selectedDateIso: null,
  currentMonthData: null,
  loading: false
};

const availabilityCache = new Map();
const pendingRequests = new Map();
const prefetchedKeys = new Set();

let packagesConfig = {};
let packagesLoaded = false;

let step1El;
let step2El;
let locationSelect;
let monthLabelEl;
let calendarGridEl;
let calendarCardEl;
let prevMonthBtn;
let nextMonthBtn;
let statusChipEl;
let packagesPanelEl;
let packagesGridEl;
let packagesNoticeEl;
let timeSlotsContainer;
let calendarEmptyStateEl;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  injectStyles();
  buildUI();
  if (FEATURE_PACKAGES) {
    loadPackagesConfig();
  }
  loadLocations();
  renderTimeSlots(null);
  renderCalendarPlaceholder("Select a location to view availability");
}
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: 'Inter', 'Segoe UI', sans-serif;
    }
    body {
      margin: 0;
      padding: 1.5rem;
      background: #f7f7f7;
      color: #1f2937;
    }
    .dvds-app {
      max-width: 1100px;
      margin: 0 auto;
    }
    .dvds-header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .dvds-steps {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-weight: 600;
      font-size: 1rem;
    }
    .dvds-step {
      position: relative;
      padding-bottom: 0.25rem;
      color: #4b5563;
    }
    .dvds-step::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: transparent;
      border-radius: 999px;
      transition: background 0.2s ease;
    }
    .dvds-step.is-active {
      color: ${BRAND_COLOR};
    }
    .dvds-step.is-active::after {
      background: ${BRAND_COLOR};
    }
    .dvds-step.is-available {
      color: #1f2937;
    }
    .dvds-step-arrow {
      opacity: 0.5;
    }
    .dvds-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
    }
    .location-select {
      min-width: 220px;
      padding: 0.6rem 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid #d1d5db;
      background: #fff;
      font-size: 1rem;
      color: #111827;
    }
    .status-row {
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      font-size: 0.95rem;
    }
    .status-label {
      font-weight: 600;
      color: #4b5563;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: #e5e7eb;
      color: #111827;
      font-weight: 500;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .status-chip[data-tone="success"] {
      background: rgba(16, 185, 129, 0.15);
      color: #047857;
    }
    .status-chip[data-tone="warning"] {
      background: rgba(234, 179, 8, 0.18);
      color: #b45309;
    }
    .status-chip[data-tone="error"] {
      background: rgba(248, 113, 113, 0.2);
      color: #b91c1c;
    }
    .dvds-layout {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: minmax(0, 1fr);
    }
    .calendar-section {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
    }
    .calendar-card {
      background: #fff;
      border-radius: 1rem;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 420px;
      position: relative;
    }
    .calendar-card.is-loading::after {
      content: "Loading availability…";
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      border-radius: 1rem;
      color: #1f2937;
    }
    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .month-label {
      font-size: 1.25rem;
      font-weight: 700;
      color: #111827;
    }
    .month-nav {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      border: none;
      background: #f3f4f6;
      color: #111827;
      font-size: 1.25rem;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .month-nav:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .month-nav:not(:disabled):hover {
      background: #e5e7eb;
    }
    .calendar-weekdays,
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
    }
    .calendar-weekdays {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }
    .weekday-cell {
      display: flex;
      justify-content: center;
      font-weight: 600;
    }
    .calendar-grid {
      flex: 1;
      align-content: start;
      min-height: 260px;
    }
    .calendar-cell {
      min-height: 0;
    }
    .calendar-day {
      width: 100%;
      border: 1px solid transparent;
      background: #f9fafb;
      color: #111827;
      border-radius: 0.85rem;
      padding: 0.75rem 0.5rem 0.6rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      font-weight: 600;
      transition: transform 0.15s ease, border 0.15s ease, background 0.15s ease;
      cursor: pointer;
    }
    .calendar-day:hover:not(.is-past):not(.is-selected) {
      transform: translateY(-2px);
      border-color: rgba(234, 88, 12, 0.45);
    }
    .calendar-day.is-selected {
      border-color: ${BRAND_COLOR};
      background: rgba(234, 88, 12, 0.12);
      color: ${BRAND_COLOR};
    }
    .calendar-day.is-past {
      color: #9ca3af;
      background: #f3f4f6;
      cursor: not-allowed;
    }
    .calendar-day.is-past .day-count {
      background: rgba(156, 163, 175, 0.18);
      color: #6b7280;
    }
    .calendar-day.is-empty {
      color: #6b7280;
      background: #f9fafb;
    }
    .calendar-day.is-empty .day-count {
      background: rgba(107, 114, 128, 0.15);
      color: #4b5563;
    }
    .day-number {
      font-size: 1rem;
    }
    .day-count {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.18);
      color: #047857;
      font-weight: 700;
    }
    .calendar-empty {
      grid-column: span 7;
      text-align: center;
      color: #6b7280;
      padding: 2rem 0;
      font-weight: 500;
    }
    .timeslots-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .slots-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #111827;
    }
    .timeslots {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .timeslots.is-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      background: #fff;
      border-radius: 0.75rem;
      border: 1px dashed #d1d5db;
      padding: 1.5rem;
    }
    .timeslot-button {
      padding: 0.65rem 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(234, 88, 12, 0.4);
      background: rgba(234, 88, 12, 0.08);
      color: ${BRAND_COLOR};
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.15s ease;
    }
    .timeslot-button:hover {
      background: rgba(234, 88, 12, 0.18);
      transform: translateY(-1px);
    }
    .packages-panel {
      background: #fff;
      border-radius: 1rem;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .packages-panel.hidden {
      display: none;
    }
    .packages-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #111827;
    }
    .packages-notice {
      margin: 0;
      font-size: 0.95rem;
      color: #b45309;
      background: rgba(234, 179, 8, 0.2);
      border-radius: 0.75rem;
      padding: 0.6rem 0.75rem;
    }
    .packages-notice.hidden {
      display: none;
    }
    .packages-grid {
      display: grid;
      gap: 0.6rem;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .package-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.65rem 0.75rem;
      border-radius: 0.85rem;
      background: ${BRAND_COLOR};
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      text-align: center;
    }
    .package-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(234, 88, 12, 0.25);
    }
    .packages-empty {
      color: #6b7280;
      font-size: 0.95rem;
    }
    @media (min-width: 960px) {
      .dvds-layout {
        grid-template-columns: 2fr 1fr;
        align-items: start;
      }
      .calendar-section {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 640px) {
      body {
        padding: 1rem;
      }
      .dvds-header {
        align-items: flex-start;
      }
      .dvds-steps {
        flex-direction: column;
        align-items: flex-start;
      }
      .dvds-step-arrow {
        display: none;
      }
      .calendar-card {
        padding: 1rem;
      }
      .month-nav {
        width: 2.25rem;
        height: 2.25rem;
      }
    }
  `;
  document.head.appendChild(style);
}
function buildUI() {
  const appRoot = document.getElementById("app");
  appRoot.classList.add("dvds-app");

  const header = createElement("div", "dvds-header");
  const stepsRow = createElement("div", "dvds-steps");
  step1El = createElement("div", "dvds-step is-active", "Step 1: Check availability");
  const arrowEl = createElement("div", "dvds-step-arrow", "→");
  step2El = createElement("div", "dvds-step", "Step 2: Choose a package");
  stepsRow.append(step1El, arrowEl, step2El);
  header.appendChild(stepsRow);

  const controls = createElement("div", "dvds-controls");
  locationSelect = document.createElement("select");
  locationSelect.className = "location-select";
  locationSelect.append(new Option("Select a location", "", true, true));
  locationSelect.addEventListener("change", (event) => {
    const newLocation = event.target.value || null;
    onLocationChange(newLocation);
  });
  controls.appendChild(locationSelect);
  header.appendChild(controls);

  const statusRow = createElement("div", "status-row");
  statusRow.append(
    createElement("span", "status-label", "Status:"),
    (statusChipEl = createElement("span", "status-chip", "Select a location to begin"))
  );
  header.appendChild(statusRow);
  updateStatusTone("info");

  const layout = createElement("div", "dvds-layout");
  const calendarSection = createElement("section", "calendar-section");
  calendarCardEl = createElement("div", "calendar-card");

  const calendarHeader = createElement("div", "calendar-header");
  prevMonthBtn = createElement("button", "month-nav", "‹");
  prevMonthBtn.type = "button";
  prevMonthBtn.addEventListener("click", () => onMonthOffset(-1));
  nextMonthBtn = createElement("button", "month-nav", "›");
  nextMonthBtn.type = "button";
  nextMonthBtn.addEventListener("click", () => onMonthOffset(1));
  monthLabelEl = createElement("div", "month-label", formatMonthYear(state.currentYear, state.currentMonth));
  calendarHeader.append(prevMonthBtn, monthLabelEl, nextMonthBtn);

  const weekdaysRow = createElement("div", "calendar-weekdays");
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
    weekdaysRow.appendChild(createElement("div", "weekday-cell", day));
  });

  calendarGridEl = createElement("div", "calendar-grid");
  calendarEmptyStateEl = createElement("div", "calendar-empty", "Select a location to view availability");
  calendarGridEl.appendChild(calendarEmptyStateEl);

  calendarCardEl.append(calendarHeader, weekdaysRow, calendarGridEl);
  calendarSection.appendChild(calendarCardEl);

  const timeslotsWrapper = createElement("div", "timeslots-wrapper");
  timeslotsWrapper.appendChild(createElement("h3", "slots-title", "Available times"));
  timeSlotsContainer = createElement("div", "timeslots is-empty", "Select a date to view times");
  timeslotsWrapper.appendChild(timeSlotsContainer);
  calendarSection.appendChild(timeslotsWrapper);

  layout.appendChild(calendarSection);

  packagesPanelEl = createElement("aside", "packages-panel hidden");
  packagesPanelEl.appendChild(createElement("h3", "packages-title", "Step 2 — Choose your package"));
  packagesNoticeEl = createElement("p", "packages-notice hidden", "");
  packagesPanelEl.appendChild(packagesNoticeEl);
  packagesGridEl = createElement("div", "packages-grid");
  packagesPanelEl.appendChild(packagesGridEl);
  layout.appendChild(packagesPanelEl);

  appRoot.appendChild(header);
  appRoot.appendChild(layout);

  updateStepHighlights();
  updateNavigationState();
}
async function loadLocations() {
  updateStatus("Fetching locations…", "info");
  try {
    const response = await fetch("./api/locations");
    if (response.ok) {
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : payload?.locations;
      if (Array.isArray(items) && items.length > 0) {
        populateLocations(items);
        updateStatus("Select a location to check availability", "info");
        return;
      }
    }
    throw new Error("Invalid locations response");
  } catch (error) {
    populateLocations(fallbackLocations);
    updateStatus("Loaded fallback locations. Select one to continue", "warning");
  }
}

async function loadPackagesConfig() {
  try {
    const response = await fetch("./packages.config.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to fetch package config");
    }
    const json = await response.json();
    packagesConfig = json ?? {};
  } catch (error) {
    packagesConfig = {};
  } finally {
    packagesLoaded = true;
    updatePackagesPanel();
  }
}

function populateLocations(list) {
  locationSelect.innerHTML = "";
  locationSelect.append(new Option("Select a location", "", true, true));
  list
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => {
      locationSelect.append(new Option(item.name, item.id));
    });
  updateNavigationState();
}

function onLocationChange(locationId) {
  if (state.locationId === locationId) {
    return;
  }
  abortAllPending();
  state.locationId = locationId;
  state.selectedDateIso = null;
  state.currentMonthData = null;
  renderTimeSlots(null);
  if (!locationId) {
    updateStatus("Select a location to check availability", "info");
    renderCalendarPlaceholder("Select a location to view availability");
  } else {
    updateStatus(`Loading availability for ${getLocationName(locationId)}…`, "info");
    showMonth(state.currentYear, state.currentMonth);
  }
  updatePackagesPanel();
  updateStepHighlights();
  updateNavigationState();
}
function updateStepHighlights() {
  if (step1El) {
    step1El.classList.add("is-active");
  }
  if (!step2El) return;
  if (state.locationId) {
    step2El.classList.add("is-available");
    if (state.selectedDateIso) {
      step2El.classList.add("is-active");
    } else {
      step2El.classList.remove("is-active");
    }
  } else {
    step2El.classList.remove("is-available");
    step2El.classList.remove("is-active");
  }
}

function updateNavigationState() {
  const disabled = !state.locationId || state.loading;
  if (prevMonthBtn) prevMonthBtn.disabled = disabled;
  if (nextMonthBtn) nextMonthBtn.disabled = disabled;
}

function renderCalendarPlaceholder(message) {
  calendarGridEl.innerHTML = "";
  calendarGridEl.appendChild(createElement("div", "calendar-empty", message));
}

function renderTimeSlots(dayInfo) {
  if (!timeSlotsContainer) return;
  timeSlotsContainer.innerHTML = "";
  if (!dayInfo) {
    timeSlotsContainer.className = "timeslots is-empty";
    timeSlotsContainer.textContent = "Select a date to view times";
    updateStepHighlights();
    return;
  }
  if (!Array.isArray(dayInfo.slots) || dayInfo.slots.length === 0) {
    timeSlotsContainer.className = "timeslots is-empty";
    timeSlotsContainer.textContent = "No times available for this day.";
    updateStepHighlights();
    return;
  }
  timeSlotsContainer.className = "timeslots";
  dayInfo.slots.forEach((slot, index) => {
    const label = formatSlot(slot, index);
    const btn = createElement("button", "timeslot-button", label);
    btn.type = "button";
    btn.addEventListener("click", () => {
      updateStatus(`Selected ${label} on ${formatDateLong(dayInfo.date)}`, "success");
    });
    timeSlotsContainer.appendChild(btn);
  });
  updateStepHighlights();
}

function updatePackagesPanel() {
  if (!packagesPanelEl) return;
  if (!FEATURE_PACKAGES || !state.locationId) {
    packagesPanelEl.classList.add("hidden");
    return;
  }
  packagesPanelEl.classList.remove("hidden");
  packagesGridEl.innerHTML = "";
  packagesNoticeEl.classList.add("hidden");
  packagesNoticeEl.textContent = "";

  if (!packagesLoaded) {
    packagesGridEl.appendChild(createElement("div", "packages-empty", "Loading packages…"));
    return;
  }

  const items = packagesConfig[state.locationId];
  if (!Array.isArray(items) || items.length === 0) {
    packagesGridEl.appendChild(createElement("div", "packages-empty", "Packages coming soon."));
    return;
  }

  if (state.locationId === "casagrande") {
    packagesNoticeEl.textContent = "Casa Grande currently offers the Early Bird package only.";
    packagesNoticeEl.classList.remove("hidden");
  }

  items.forEach((pkg) => {
    const anchor = createElement("a", "package-button", pkg.label);
    anchor.href = pkg.url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    packagesGridEl.appendChild(anchor);
  });
}

function updateStatus(message, tone = "info") {
  if (!statusChipEl) return;
  statusChipEl.textContent = message;
  updateStatusTone(tone);
}

function updateStatusTone(tone) {
  if (!statusChipEl) return;
  statusChipEl.dataset.tone = tone;
}
function onMonthOffset(offset) {
  if (!state.locationId) return;
  const { year, month } = offsetMonth(state.currentYear, state.currentMonth, offset);
  showMonth(year, month);
}

async function showMonth(year, month, options = {}) {
  const { skipAutoJump = false, statusMessage = null, preserveSelection = false } = options;
  state.currentYear = year;
  state.currentMonth = month;
  if (!preserveSelection) {
    state.selectedDateIso = null;
    renderTimeSlots(null);
  }
  state.loading = true;
  updateNavigationState();
  monthLabelEl.textContent = formatMonthYear(year, month);
  calendarCardEl.classList.add("is-loading");
  try {
    const monthData = await fetchMonthAvailability(state.locationId, year, month);
    state.currentMonthData = monthData;
    renderCalendar(monthData);
    prefetchAdjacentMonths();
    if (statusMessage) {
      updateStatus(statusMessage, "success");
    } else {
      updateStatus(`Loaded availability for ${formatMonthYear(year, month)}`, "success");
    }
    if (!skipAutoJump && AUTO_JUMP_NEXT_AVAILABLE) {
      const hasDays = hasAvailabilityForMonth(monthData);
      if (!hasDays) {
        await handleAutoJump();
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    updateStatus("Failed to load availability. Please try again.", "error");
  } finally {
    state.loading = false;
    calendarCardEl.classList.remove("is-loading");
    updateNavigationState();
  }
}

function renderCalendar(monthData) {
  const { year, month } = monthData;
  const map = new Map();
  monthData.days.forEach((day) => {
    map.set(day.date, day);
  });

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  calendarGridEl.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    calendarGridEl.appendChild(createElement("div", "calendar-cell", ""));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toISO(year, month, day);
    const dayInfo = map.get(iso) || { date: iso, slots: [], count: 0 };
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.appendChild(createElement("span", "day-number", String(day)));

    if (dayInfo.count > 0) {
      button.appendChild(createElement("span", "day-count", `×${dayInfo.count}`));
    } else {
      button.classList.add("is-empty");
    }

    if (isPastDate(iso)) {
      button.classList.add("is-past");
      button.disabled = true;
    } else {
      button.addEventListener("click", () => selectDay(iso, dayInfo, button));
    }

    if (state.selectedDateIso === iso) {
      button.classList.add("is-selected");
    }

    calendarGridEl.appendChild(button);
  }

  const totalCells = firstDay + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder !== 0) {
    for (let i = remainder; i < 7; i++) {
      calendarGridEl.appendChild(createElement("div", "calendar-cell", ""));
    }
  }
}
function selectDay(isoDate, dayInfo, button) {
  state.selectedDateIso = isoDate;
  calendarGridEl.querySelectorAll(".calendar-day.is-selected").forEach((el) => el.classList.remove("is-selected"));
  button.classList.add("is-selected");
  renderTimeSlots(dayInfo);
  updateStatus(`Showing ${dayInfo.count} slot${dayInfo.count === 1 ? "" : "s"} on ${formatDateLong(isoDate)}`, "info");
}

function hasAvailabilityForMonth(monthData) {
  return monthData.totals?.some((day) => day.count > 0) || monthData.days.some((day) => day.count > 0);
}

async function handleAutoJump() {
  if (!state.locationId) return;
  const lookahead = [];
  const promises = [];
  for (let offset = 1; offset <= AUTO_JUMP_LOOKAHEAD; offset += 1) {
    const target = offsetMonth(state.currentYear, state.currentMonth, offset);
    lookahead.push(target);
    promises.push(fetchMonthAvailability(state.locationId, target.year, target.month));
  }

  let match = null;
  for (let index = 0; index < lookahead.length; index += 1) {
    let data;
    try {
      data = await promises[index];
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      continue;
    }
    if (hasAvailabilityForMonth(data)) {
      match = { ...lookahead[index], data };
      break;
    }
  }

  if (match) {
    const label = formatMonthYear(match.year, match.month);
    if (DEBUG) {
      console.info(`Auto-jump to next available month: ${label}`);
    }
    await showMonth(match.year, match.month, {
      skipAutoJump: true,
      statusMessage: `Jumped to next available month: ${label}`
    });
  } else {
    updateStatus(`No availability found in the next ${AUTO_JUMP_LOOKAHEAD} months.`, "warning");
  }
}

function prefetchAdjacentMonths() {
  if (!state.locationId) return;
  const next = offsetMonth(state.currentYear, state.currentMonth, 1);
  const afterNext = offsetMonth(state.currentYear, state.currentMonth, 2);
  [next, afterNext].forEach(({ year, month }) => prefetchMonth(state.locationId, year, month));
}

function prefetchMonth(locationId, year, month) {
  const key = makeCacheKey(locationId, year, month);
  if (availabilityCache.has(key) || prefetchedKeys.has(key)) {
    return;
  }
  prefetchedKeys.add(key);
  fetchMonthAvailability(locationId, year, month).catch(() => {
    prefetchedKeys.delete(key);
  });
}
async function fetchMonthAvailability(locationId, year, month) {
  const key = makeCacheKey(locationId, year, month);
  if (availabilityCache.has(key)) {
    return availabilityCache.get(key);
  }
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key).promise;
  }

  const controller = new AbortController();
  const params = new URLSearchParams({ location: locationId, year: String(year), month: String(month) });
  const request = fetch(`./api/availability?${params.toString()}`, {
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch availability");
      }
      const payload = await response.json();
      return normalizeAvailability(payload, { locationId, year, month });
    })
    .catch((error) => {
      if (error?.name === "AbortError") {
        throw error;
      }
      return buildMockAvailability(locationId, year, month);
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, { controller, promise: request });

  const result = await request;
  availabilityCache.set(key, result);
  return result;
}

function abortAllPending() {
  pendingRequests.forEach((entry) => {
    entry.controller.abort();
  });
  pendingRequests.clear();
}
function normalizeAvailability(raw, context) {
  const year = Number(raw?.year ?? raw?.month?.year ?? context.year);
  const month = Number(raw?.month ?? raw?.month?.month ?? context.month);
  const dayList = Array.isArray(raw?.days)
    ? raw.days
    : Array.isArray(raw?.data?.days)
    ? raw.data.days
    : [];

  const normalizedDays = dayList.map((item) => {
    const iso = normalizeIsoDate(item.date ?? item.iso ?? item.day ?? null, year, month);
    const slots = Array.isArray(item.slots) ? item.slots : [];
    const count = typeof item.count === "number" ? item.count : slots.length;
    return {
      date: iso,
      slots,
      count
    };
  });

  const totals = normalizedDays.map((day) => ({ date: day.date, count: day.count }));
  return {
    locationId: context.locationId,
    year,
    month,
    days: normalizedDays,
    totals
  };
}

function buildMockAvailability(locationId, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toISO(year, month, day);
    const pseudoSeed = (day + month * 3 + locationId.length) % 6;
    const slots = [];
    for (let index = 0; index < pseudoSeed; index += 1) {
      const startHour = 8 + index * 2;
      const endHour = startHour + 2;
      slots.push({
        start: `${String(startHour).padStart(2, "0")}:00`,
        end: `${String(endHour).padStart(2, "0")}:00`,
        label: `${String(startHour).padStart(2, "0")}:00 – ${String(endHour).padStart(2, "0")}:00`
      });
    }
    days.push({
      date: iso,
      slots,
      count: slots.length
    });
  }
  return {
    locationId,
    year,
    month,
    days,
    totals: days.map((day) => ({ date: day.date, count: day.count }))
  };
}
function normalizeIsoDate(value, year, month) {
  if (typeof value === "string" && value.includes("-")) {
    return value.slice(0, 10);
  }
  const dayNumber = Number(value);
  if (!Number.isFinite(dayNumber)) {
    return toISO(year, month, 1);
  }
  return toISO(year, month, dayNumber);
}

function formatSlot(slot, index) {
  if (slot.label) return slot.label;
  if (slot.start && slot.end) {
    return `${slot.start} – ${slot.end}`;
  }
  if (slot.time) return slot.time;
  return `Option ${index + 1}`;
}

function formatMonthYear(year, month) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateLong(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric" });
}

function offsetMonth(year, month, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function toISO(year, month, day) {
  const date = new Date(year, month - 1, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isPastDate(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(iso);
  return date < today;
}

function makeCacheKey(locationId, year, month) {
  return `${locationId}:${year}-${String(month).padStart(2, "0")}`;
}

function getLocationName(locationId) {
  const match = [...locationSelect.options].find((option) => option.value === locationId);
  return match ? match.textContent : locationId;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}
