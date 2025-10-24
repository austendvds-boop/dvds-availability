const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const CALENDARS = {
  anthem: { label: "Anthem", appointmentTypeId: "50529778", calendarId: null },
  ahwatukee: { label: "Ahwatukee", appointmentTypeId: "50529778", calendarId: null },
  apachejunction: { label: "Apache Junction", appointmentTypeId: "50529778", calendarId: null },
  chandler: { label: "Chandler", appointmentTypeId: "50529778", calendarId: null },
  gilbert: { label: "Gilbert", appointmentTypeId: "50529778", calendarId: null },
  mesa: { label: "Mesa", appointmentTypeId: "50529778", calendarId: null },
  scottsdale: { label: "Scottsdale", appointmentTypeId: "50529778", calendarId: null },
  tempe: { label: "Tempe", appointmentTypeId: "50529778", calendarId: null },
  parents: { label: "Parents", appointmentTypeId: "50529778", calendarId: null }
};

// Seeded ZIPs; expand later with full AZ coverage
const ZIP_TO_CITY = {
  "85085": "anthem",
  "85048": "ahwatukee",
  "85254": "scottsdale",
  "85233": "gilbert",
  "85281": "tempe"
};

module.exports = (req, res) => {
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

  const cityKey = ZIP_TO_CITY[zip] || "scottsdale"; // fallback until full map is added
  const calendar = CALENDARS[cityKey];
  if (!calendar) {
    return res.status(404).json({ ok: false, error: `No calendar for ${cityKey}` });
  }

  return res.status(200).json({
    ok: true,
    zip,
    cityKey,
    calendar: calendar.label,
    appointmentTypeId: calendar.appointmentTypeId,
    calendarId: calendar.calendarId
  });
};

module.exports.config = {
  runtime: "nodejs20.x"
};
