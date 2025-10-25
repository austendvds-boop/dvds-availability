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

module.exports = {
  DEFAULT_TZ,
  normalizeAccount,
  getCredentials,
  buildAuthHeader,
  acuityFetch,
  listCalendars,
  listAppointmentTypes,
  applyCors,
  normalizeLocation
};
