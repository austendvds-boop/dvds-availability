const DEFAULT_TZ = process.env.TZ_DEFAULT || "America/Phoenix";
const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

const ACCOUNT_KEYS = {
  main: {
    user: () => process.env.ACUITY_MAIN_USER_ID || process.env.ACUITY_USER_ID,
    key: () => process.env.ACUITY_MAIN_API_KEY || process.env.ACUITY_API_KEY
  },
  parents: {
    user: () => process.env.ACUITY_PARENTS_USER_ID,
    key: () => process.env.ACUITY_PARENTS_API_KEY
  }
};

const calendarCache = new Map();

const getCredentials = (account = "main") => {
  const key = account === "parents" ? "parents" : "main";
  const resolver = ACCOUNT_KEYS[key];
  return {
    user: resolver.user(),
    key: resolver.key()
  };
};

const buildAuthHeader = (account) => {
  const { user, key } = getCredentials(account);
  if (!user || !key) {
    throw new Error("Missing Acuity credentials");
  }
  const encoded = Buffer.from(`${user}:${key}`, "utf8").toString("base64");
  return "Basic " + encoded;
};

const fetchCalendarsFromAcuity = async (account) => {
  const auth = buildAuthHeader(account);
  const url = new URL("https://acuityscheduling.com/api/v1/calendars");
  url.searchParams.set("timezone", DEFAULT_TZ);

  const response = await fetch(url, { headers: { Authorization: auth } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Acuity ${response.status}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Invalid calendars payload");
  }

  if (!Array.isArray(data)) {
    throw new Error("Calendars payload is not an array");
  }

  return data;
};

const getCalendars = async (account, { forceRefresh = false } = {}) => {
  const key = account === "parents" ? "parents" : "main";
  const cached = calendarCache.get(key);
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.timestamp < CALENDAR_CACHE_TTL_MS
  ) {
    return cached.calendars;
  }

  const calendars = await fetchCalendarsFromAcuity(key);
  calendarCache.set(key, { calendars, timestamp: Date.now() });
  return calendars;
};

module.exports = {
  DEFAULT_TZ,
  getCredentials,
  getCalendars,
  buildAuthHeader
};
