const { LOCATION_CONFIG, ZIP_TO_CITY } = require("../lib/locations");
const { getCalendarIdForLabel } = require("../lib/acuity");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

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

  const zip = String(req.query?.zip || "").trim();
  if (!zip) {
    return res.status(400).json({ ok: false, error: "Missing zip" });
  }

  const cityKey = ZIP_TO_CITY[zip] || "scottsdale";
  const calendar = LOCATION_CONFIG[cityKey];
  if (!calendar) {
    return res.status(404).json({ ok: false, error: `No calendar for ${cityKey}` });
  }

  try {
    const calendarId = await getCalendarIdForLabel(calendar.account, calendar.label);
    return res.status(200).json({
      ok: true,
      zip,
      cityKey,
      calendar: calendar.label,
      appointmentTypeId: calendar.appointmentTypeId,
      calendarId
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error?.message || "Unable to resolve calendar"
    });
  }
};

module.exports.config = {
  runtime: "nodejs20.x"
};
