const fs = require("fs");
const path = require("path");

const API_BASE = "https://acuityscheduling.com/api/v1/";
const DEFAULT_TZ = process.env.TZ_DEFAULT || "America/Phoenix";

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

const CORS_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const calendarCache = new Map();
const appointmentTypeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const TTL_MS = CACHE_TTL_MS;

const pickEnv = (names = []) => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
};

const normalizeAccount = (value) => (value && /parents/i.test(String(value)) ? "parents" : "main");

const getCredentials = (account = "main") => {
  const key = normalizeAccount(account);
  const config = ACCOUNT_ENV[key];
  const user = pickEnv(config.user);
  const apiKey = pickEnv(config.key);
  return { account: key, user, key: apiKey };
};

const buildAuthHeader = (account) => {
  const { user, key } = getCredentials(account);
  if (!user || !key) {
    throw new Error("Missing Acuity credentials");
  }
  const token = Buffer.from(`${user}:${key}`, "utf8").toString("base64");
  return `Basic ${token}`;
};

const acuityFetch = async (account, path, params = {}) => {
  const auth = buildAuthHeader(account);
  const url = new URL(path, API_BASE);
  url.searchParams.set("timezone", DEFAULT_TZ);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: auth,
      Accept: "application/json"
    }
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    const err = new Error(text || `Acuity ${response.status}`);
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
};

const withCache = async (cache, key, loader) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await loader();
  cache.set(key, { value, timestamp: Date.now() });
  return value;
};

const listCalendars = (account, { forceRefresh = false } = {}) => {
  const key = normalizeAccount(account);
  if (forceRefresh) {
    calendarCache.delete(key);
  }
  return withCache(calendarCache, key, () => acuityFetch(key, "calendars"));
};

const listAppointmentTypes = (account, { forceRefresh = false } = {}) => {
  const key = normalizeAccount(account);
  if (forceRefresh) {
    appointmentTypeCache.delete(key);
  }
  return withCache(appointmentTypeCache, key, () => acuityFetch(key, "appointment-types"));
};

const CITY_TYPES_DEFAULT = { main: {}, parents: {} };

const safeParse = (text) => {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : CITY_TYPES_DEFAULT;
  } catch (error) {
    return CITY_TYPES_DEFAULT;
  }
};

const loadCityTypes = () => {
  const filePath = path.join(process.cwd(), "city-types.json");
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = safeParse(text);
    const normalised = { main: {}, parents: {} };
    for (const account of Object.keys(parsed || {})) {
      const normalizedAccount = normalizeAccount(account);
      normalised[normalizedAccount] = normalised[normalizedAccount] || {};
      const cities = parsed[account] || {};
      for (const [city, typeId] of Object.entries(cities)) {
        const key = normalizeLocation(city);
        if (!key) continue;
        const value = typeId != null ? String(typeId) : null;
        if (value) {
          normalised[normalizedAccount][key] = value;
          const compact = key.replace(/\s+/g, "");
          if (!normalised[normalizedAccount][compact]) {
            normalised[normalizedAccount][compact] = value;
          }
        }
      }
    }
    return normalised;
  } catch (error) {
    return CITY_TYPES_DEFAULT;
  }
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

const normalizeLocation = (value = "") => value.toString().trim().toLowerCase();

const groupTimesMerge = (arrays) => {
  const merged = new Map();
  if (!Array.isArray(arrays)) return [];

  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const key = entry?.time || entry?.datetime;
      if (!key) continue;
      const prev = merged.get(key) || { time: key, slots: 0, sources: [] };
      const slots = Number(entry?.slots ?? 1);
      prev.slots += Number.isFinite(slots) ? slots : 0;
      const sourceId = entry?.calendarID || entry?.calendarId || entry?.calendar || "unknown";
      prev.sources.push(sourceId);
      merged.set(key, prev);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.time.localeCompare(b.time));
};

const addDaysISO = (isoDate, amount, tz = DEFAULT_TZ) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) {
    return null;
  }

  const [year, month, day] = isoDate.split("-").map(Number);
  const utcBase = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(amount)) amount = 0;
  utcBase.setUTCDate(utcBase.getUTCDate() + Number(amount));

  const zoned = new Date(utcBase.toLocaleString("en-US", { timeZone: tz }));
  const yyyy = zoned.getFullYear();
  const mm = String(zoned.getMonth() + 1).padStart(2, "0");
  const dd = String(zoned.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

module.exports = {
  DEFAULT_TZ,
  normalizeAccount,
  getCredentials,
  buildAuthHeader,
  acuityFetch,
  listCalendars,
  listAppointmentTypes,
  applyCors,
  normalizeLocation,
  groupTimesMerge,
  addDaysISO,
  TTL_MS,
  CORS_ORIGINS,
  loadCityTypes,
  getTypeById
};
