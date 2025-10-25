const { randomUUID } = require("crypto");

const {
  DEFAULT_TZ,
  normalizeAccount,
  normalizeLocation,
  applyCors,
  acuityFetch,
  listCalendars
} = require("./_acuity");

const { getConfiguredIdentifiers } = require("../lib/location-config");

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

const parseCalendarId = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isoDateInTz = (tz) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date())
    .replace(/\//g, "-");

const findCalendarMatch = (calendars, label) => {
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
  const normalizedAccount = normalizeAccount(account);
  const normalizedLocation = normalizeLocation(locationKey);
  const accountCalendars = CALENDAR_IDS[normalizedAccount] || {};
  const entry = accountCalendars[normalizedLocation];
  if (!entry) return null;

  if (entry.calendarId == null) {
    const { numeric } = getConfiguredIdentifiers(normalizedAccount, normalizedLocation);
    if (numeric.length) {
      entry.calendarId = numeric[0];
      entry.calendarIdSource = "config";
    }
  }

  const cached = parseCalendarId(entry.calendarId);
  if (cached != null) {
    return cached;
  }

  if (!entry.label) {
    return null;
  }

  const calendars = await listCalendars(normalizedAccount).catch((error) => {
    const err = new Error(error?.message || "Unable to load calendars");
    err.status = error?.status || 500;
    throw err;
  });
  const match = findCalendarMatch(calendars, entry.label);
  if (!match) {
    return null;
  }

  const resolved = parseCalendarId(match.id);
  if (resolved != null) {
    entry.calendarId = resolved;
    entry.calendarIdSource = "lookup";
    return resolved;
  }

  return null;
};

const handler = async (req, res) => {
  applyCors(req, res);

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  const send = (status, payload) => res.status(status).json({ requestId, ...payload });
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    return res.status(204).end();
  }

  if (method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(405, { ok: false, error: "Method not allowed" });
  }

  const {
    account: accountParam,
    location,
    appointmentTypeId,
    date: dateParam,
    calendarId,
    calendarID
  } = req.query || {};

  if (!appointmentTypeId) {
    return send(400, { ok: false, error: "Missing appointmentTypeId" });
  }

  const normalizedLocation = normalizeLocation(location || "");
  const account = normalizeAccount(accountParam || normalizedLocation);

  const fromQuery = parseCalendarId(calendarId);
  const fromQueryAlt = parseCalendarId(calendarID);

  let resolvedCalendarId = fromQuery != null ? fromQuery : fromQueryAlt;
  let calendarSource = resolvedCalendarId != null ? "query" : null;

  if (resolvedCalendarId == null && normalizedLocation) {
    const { numeric } = getConfiguredIdentifiers(account, normalizedLocation);
    if (numeric.length) {
      resolvedCalendarId = numeric[0];
      calendarSource = "config";
      const accountCalendars = CALENDAR_IDS[account] || {};
      const entry = accountCalendars[normalizedLocation];
      if (entry) {
        entry.calendarId = resolvedCalendarId;
        entry.calendarIdSource = "config";
      }
    }
  }

  try {
    if (resolvedCalendarId == null && normalizedLocation) {
      resolvedCalendarId = await ensureCalendarId(account, normalizedLocation);
      if (resolvedCalendarId != null && !calendarSource) {
        const accountCalendars = CALENDAR_IDS[account] || {};
        const entry = accountCalendars[normalizedLocation];
        calendarSource = entry?.calendarIdSource || "lookup";
      }
    }
  } catch (error) {
    const status = error?.status || 502;
    return send(status, {
      ok: false,
      error: error?.message || "Calendar lookup failed",
      account
    });
  }

  if (resolvedCalendarId == null) {
    return send(400, {
      ok: false,
      error: "Missing or unknown calendarId",
      account,
      location: normalizedLocation || undefined
    });
  }

  const tz = DEFAULT_TZ;
  const targetDate = (dateParam || isoDateInTz(tz)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return send(400, { ok: false, error: "Invalid date. Use YYYY-MM-DD." });
  }

  try {
    const params = {
      calendarID: resolvedCalendarId,
      appointmentTypeID: appointmentTypeId,
      date: targetDate
    };

    const times = await acuityFetch(account, "availability/times", params);
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return send(200, {
      ok: true,
      account,
      location: normalizedLocation || undefined,
      calendarId: resolvedCalendarId,
      calendarSource: calendarSource || undefined,
      appointmentTypeId,
      date: targetDate,
      times
    });
  } catch (error) {
    return send(error?.status || 502, {
      ok: false,
      error: error?.message || "Acuity request failed",
      account,
      acuityStatus: error?.status,
      acuityBody: error?.body
    });
  }
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.CALENDAR_IDS = CALENDAR_IDS;
module.exports.ensureCalendarId = ensureCalendarId;
