const { randomUUID } = require("crypto");

const availability = require("./availability");
const { applyCors, normalizeAccount } = require("./_acuity");

const { CALENDAR_IDS, ensureCalendarId } = availability;

const ZIP_TO_CITY = {
  "85085": "anthem",
  "85048": "ahwatukee",
  "85254": "scottsdale",
  "85233": "gilbert",
  "85281": "tempe"
};

// Add additional instructor calendar names or numeric IDs to the calendars array per location.
const LOCATION_CONFIG = {
  anthem: {
    label: "Anthem",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Anthem"]
  },
  ahwatukee: {
    label: "Ahwatukee",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Ahwatukee"]
  },
  apachejunction: {
    label: "Apache Junction",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Apache Junction"]
  },
  chandler: {
    label: "Chandler",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Chandler"]
  },
  gilbert: {
    label: "Gilbert",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Gilbert"]
  },
  mesa: {
    label: "Mesa",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Mesa"]
  },
  scottsdale: {
    label: "Scottsdale",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Scottsdale"]
  },
  tempe: {
    label: "Tempe",
    appointmentTypeId: "50529778",
    account: "main",
    calendars: ["Tempe"]
  },
  parents: {
    label: "Parents",
    appointmentTypeId: "50529778",
    account: "parents",
    calendars: ["Parents"]
  }
};

const FALLBACK_CITY = "scottsdale";

const normalizeZip = (value = "") => value.toString().trim();

const handler = async (req, res) => {
  applyCors(req, res);

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  const send = (status, payload) => res.status(status).json({ requestId, ...payload });

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(405, { ok: false, error: "Method not allowed" });
  }

  const zip = normalizeZip(req.query?.zip || "");
  if (!zip) {
    return send(400, { ok: false, error: "Missing zip" });
  }

  const cityKey = ZIP_TO_CITY[zip] || FALLBACK_CITY;
  const config = LOCATION_CONFIG[cityKey];
  if (!config) {
    return send(404, { ok: false, error: `No calendar for ${cityKey}` });
  }

  const account = normalizeAccount(config.account);
  const accountCalendars = CALENDAR_IDS[account] || {};
  const calendarEntry = accountCalendars[cityKey] || null;

  let calendarId = calendarEntry?.calendarId ?? null;
  if (calendarId == null && typeof ensureCalendarId === "function") {
    try {
      calendarId = await ensureCalendarId(account, cityKey);
    } catch (error) {
      return send(error?.status || 502, {
        ok: false,
        error: error?.message || "Calendar lookup failed",
        account,
        cityKey
      });
    }
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  return send(200, {
    ok: true,
    zip,
    cityKey,
    calendar: config.label,
    calendarId: calendarId ?? null,
    appointmentTypeId: config.appointmentTypeId,
    account
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.ZIP_TO_CITY = ZIP_TO_CITY;
module.exports.LOCATION_CONFIG = LOCATION_CONFIG;
