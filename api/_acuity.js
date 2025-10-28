const fs = require("fs");
const path = require("path");

const API_BASE = "https://acuityscheduling.com/api/v1/";
const DEFAULT_TZ = process.env.TZ_DEFAULT || "America/Phoenix";

const CORS_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const ACCOUNT_ENV = {
  main: {
    user: ["ACUITY_MAIN_USER_ID", "ACUITY_USER_ID"],
    key: ["ACUITY_MAIN_API_KEY", "ACUITY_API_KEY"]
  },
  parents: {
    user: ["ACUITY_PARENTS_USER_ID"],
    key: ["ACUITY_PARENTS_API_KEY"]
  }
};

const calendarCache = new Map();
const appointmentTypeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const LOCATION_FALLBACK = { main: {}, parents: {} };
const CITY_TYPES_FALLBACK = { main: {}, parents: {} };

const pickEnv = (candidates = []) => {
  for (const name of candidates) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
};

const normalizeAccount = (value) =>
  value && /parents/i.test(String(value)) ? "parents" : "main";

const pickAccount = (input) => {
  if (typeof input === "string") return normalizeAccount(input);
  if (input && typeof input === "object" && input.account != null) {
    return normalizeAccount(input.account);
  }
  return "main";
};

const normalizeLocation = (value = "") =>
  value.toString().trim().toLowerCase();

const getCredentials = (account = "main") => {
  const key = normalizeAccount(account);
  const env = ACCOUNT_ENV[key];
  const user = pickEnv(env.user);
  const apiKey = pickEnv(env.key);
  if (!user || !apiKey) {
    throw new Error("Missing Acuity credentials");
  }
  return { account: key, user, key: apiKey };
};

const authHeader = (account) => {
  const { user, key } = getCredentials(account);
  const token = Buffer.from(`${user}:${key}`, "utf8").toString("base64");
  return `Basic ${token}`;
};

