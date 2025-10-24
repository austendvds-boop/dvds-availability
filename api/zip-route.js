const availability = require("./availability");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const ZIP_TO_CITY = {
  "85085": "anthem",
  "85048": "ahwatukee",
  "85254": "scottsdale",
  "85233": "gilbert",
  "85281": "tempe"
};

const LOCATION_CONFIG = {
  anthem: { label: "Anthem", appointmentTypeId: "50529778", account: "main" },
  ahwatukee: { label: "Ahwatukee", appointmentTypeId: "50529778", account: "main" },
  apachejunction: { label: "Apache Junction", appointmentTypeId: "50529778", account: "main" },
  chandler: { label: "Chandler", appointmentTypeId: "50529778", account: "main" },
  gilbert: { label: "Gilbert", appointmentTypeId: "50529778", account: "main" },
  mesa: { label: "Mesa", appointmentTypeId: "50529778", account: "main" },
  scottsdale: { label: "Scottsdale", appointmentTypeId: "50529778", account: "main" },
  tempe: { label: "Tempe", appointmentTypeId: "50529778", account: "main" },
  parents: { label: "Parents", appointmentTypeId: "50529778", account: "parents" }
};

const FALLBACK_CITY = "scottsdale";

const respondCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeZip = (value = "") => value.toString().trim();

const handler = (req, res) => {
  respondCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const zip = normalizeZip(req.query?.zip || "");
  if (!zip) {
    return res.status(400).json({ ok: false, error: "Missing zip" });
  }

  const cityKey = ZIP_TO_CITY[zip] || FALLBACK_CITY;
  const config = LOCATION_CONFIG[cityKey];
  if (!config) {
    return res.status(404).json({ ok: false, error: `No calendar for ${cityKey}` });
  }

  const calendarsForAccount = availability.CALENDAR_IDS[config.account] || {};
  const calendarEntry = calendarsForAccount[cityKey] || null;
  const calendarId = calendarEntry?.calendarId ?? null;

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  return res.status(200).json({
    ok: true,
    zip,
    cityKey,
    calendar: config.label,
    calendarId,
    appointmentTypeId: config.appointmentTypeId,
    account: config.account
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.ZIP_TO_CITY = ZIP_TO_CITY;
module.exports.LOCATION_CONFIG = LOCATION_CONFIG;
