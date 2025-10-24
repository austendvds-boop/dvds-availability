const { URL } = require("url");

const DEFAULT_TZ = process.env.TZ_DEFAULT || "America/Phoenix";
const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCOUNTS = ["main", "parents"];

const normalizeName = (value = "") => value.trim().toLowerCase();
const normalizeCompact = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const credentialForAccount = (account) => {
  if (account === "parents") {
    return {
      user: process.env.ACUITY_PARENTS_USER_ID,
      key: process.env.ACUITY_PARENTS_API_KEY
    };
  }
  return {
    user: process.env.ACUITY_MAIN_USER_ID || process.env.ACUITY_USER_ID,
    key: process.env.ACUITY_MAIN_API_KEY || process.env.ACUITY_API_KEY
  };
};

const calendarCache = new Map();

const fetchCalendarsFromAcuity = async (account) => {
  const { user, key } = credentialForAccount(account);
  if (!user || !key) {
    throw new Error("Missing Acuity credentials");
  }

  const url = new URL("https://acuityscheduling.com/api/v1/calendars");
  url.searchParams.set("timezone", DEFAULT_TZ);

  const auth = "Basic " + Buffer.from(`${user}:${key}`, "utf8").toString("base64");

  const response = await fetch(url, { headers: { Authorization: auth } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Acuity ${response.status}`);
  }

  let calendars = [];
  try {
    calendars = JSON.parse(text);
  } catch (error) {
    throw new Error("Unexpected calendars payload");
  }

  if (!Array.isArray(calendars)) {
    throw new Error("Calendars response is not an array");
  }

  return calendars;
};

const getCalendars = async (account, { forceRefresh = false } = {}) => {
  const cached = calendarCache.get(account);
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.timestamp < CALENDAR_CACHE_TTL_MS
  ) {
    return cached.data;
  }

  const calendars = await fetchCalendarsFromAcuity(account);
  const mapping = new Map();
  const mappingById = new Map();
  const mappingCompact = new Map();
  for (const calendar of calendars) {
    if (calendar) {
      if (calendar.name) {
        const normalized = normalizeName(calendar.name);
        if (normalized) {
          mapping.set(normalized, calendar);
        }
        const compact = normalizeCompact(calendar.name);
        if (compact && !mappingCompact.has(compact)) {
          mappingCompact.set(compact, calendar);
        }
      }
      if (calendar.id != null) {
        mappingById.set(Number(calendar.id), calendar);
      }
    }
  }

  const cacheEntry = {
    timestamp: Date.now(),
    data: { calendars, mapping, mappingById, mappingCompact }
  };
  calendarCache.set(account, cacheEntry);
  return cacheEntry.data;
};

const resolveCalendarByLabel = async (account, label) => {
  if (!label) return null;
  const normalized = normalizeName(label);
  const compactLabel = normalizeCompact(label);
  const cached = await getCalendars(account);
  const attemptMatch = (dataset) => {
    if (!dataset) return null;
    if (normalized && dataset.mapping.has(normalized)) {
      return dataset.mapping.get(normalized);
    }
    if (compactLabel && dataset.mappingCompact?.has(compactLabel)) {
      return dataset.mappingCompact.get(compactLabel);
    }

    for (const calendar of dataset.calendars || []) {
      const name = calendar?.name;
      if (!name) continue;
      const normalizedName = normalizeName(name);
      if (normalized && normalizedName === normalized) {
        return calendar;
      }
      if (normalized && normalizedName.includes(normalized)) {
        return calendar;
      }
      const compactName = normalizeCompact(name);
      if (
        compactLabel &&
        compactName &&
        (compactName === compactLabel ||
          compactName.includes(compactLabel) ||
          compactLabel.includes(compactName))
      ) {
        return calendar;
      }
    }
    return null;
  };

  const cachedMatch = attemptMatch(cached);
  if (cachedMatch) {
    return cachedMatch;
  }

  const refreshed = await getCalendars(account, { forceRefresh: true });
  return attemptMatch(refreshed);
};

const resolveCalendarById = async (calendarId) => {
  if (typeof calendarId !== "number" || Number.isNaN(calendarId)) {
    return null;
  }

  for (const account of ACCOUNTS) {
    try {
      const cached = await getCalendars(account);
      if (cached.mappingById.has(calendarId)) {
        return { account, calendar: cached.mappingById.get(calendarId) };
      }
    } catch (error) {
      // ignore and try next account
    }
  }

  for (const account of ACCOUNTS) {
    try {
      const refreshed = await getCalendars(account, { forceRefresh: true });
      if (refreshed.mappingById.has(calendarId)) {
        return { account, calendar: refreshed.mappingById.get(calendarId) };
      }
    } catch (error) {
      // ignore and continue
    }
  }

  return null;
};

const getCalendarIdForLabel = async (account, label) => {
  const calendar = await resolveCalendarByLabel(account, label);
  return calendar && typeof calendar.id === "number" ? Number(calendar.id) : null;
};

module.exports = {
  DEFAULT_TZ,
  credentialForAccount,
  getCalendars,
  getCalendarIdForLabel,
  resolveCalendarById
};