const acuityFetch = async (account, endpoint, params = {}) => {
  const url = new URL(endpoint, API_BASE);
  url.searchParams.set("timezone", DEFAULT_TZ);
  for (const [name, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: authHeader(account),
      Accept: "application/json"
    }
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      body = text;
    }
  }

  if (!response.ok) {
    const error = new Error(text || `Acuity ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
};

const withCache = async (map, key, loader) => {
  const cached = map.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await loader();
  map.set(key, { value, timestamp: Date.now() });
  return value;
};

const listCalendars = (account, { forceRefresh = false } = {}) => {
  const key = normalizeAccount(account);
  if (forceRefresh) calendarCache.delete(key);
  return withCache(calendarCache, key, () => acuityFetch(key, "calendars"));
};

const listAppointmentTypes = (account, { forceRefresh = false } = {}) => {
  const key = normalizeAccount(account);
  if (forceRefresh) appointmentTypeCache.delete(key);
  return withCache(appointmentTypeCache, key, () => acuityFetch(key, "appointment-types"));
};

const loadJson = (relativePath, fallback) => {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) return fallback;
    const text = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return fallback;
    return parsed;
  } catch (error) {
    return fallback;
  }
};

const loadLocationConfig = () => {
  const parsed = loadJson("location-config.json", LOCATION_FALLBACK);
  const result = { main: {}, parents: {} };
  for (const [account, locations] of Object.entries(parsed || {})) {
    const bucket = (result[normalizeAccount(account)] = {});
    for (const [city, values] of Object.entries(locations || {})) {
      bucket[normalizeLocation(city)] = Array.isArray(values) ? values.slice() : [];
    }
  }
  return result;
};

const loadCityTypes = () => {
  const parsed = loadJson("city-types.json", CITY_TYPES_FALLBACK);
  const result = { main: {}, parents: {} };
  for (const [account, mapping] of Object.entries(parsed || {})) {
    const bucket = (result[normalizeAccount(account)] = {});
    for (const [city, typeId] of Object.entries(mapping || {})) {
      if (typeId == null) continue;
      bucket[normalizeLocation(city)] = String(typeId);
    }
  }
  return result;
};

const getConfiguredLocationIds = (account, location) => {
  const config = loadLocationConfig();
  const bucket = config[normalizeAccount(account)] || {};
  const entries = bucket[normalizeLocation(location)] || [];
  const configuredIds = [];
  const unresolved = [];
  if (!Array.isArray(entries)) return { configuredIds, unresolved };

  for (const entry of entries) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      configuredIds.push(entry);
      continue;
    }
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      if (/^\d+$/.test(trimmed)) {
        configuredIds.push(Number(trimmed));
      } else {
        unresolved.push(trimmed);
      }
      continue;
    }
    if (entry && typeof entry === "object") {
      if (entry.id != null && /^\d+$/.test(String(entry.id))) {
        configuredIds.push(Number(entry.id));
      } else if (entry.name) {
        unresolved.push(String(entry.name));
      }
      continue;
    }
  }

  return { configuredIds: Array.from(new Set(configuredIds)), unresolved };
};

const extractTypeCalendarIds = (typeInfo) => {
  if (!typeInfo) return [];
  const collected = new Set();
  const add = (value) => {
    if (value == null) return;
    if (typeof value === "number" && Number.isFinite(value)) {
      collected.add(value);
    } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      collected.add(Number(value.trim()));
    }
  };

  if (Array.isArray(typeInfo.calendarIDs)) typeInfo.calendarIDs.forEach(add);
  if (Array.isArray(typeInfo.calendarIds)) typeInfo.calendarIds.forEach(add);
  if (Array.isArray(typeInfo.calendars)) {
    typeInfo.calendars.forEach((calendar) => {
      add(calendar?.id);
      add(calendar?.calendarID);
      add(calendar?.calendarId);
    });
  }

  return Array.from(collected.values());
};

const resolveStrictCalendars = (account, location, typeInfo) => {
  const { configuredIds, unresolved } = getConfiguredLocationIds(account, location);
  const typeCalendarIds = extractTypeCalendarIds(typeInfo);
  const configuredSet = new Set(configuredIds);
  let finalIds = configuredIds.slice();
  let disallowed = [];
  let source = configuredIds.length ? "configured" : null;

  if (typeCalendarIds.length) {
    const allowed = new Set(typeCalendarIds);
    const intersection = configuredIds.filter((id) => allowed.has(id));
    disallowed = configuredIds.filter((id) => !allowed.has(id));

    if (intersection.length) {
      finalIds = intersection;
      source = "configured";
    } else if (!configuredIds.length) {
      finalIds = typeCalendarIds.slice();
      source = "type";
    } else {
      finalIds = [];
      source = "configured";
    }
  } else if (!configuredIds.length) {
    finalIds = [];
    source = null;
  }

  return {
    configuredIds: Array.from(configuredSet.values()),
    unresolved,
    typeCalendarIds: Array.from(new Set(typeCalendarIds)),
    disallowed,
    finalIds: Array.from(new Set(finalIds)),
    source
  };
};

const getTypeById = async (account, typeId) => {
  if (!typeId) return null;
  const types = await listAppointmentTypes(account).catch(() => null);
  if (!Array.isArray(types)) return null;
  const target = String(typeId);
  return types.find((type) => String(type?.id) === target) || null;
};

const applyCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const groupTimesMerge = (lists) => {
  const merged = new Map();
  if (!Array.isArray(lists)) return [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const key = entry?.time || entry?.datetime;
      if (!key) continue;
      const current = merged.get(key) || { time: key, slots: 0, sources: [] };
      const slots = Number(entry?.slots ?? 1);
      current.slots += Number.isFinite(slots) ? slots : 0;
      const source = entry?.calendarID || entry?.calendarId || entry?.calendar || "unknown";
      current.sources.push(source);
      merged.set(key, current);
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.time.localeCompare(b.time));
};

const addDaysISO = (isoDate, amount, tz = DEFAULT_TZ) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + Number(amount || 0));
  const zoned = new Date(base.toLocaleString("en-US", { timeZone: tz }));
  const yy = zoned.getFullYear();
  const mm = String(zoned.getMonth() + 1).padStart(2, "0");
  const dd = String(zoned.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const startOfMonthISO = (isoDate, tz = DEFAULT_TZ) => {
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))
    ? new Date(`${isoDate}T00:00:00Z`)
    : new Date();
  const zoned = new Date(reference.toLocaleString("en-US", { timeZone: tz }));
  zoned.setDate(1);
  const yy = zoned.getFullYear();
  const mm = String(zoned.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
};

const daysInMonth = (isoDate, tz = DEFAULT_TZ) => {
  const start = startOfMonthISO(isoDate, tz);
  const [y, m] = start.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

module.exports = {
  DEFAULT_TZ,
  CORS_ORIGINS,
  normalizeAccount,
  normalizeLocation,
  pickAccount,
  getCredentials,
  authHeader,
  acuityFetch,
  listCalendars,
  listAppointmentTypes,
  getTypeById,
  loadCityTypes,
  loadLocationConfig,
  getConfiguredLocationIds,
  resolveStrictCalendars,
  extractTypeCalendarIds,
  applyCors,
  groupTimesMerge,
  addDaysISO,
  startOfMonthISO,
  daysInMonth
};
