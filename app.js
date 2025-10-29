const FEATURE_PACKAGES = true;
const AUTO_JUMP_NEXT_AVAILABLE = true;
const AUTO_JUMP_LOOKAHEAD = 6;
const DEBUG = false;

const BRAND_COLOR = "#f4511e";
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
});
const DAY_NAME_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const DAY_FULL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const today = new Date();
today.setHours(0, 0, 0, 0);

const monthCache = new Map();
const monthPromiseCache = new Map();
let currentPrimaryRequest = null;

const state = {
  location: null,
  visibleDate: startOfMonth(new Date()),
  selectedDateKey: null,
  status: "Select a location to view availability.",
  statusChip: "",
  jumpNotice: "",
  packagesConfig: null,
  stepActive: 1,
};

const refs = {};

document.addEventListener("DOMContentLoaded", () => {
  injectStyles();
  buildLayout();
  initialize();
});

async function initialize() {
  await loadPackagesConfig();
  await loadLocations();
  updatePackagesPanel();
  updateSteps();
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light dark;
    }

    body {
      font-family: "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0;
      background: #f7f7f7;
      color: #222;
    }

    body.dark {
      background: #121212;
      color: #f1f1f1;
    }

    a {
      color: ${BRAND_COLOR};
    }

    .app-shell {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }

    .app-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .app-title {
      font-size: clamp(24px, 4vw, 36px);
      margin: 0;
      font-weight: 700;
    }

    .app-subtitle {
      margin: 0;
      color: #666;
      font-size: 0.95rem;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }

    .controls label {
      font-weight: 600;
      font-size: 0.95rem;
      color: #444;
    }

    .controls select {
      min-width: 220px;
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 1rem;
      background: #fff;
      color: inherit;
    }

    .steps-header {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: baseline;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      padding-bottom: 8px;
    }

    .step-item {
      position: relative;
      padding-bottom: 6px;
      font-weight: 600;
      color: #666;
    }

    .step-item.is-active {
      color: ${BRAND_COLOR};
    }

    .step-item.is-active::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: ${BRAND_COLOR};
      border-radius: 3px 3px 0 0;
    }

    .content-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
    }

    @media (min-width: 960px) {
      .content-layout {
        grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
        align-items: start;
      }
    }

    .calendar-panel {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .month-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .month-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .nav-button {
      appearance: none;
      border: none;
      background: transparent;
      font-size: 1.4rem;
      cursor: pointer;
      color: ${BRAND_COLOR};
      padding: 4px 8px;
      border-radius: 8px;
      transition: background 0.2s ease;
    }

    .nav-button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .nav-button:not(:disabled):hover {
      background: rgba(244, 81, 30, 0.12);
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }

    .day-name {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #888;
      text-align: center;
      padding-bottom: 4px;
    }

    .calendar-day {
      position: relative;
      min-height: 76px;
      border-radius: 12px;
      padding: 8px;
      background: #f9f9f9;
      color: inherit;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .calendar-day:hover {
      background: #fff3ec;
    }

    .calendar-day.is-empty {
      color: #999;
      background: #fafafa;
    }

    .calendar-day.is-past {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    .calendar-day.is-selected {
      border-color: ${BRAND_COLOR};
      background: rgba(244, 81, 30, 0.12);
      box-shadow: inset 0 0 0 1px ${BRAND_COLOR};
    }

    .day-number {
      font-weight: 600;
      font-size: 1rem;
    }

    .availability-count {
      align-self: flex-start;
      background: rgba(24, 160, 88, 0.12);
      color: #188652;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 999px;
    }

    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 0.9rem;
    }

    .status-row strong {
      color: #555;
    }

    .status-chip {
      background: rgba(244, 81, 30, 0.12);
      color: ${BRAND_COLOR};
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
    }

    .status-chip.is-error {
      background: rgba(220, 38, 38, 0.12);
      color: #dc2626;
    }

    .day-details {
      border-top: 1px solid rgba(0,0,0,0.08);
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .day-details h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .slots-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .slot-item {
      background: #f1f5f9;
      border-radius: 10px;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.95rem;
    }

    .slot-item strong {
      color: ${BRAND_COLOR};
      font-weight: 600;
    }

    .packages-panel {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .packages-panel.is-hidden {
      display: none;
    }

    .packages-panel h2 {
      margin: 0;
      font-size: 1.1rem;
    }

    .packages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .package-button {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      border: none;
      background: rgba(244, 81, 30, 0.12);
      color: ${BRAND_COLOR};
      border-radius: 12px;
      padding: 12px;
      text-align: left;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
    }

    .package-button:visited {
      color: ${BRAND_COLOR};
    }

    .package-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(244, 81, 30, 0.16);
    }

    .package-button:focus-visible {
      outline: 2px solid ${BRAND_COLOR};
      outline-offset: 2px;
    }

    .package-button.is-disabled {
      opacity: 0.6;
      pointer-events: none;
      cursor: default;
    }

    .packages-empty {
      color: #777;
      font-size: 0.9rem;
    }

    .notice {
      background: rgba(15, 23, 42, 0.06);
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 0.85rem;
      color: #374151;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  `;
  document.head.appendChild(style);
}

function buildLayout() {
  const root = document.getElementById("app-root");
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const header = document.createElement("header");
  header.className = "app-header";

  const title = document.createElement("h1");
  title.className = "app-title";
  title.textContent = "Behind-the-Wheel Availability";

  const subtitle = document.createElement("p");
  subtitle.className = "app-subtitle";
  subtitle.textContent = "Pick a location to find open drive times and packages.";

  header.appendChild(title);
  header.appendChild(subtitle);

  const controls = document.createElement("div");
  controls.className = "controls";

  const locationLabel = document.createElement("label");
  locationLabel.setAttribute("for", "location-select");
  locationLabel.textContent = "Choose a location:";

  const select = document.createElement("select");
  select.id = "location-select";
  select.innerHTML = `<option value="">Select...</option>`;
  select.addEventListener("change", onLocationChange);

  controls.appendChild(locationLabel);
  controls.appendChild(select);

  const steps = document.createElement("div");
  steps.className = "steps-header";
  steps.innerHTML = `
    <span class="step-item step-1 is-active" data-step="1">Step 1: Check availability</span>
    ${
      FEATURE_PACKAGES
        ? '<span class="step-item step-2" data-step="2">Step 2: Choose a package</span>'
        : ""
    }
  `;

  const layout = document.createElement("div");
  layout.className = "content-layout";

  const calendarPanel = document.createElement("section");
  calendarPanel.className = "calendar-panel";

  const monthNav = document.createElement("div");
  monthNav.className = "month-nav";

  const prevBtn = document.createElement("button");
  prevBtn.className = "nav-button";
  prevBtn.innerHTML = "&#x25C0;";
  prevBtn.addEventListener("click", () => changeMonth(-1));

  const monthTitle = document.createElement("h2");
  monthTitle.className = "month-title";
  monthTitle.textContent = formatMonth(state.visibleDate);

  const nextBtn = document.createElement("button");
  nextBtn.className = "nav-button";
  nextBtn.innerHTML = "&#x25B6;";
  nextBtn.addEventListener("click", () => changeMonth(1));

  monthNav.append(prevBtn, monthTitle, nextBtn);

  const statusRow = document.createElement("div");
  statusRow.className = "status-row";

  const statusLabel = document.createElement("strong");
  statusLabel.textContent = "Status:";

  const statusMessage = document.createElement("span");
  statusMessage.className = "status-message";
  statusMessage.textContent = state.status;

  const statusChip = document.createElement("span");
  statusChip.className = "status-chip";
  statusChip.hidden = true;

  statusRow.append(statusLabel, statusMessage, statusChip);

  const calendarGrid = document.createElement("div");
  calendarGrid.className = "calendar-grid";
  const dayNames = getDayNames();
  dayNames.forEach((name) => {
    const span = document.createElement("div");
    span.className = "day-name";
    span.textContent = name;
    calendarGrid.appendChild(span);
  });

  const daysContainer = document.createElement("div");
  daysContainer.className = "calendar-grid calendar-days";

  const dayDetails = document.createElement("div");
  dayDetails.className = "day-details";
  dayDetails.innerHTML = `
    <h3>Select a day to view available times</h3>
    <p class="packages-empty">Time slots will appear here once you pick a day.</p>
  `;

  calendarPanel.append(monthNav, statusRow, calendarGrid, daysContainer, dayDetails);

  const packagesPanel = document.createElement("aside");
  packagesPanel.className = "packages-panel";
  if (!FEATURE_PACKAGES) {
    packagesPanel.classList.add("is-hidden");
  }

  packagesPanel.innerHTML = `
    <h2>Step 2 — Choose your package</h2>
    <div class="packages-empty">Select a location to view packages.</div>
  `;

  layout.append(calendarPanel, packagesPanel);

  shell.append(header, controls, steps, layout);
  root.appendChild(shell);

  refs.locationSelect = select;
  refs.steps = steps;
  refs.monthTitle = monthTitle;
  refs.prevBtn = prevBtn;
  refs.nextBtn = nextBtn;
  refs.statusMessage = statusMessage;
  refs.statusChip = statusChip;
  refs.daysContainer = daysContainer;
  refs.dayDetails = dayDetails;
  refs.packagesPanel = packagesPanel;
}

async function loadPackagesConfig() {
  try {
    const response = await fetch("./packages.config.json", { cache: "reload" });
    if (!response.ok) {
      throw new Error(`Failed to load packages config (${response.status})`);
    }
    const json = await response.json();
    state.packagesConfig = json;
  } catch (error) {
    if (DEBUG && console?.error) {
      console.error("Unable to load packages config", error);
    }
    state.packagesConfig = {};
  }
}

async function loadLocations() {
  const select = refs.locationSelect;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select...";
  select.appendChild(placeholder);

  let locations = [];
  try {
    const res = await fetch("/api/locations");
    if (!res.ok) {
      throw new Error(`Locations request failed (${res.status})`);
    }
    const json = await res.json();
    if (Array.isArray(json)) {
      locations = json;
    } else if (Array.isArray(json?.locations)) {
      locations = json.locations;
    }
  } catch (error) {
    const configKeys = state.packagesConfig
      ? Object.keys(state.packagesConfig)
      : [];
    locations = configKeys.sort();
  }

  locations.forEach((loc) => {
    const option = document.createElement("option");
    if (typeof loc === "string") {
      option.value = loc;
      option.textContent = formatLocationLabel(loc);
    } else if (loc && typeof loc === "object") {
      option.value = loc.id || loc.key || loc.value || "";
      option.textContent = loc.label || formatLocationLabel(option.value);
    }
    if (option.value) {
      select.appendChild(option);
    }
  });
}

function onLocationChange(event) {
  const newLocation = event.target.value;
  state.location = newLocation || null;
  state.selectedDateKey = null;
  state.visibleDate = startOfMonth(new Date());
  monthCache.clear();
  monthPromiseCache.clear();
  if (currentPrimaryRequest?.controller) {
    currentPrimaryRequest.controller.abort();
  }
  currentPrimaryRequest = null;
  updateStatus(
    state.location
      ? "Loading availability..."
      : "Select a location to view availability."
  );
  if (refs.statusChip) {
    refs.statusChip.hidden = true;
    refs.statusChip.classList.remove("is-error");
  }
  updatePackagesPanel();
  updateSteps();
  renderCalendarSkeleton();
  if (state.location) {
    loadVisibleMonth(true).catch((error) => {
      if (error?.name === "AbortError") {
        return;
      }
      if (DEBUG && console?.error) {
        console.error(error);
      }
      showErrorStatus("Unable to load availability. Please try again.");
    });
  }
}

function renderCalendarSkeleton() {
  refs.monthTitle.textContent = formatMonth(state.visibleDate);
  refs.prevBtn.disabled = !state.location;
  refs.nextBtn.disabled = !state.location;
  clearChildren(refs.daysContainer);
  if (!state.location) {
    const message = document.createElement("p");
    message.className = "packages-empty";
    message.textContent = "Select a location to start checking availability.";
    refs.daysContainer.appendChild(message);
  } else {
    const shimmer = document.createElement("div");
    shimmer.className = "packages-empty";
    shimmer.textContent = "Loading calendar...";
    refs.daysContainer.appendChild(shimmer);
  }
}

async function loadVisibleMonth(allowJump = false) {
  const location = state.location;
  if (!location) return;

  const targetDate = state.visibleDate;
  refs.monthTitle.textContent = formatMonth(targetDate);
  refs.prevBtn.disabled = false;
  refs.nextBtn.disabled = false;

  try {
    updateStatus("Loading availability...");
    const monthData = await fetchMonth(location, targetDate, { primary: true });
    if (!monthData) {
      updateStatus("Availability request was cancelled.");
      return;
    }
    updateStatus("Availability up to date.");
    renderDays(monthData, targetDate);
    if (allowJump) {
      await maybeAutoJump(monthData, targetDate);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      updateStatus("Availability request was cancelled.");
      return;
    }
    if (DEBUG && console?.error) {
      console.error(error);
    }
    showErrorStatus("Unable to load availability. Please try again.");
  }
}

async function fetchMonth(location, date, options = {}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const key = monthKey(location, year, month);
  if (monthCache.has(key)) {
    return monthCache.get(key);
  }
  if (monthPromiseCache.has(key)) {
    return monthPromiseCache.get(key);
  }

  const { primary = false } = options;

  if (primary) {
    if (currentPrimaryRequest?.controller) {
      currentPrimaryRequest.controller.abort();
    }
  }

  const controller = new AbortController();
  const signal = controller.signal;

  if (primary) {
    currentPrimaryRequest = { key, controller };
  }

  const base = window.location?.href || window.location?.origin || "/";
  const url = new URL("./api/availability", base);
  url.searchParams.set("location", location);
  url.searchParams.set("year", String(year));
  url.searchParams.set("month", String(month + 1));

  const requestPromise = fetch(url.toString(), { signal })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Availability request failed (${res.status})`);
      }
      return res.json();
    })
    .then((json) => normalizeMonthResponse(json, year, month))
    .then((normalized) => {
      monthCache.set(key, normalized);
      return normalized;
    })
    .finally(() => {
      if (primary && currentPrimaryRequest?.key === key) {
        currentPrimaryRequest = null;
      }
      monthPromiseCache.delete(key);
    })
    .catch((error) => {
      if (error?.name === "AbortError") {
        return null;
      }
      throw error;
    });

  monthPromiseCache.set(key, requestPromise);
  return requestPromise;
}

function normalizeMonthResponse(json, year, month) {
  const days = Array.isArray(json?.days)
    ? json.days
    : Array.isArray(json?.data?.days)
    ? json.data.days
    : [];

  const totals = days.map((day) => {
    const date = parseDate(day.date) || new Date(year, month, day.day || day.dateNumber || 1);
    const slots = Array.isArray(day.slots)
      ? day.slots
      : Array.isArray(day.times)
      ? day.times
      : [];
    const count = typeof day.count === "number"
      ? day.count
      : typeof day.available === "number"
      ? day.available
      : Array.isArray(slots)
      ? slots.length
      : 0;

    return {
      date,
      dateKey: formatDateKey(date),
      count,
      slots,
      raw: day,
    };
  });

  const totalsMap = new Map();
  totals.forEach((entry) => {
    totalsMap.set(entry.dateKey, entry);
  });

  return {
    locationKey: json?.location || json?.locationKey || json?.key || null,
    year,
    month,
    totals,
    totalsMap,
    raw: json,
  };
}

function renderDays(monthData, targetDate) {
  const { totals, totalsMap } = monthData;
  const container = refs.daysContainer;
  clearChildren(container);

  const baseDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const startWeekday = baseDate.getDay();
  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();

  // Insert blank cells to align the first day
  for (let i = 0; i < startWeekday; i += 1) {
    const filler = document.createElement("div");
    filler.className = "calendar-day is-empty";
    filler.setAttribute("aria-hidden", "true");
    filler.style.visibility = "hidden";
    container.appendChild(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day);
    const key = formatDateKey(cellDate);
    const entry = totalsMap.get(key) || {
      date: cellDate,
      dateKey: key,
      count: 0,
      slots: [],
    };
    const isPast = cellDate < today;
    const isSelected = state.selectedDateKey === key;
    const isEmpty = entry.count === 0;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-day";
    if (isPast) {
      cell.classList.add("is-past");
    }
    if (isEmpty) {
      cell.classList.add("is-empty");
    }
    if (isSelected) {
      cell.classList.add("is-selected");
    }
    cell.dataset.dateKey = key;
    cell.disabled = isPast;

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(day);

    cell.appendChild(number);

    if (entry.count > 0) {
      const badge = document.createElement("span");
      badge.className = "availability-count";
      badge.textContent = `×${entry.count}`;
      cell.appendChild(badge);
    }

    cell.addEventListener("click", () => onDaySelected(entry));

    container.appendChild(cell);
  }

  // Reset details if selected date not in this month
  if (!totalsMap.has(state.selectedDateKey || "")) {
    state.selectedDateKey = null;
    renderDayDetails(null);
  }
}

function onDaySelected(entry) {
  state.selectedDateKey = entry?.dateKey || null;
  renderDayDetails(entry);
  updateSteps();
  const cells = refs.daysContainer.querySelectorAll(".calendar-day");
  cells.forEach((cell) => {
    cell.classList.toggle("is-selected", cell.dataset.dateKey === state.selectedDateKey);
  });
}

function renderDayDetails(entry) {
  const container = refs.dayDetails;
  if (!entry) {
    container.innerHTML = `
      <h3>Select a day to view available times</h3>
      <p class="packages-empty">Time slots will appear here once you pick a day.</p>
    `;
    return;
  }

  const slots = Array.isArray(entry.slots) ? entry.slots : [];
  container.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = DAY_FULL_FORMATTER.format(entry.date);

  const summary = document.createElement("p");
  summary.textContent =
    slots.length > 0
      ? `${slots.length} time slot${slots.length === 1 ? "" : "s"} available`
      : "No drive times available. Check back soon.";

  container.append(heading, summary);

  if (slots.length > 0) {
    const list = document.createElement("div");
    list.className = "slots-list";
    slots.forEach((slot) => {
      const item = document.createElement("div");
      item.className = "slot-item";
      const start = parseDate(slot.start) || parseDate(slot.time) || entry.date;
      const end = parseDate(slot.end) || null;
      const timeRange = end
        ? `${TIME_FORMATTER.format(start)} – ${TIME_FORMATTER.format(end)}`
        : TIME_FORMATTER.format(start);
      const name = slot.label || slot.name || "Available";
      item.innerHTML = `<strong>${timeRange}</strong><span>${name}</span>`;
      list.appendChild(item);
    });
    container.appendChild(list);
  }
}

async function maybeAutoJump(monthData, baseDate) {
  if (!AUTO_JUMP_NEXT_AVAILABLE) {
    refs.statusChip.hidden = true;
    return;
  }

  const hasAvailability = monthData.totals.some((item) => item.count > 0);
  if (hasAvailability) {
    refs.statusChip.hidden = true;
    return;
  }

  refs.statusChip.hidden = false;
  refs.statusChip.classList.remove("is-error");
  refs.statusChip.textContent = "Scanning next months for availability...";

  const location = state.location;
  const lookaheadDates = [];
  for (let offset = 1; offset <= AUTO_JUMP_LOOKAHEAD; offset += 1) {
    lookaheadDates.push(addMonths(baseDate, offset));
  }

  const pendingEntries = lookaheadDates.map((date, idx) => ({
    idx,
    date,
    promise: fetchMonth(location, date).then((data) => ({ data, idx })).catch((error) => ({ error, idx })),
  }));

  while (pendingEntries.length > 0) {
    const raceResult = await Promise.race(
      pendingEntries.map((entry) => entry.promise)
    );

    const entryIndex = pendingEntries.findIndex((item) => item.idx === raceResult.idx);
    if (entryIndex >= 0) {
      pendingEntries.splice(entryIndex, 1);
    }

    if (raceResult?.error) {
      if (DEBUG && console?.warn) {
        console.warn("Availability prefetch failed", raceResult.error);
      }
      continue;
    }

    const { data } = raceResult;
    if (!data) {
      continue;
    }
    const summaryHasDays = data.totals.some((item) => item.count > 0);
    if (summaryHasDays) {
      if (state.location !== location) {
        return;
      }
      state.visibleDate = startOfMonth(raceResult.date);
      refs.monthTitle.textContent = formatMonth(state.visibleDate);
      renderDays(data, state.visibleDate);
      state.selectedDateKey = null;
      updateSteps();
      refs.statusChip.textContent = `Jumped to next available month: ${DATE_FORMATTER.format(
        state.visibleDate
      )}`;
      console.info?.(
        "Auto-jump to next available month",
        DATE_FORMATTER.format(state.visibleDate)
      );
      return;
    }
  }

  refs.statusChip.classList.add("is-error");
  refs.statusChip.textContent = `No availability found in the next ${AUTO_JUMP_LOOKAHEAD} month${
    AUTO_JUMP_LOOKAHEAD === 1 ? "" : "s"
  }.`;
}

function changeMonth(delta) {
  if (!state.location) return;
  const newDate = addMonths(state.visibleDate, delta);
  state.visibleDate = newDate;
  state.selectedDateKey = null;
  updateSteps();
  renderCalendarSkeleton();
  loadVisibleMonth(false).catch((error) => {
    if (error?.name === "AbortError") {
      return;
    }
    if (DEBUG && console?.error) {
      console.error(error);
    }
    showErrorStatus("Unable to load availability. Please try again.");
  });
}

function updateStatus(message) {
  state.status = message;
  if (refs.statusMessage) {
    refs.statusMessage.textContent = message;
  }
}

function showErrorStatus(message) {
  updateStatus(message);
  refs.statusChip.hidden = false;
  refs.statusChip.classList.add("is-error");
  refs.statusChip.textContent = message;
}

function updateSteps() {
  if (!refs.steps) return;
  const hasStepTwo = Boolean(refs.steps.querySelector('[data-step="2"]'));
  const activeStep = hasStepTwo && state.selectedDateKey ? 2 : 1;
  state.stepActive = activeStep;
  const stepItems = refs.steps.querySelectorAll(".step-item");
  stepItems.forEach((item) => {
    const isActive = Number(item.dataset.step) === activeStep;
    item.classList.toggle("is-active", isActive);
  });
}

function updatePackagesPanel() {
  if (!FEATURE_PACKAGES || !refs.packagesPanel) {
    return;
  }
  const panel = refs.packagesPanel;
  clearChildren(panel);

  const header = document.createElement("h2");
  header.textContent = "Step 2 — Choose your package";
  panel.appendChild(header);

  if (!state.location) {
    const message = document.createElement("div");
    message.className = "packages-empty";
    message.textContent = "Select a location to view packages.";
    panel.appendChild(message);
    return;
  }

  const config = state.packagesConfig || {};
  const packages = config[state.location];

  if (state.location === "casagrande") {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "Casa Grande currently offers the Early Bird package only.";
    panel.appendChild(notice);
  }

  if (!Array.isArray(packages) || packages.length === 0) {
    const message = document.createElement("div");
    message.className = "packages-empty";
    message.textContent = "Packages coming soon.";
    panel.appendChild(message);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "packages-grid";

  packages.forEach((pkg) => {
    const link = document.createElement("a");
    link.className = "package-button";
    link.textContent = pkg.label;
    if (pkg.url) {
      link.href = pkg.url;
      link.target = "_blank";
      link.rel = "noopener";
    } else {
      link.href = "#";
      link.setAttribute("role", "button");
      link.setAttribute("aria-disabled", "true");
      link.classList.add("is-disabled");
    }
    grid.appendChild(link);
  });

  panel.appendChild(grid);
}

function getDayNames() {
  const baseDate = new Date(2023, 0, 1);
  const names = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(baseDate, i);
    names.push(DAY_NAME_FORMATTER.format(date));
  }
  return names;
}

function formatLocationLabel(value) {
  if (!value) return "";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function startOfMonth(date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addMonths(date, count) {
  const result = new Date(date.getFullYear(), date.getMonth() + count, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

function monthKey(location, year, month) {
  return `${location}::${year}-${month}`;
}

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function formatMonth(date) {
  return DATE_FORMATTER.format(date);
}

function formatDateKey(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

function pad(value) {
  return String(value).padStart(2, "0");
}
