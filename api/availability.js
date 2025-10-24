const { URL } = require("url");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const DEFAULT_TZ = process.env.TZ_DEFAULT || "America/Phoenix";

// TODO: replace placeholder calendar IDs with the numeric values returned by /api/calendars
const CALENDAR_IDS = {
  main: {
    anthem: null,
    ahwatukee: null,
    apachejunction: null,
    chandler: null,
    gilbert: null,
    mesa: null,
    scottsdale: null,
    tempe: null
  },
  parents: {
    parents: null
  }
};

const normalizeLocation = (value = "") => value.trim().toLowerCase();

const isoDateInTz = (tz) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
};

const resolveCalendarId = (location, explicitCalendarId) => {
  if (explicitCalendarId) {
    const id = Number(explicitCalendarId);
    return Number.isFinite(id) ? id : null;
  }

  const key = normalizeLocation(location);
  if (!key) return null;

  if (CALENDAR_IDS.parents[key] != null) {
    return CALENDAR_IDS.parents[key];
  }
  return CALENDAR_IDS.main[key] ?? null;
};

const resolveAccount = (location, calendarId) => {
  const key = normalizeLocation(location);
  if (CALENDAR_IDS.parents[key] != null) return "parents";
  if (typeof calendarId === "number") {
    for (const [account, mapping] of Object.entries(CALENDAR_IDS)) {
      for (const val of Object.values(mapping)) {
        if (val === calendarId && val != null) return account;
      }
    }
  }
  if (/parents/i.test(location || "")) return "parents";
  return "main";
};

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

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const { location, appointmentTypeId, date, calendarId } = req.query || {};

  if (!appointmentTypeId) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing appointmentTypeId" });
  }

  const resolvedCalendarId = resolveCalendarId(location, calendarId);
  if (resolvedCalendarId == null) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing or unknown calendarId" });
  }

  const account = resolveAccount(location, resolvedCalendarId);
  const { user, key } = credentialForAccount(account);
  if (!user || !key) {
    return res.status(500).json({ ok: false, error: "Missing Acuity credentials" });
  }

  const tz = DEFAULT_TZ;
  const targetDate = (date || isoDateInTz(tz)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid date. Use YYYY-MM-DD." });
  }

  const baseUrl = "https://acuityscheduling.com/api/v1/availability/times";
  const url = new URL(baseUrl);
  url.searchParams.set("appointmentTypeID", appointmentTypeId);
  url.searchParams.set("calendarID", String(resolvedCalendarId));
  url.searchParams.set("date", targetDate);
  url.searchParams.set("timezone", tz);

  const auth =
    "Basic " + Buffer.from(`${user}:${key}`, "utf8").toString("base64");

  try {
    const response = await fetch(url, {
      headers: { Authorization: auth }
    });
    const text = await response.text();
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ ok: false, error: text || `Acuity ${response.status}` });
    }
    let times;
    try {
      times = JSON.parse(text);
    } catch (err) {
      times = text;
    }
    return res.status(200).json({
      ok: true,
      account,
      location: normalizeLocation(location),
      appointmentTypeId,
      calendarId: resolvedCalendarId,
      date: targetDate,
      count: Array.isArray(times) ? times.length : undefined,
      times
    });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, error: error?.message || "Internal error" });
  }
};

module.exports.config = {
  runtime: "nodejs20.x"
};
