const { randomUUID } = require("crypto");

const { DEFAULT_TZ, getCredentials, getCalendars, buildAuthHeader } = require("../lib/acuity-client");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

// TODO: Replace `calendarId` values with the numeric IDs returned by the
// `/api/calendars` endpoint for each account so lookups avoid hitting Acuity on
// every request.
const CALENDAR_IDS = {
  main: {
    anthem: { label: "Anthem", calendarId: null },
    ahwatukee: { label: "Ahwatukee", calendarId: null },
    apachejunction: { label: "Apache Junction", calendarId: null },
    chandler: { label: "Chandler", calendarId: null },
    gilbert: { label: "Gilbert", calendarId: null },
    mesa: { label: "Mesa", calendarId: null },
    scottsdale: { label: "Scottsdale", calendarId: null },
    tempe: { label: "Tempe", calendarId: null }
  },
  parents: {
    parents: { label: "Parents", calendarId: null }
  }
};

const isoDateInTz = (tz) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

const normalizeLocation = (value = "") => value.toString().trim().toLowerCase();

const parseCalendarId = (value) => {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const findCalendarByLabel = (calendars, label) => {
  if (!Array.isArray(calendars)) return null;
  const target = normalizeLocation(label);
  return (
    calendars.find((calendar) => {
      const name = normalizeLocation(calendar?.name || "");
      return name === target || name.includes(target);
    }) || null
  );
};

const ensureCalendarId = async (account, locationKey) => {
  const accountCalendars = CALENDAR_IDS[account];
  if (!accountCalendars) {
    return null;
  }
  const entry = accountCalendars[locationKey];
  if (!entry) {
    return null;
  }
  if (parseCalendarId(entry.calendarId) != null) {
    return parseCalendarId(entry.calendarId);
  }
  if (!entry.label) {
    return null;
  }

  const calendars = await getCalendars(account).catch((error) => {
    throw new Error(error?.message || "Unable to load calendars");
  });
  const match = findCalendarByLabel(calendars, entry.label);
  if (match && parseCalendarId(match.id) != null) {
    entry.calendarId = parseCalendarId(match.id);
    return entry.calendarId;
  }
  return null;
};

const resolveAccount = (locationKey) =>
  /parents/i.test(locationKey || "") ? "parents" : "main";

const respondCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const handler = async (req, res) => {
  respondCors(req, res);

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  const send = (status, payload) => res.status(status).json({ requestId, ...payload });
  const logError = (message, meta = {}) => {
    console.error(`[availability] ${message}`, { requestId, ...meta });
  };

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(405, { ok: false, error: "Method not allowed" });
  }

  const { location, appointmentTypeId, date, calendarId, calendarID } = req.query || {};
  if (!appointmentTypeId) {
    return send(400, { ok: false, error: "Missing appointmentTypeId" });
  }

  const normalizedLocation = normalizeLocation(location || "");
  const requestedAccount = resolveAccount(location || "");
  const explicitCalendarId =
    parseCalendarId(calendarId) != null ? parseCalendarId(calendarId) : parseCalendarId(calendarID);

  let activeAccount = requestedAccount;
  let resolvedCalendarId = explicitCalendarId;

  if (!normalizedLocation && resolvedCalendarId == null) {
    return send(400, { ok: false, error: "Missing location or calendarId" });
  }

  try {
    if (resolvedCalendarId == null && normalizedLocation) {
      resolvedCalendarId = await ensureCalendarId(activeAccount, normalizedLocation);
      if (resolvedCalendarId == null && activeAccount === "main" && normalizedLocation === "parents") {
        activeAccount = "parents";
        resolvedCalendarId = await ensureCalendarId(activeAccount, normalizedLocation);
      }
    }
  } catch (error) {
    logError("calendar lookup failed", { error: error?.message, account: activeAccount, location: normalizedLocation });
    return send(502, { ok: false, error: error?.message || "Calendar lookup failed" });
  }

  if (resolvedCalendarId == null) {
    logError("missing calendar id", { account: activeAccount, location: normalizedLocation });
    return send(400, { ok: false, error: "Missing or unknown calendarId" });
  }

  const credentials = getCredentials(activeAccount);
  if (!credentials.user || !credentials.key) {
    logError("missing acuity credentials", { account: activeAccount });
    return send(500, { ok: false, error: "Missing Acuity credentials" });
  }

  const tz = DEFAULT_TZ;
  const targetDate = (date || isoDateInTz(tz)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return send(400, { ok: false, error: "Invalid date. Use YYYY-MM-DD." });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const url = new URL("https://acuityscheduling.com/api/v1/availability/times");
  url.searchParams.set("appointmentTypeID", appointmentTypeId);
  url.searchParams.set("calendarID", String(resolvedCalendarId));
  url.searchParams.set("date", targetDate);
  url.searchParams.set("timezone", tz);

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: buildAuthHeader(activeAccount), Accept: "application/json" }
    });
  } catch (error) {
    logError("fetch threw", { error: error?.message, url: url.toString() });
    return send(500, { ok: false, error: error?.message || "Request failed" });
  }

  const text = await response.text();
  if (!response.ok) {
    logError("acuity response not ok", {
      status: response.status,
      url: url.toString(),
      body: text
    });
    return send(response.status, {
      ok: false,
      error: text || `Acuity ${response.status}`,
      acuityStatus: response.status
    });
  }

  let times;
  try {
    times = JSON.parse(text);
  } catch (error) {
    times = text;
  }

  const entry = (CALENDAR_IDS[activeAccount] || {})[normalizedLocation] || null;
  const calendarLabel = entry?.label;

  return send(200, {
    ok: true,
    account: activeAccount,
    location: normalizedLocation || undefined,
    calendarLabel,
    calendarId: resolvedCalendarId,
    appointmentTypeId,
    date: targetDate,
    timezone: tz,
    count: Array.isArray(times) ? times.length : undefined,
    times
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.CALENDAR_IDS = CALENDAR_IDS;
module.exports.DEFAULT_TZ = DEFAULT_TZ;
module.exports.ensureCalendarId = ensureCalendarId;
