const {
  DEFAULT_TZ,
  credentialForAccount,
  getCalendarIdForLabel,
  resolveCalendarById
} = require("../lib/acuity");
const { getLocationConfig, normalizeLocation } = require("../lib/locations");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const isoDateInTz = (tz) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
};

const parseCalendarId = (value) => {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

  const locationConfig = location ? getLocationConfig(location) : null;
  const normalizedLocation = normalizeLocation(location);
  const explicitCalendarId = parseCalendarId(calendarId);

  if (!locationConfig && explicitCalendarId == null) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing location or calendarId" });
  }

  let account = locationConfig?.account || null;
  let resolvedCalendarId = explicitCalendarId;

  try {
    if (resolvedCalendarId == null && locationConfig) {
      resolvedCalendarId = await getCalendarIdForLabel(
        locationConfig.account,
        locationConfig.label
      );
      if (resolvedCalendarId == null) {
        return res.status(502).json({
          ok: false,
          error: `Unable to resolve calendar ID for ${locationConfig.label}`
        });
      }
      account = locationConfig.account;
    }

    if (resolvedCalendarId != null && !account) {
      const match = await resolveCalendarById(resolvedCalendarId);
      if (match) {
        account = match.account;
      }
    }
  } catch (error) {
    return res
      .status(502)
      .json({ ok: false, error: error?.message || "Calendar lookup failed" });
  }

  if (resolvedCalendarId == null) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing or unknown calendarId" });
  }

  if (!account) {
    account = /parents/i.test(location || "") ? "parents" : "main";
  }

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
      location: normalizedLocation || undefined,
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
