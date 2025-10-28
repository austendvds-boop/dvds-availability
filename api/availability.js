const {
  DEFAULT_TZ,
  applyCors,
  pickAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById,
  resolveStrictCalendars,
  acuityFetch
} = require("./_acuity");

const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TZ });

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const parseCalendarId = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return NaN;
  return Number(text);
};

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const account = pickAccount(req.query);
  const location = normalizeLocation(req.query?.location || "");
  const cityTypes = loadCityTypes();
  const bucket = cityTypes[account] || {};
  const compact = location.replace(/\s+/g, "");

  const appointmentTypeId = req.query?.appointmentTypeId
    ? String(req.query.appointmentTypeId)
    : bucket[location] || bucket[compact] || null;

  if (!appointmentTypeId) {
    return res.status(400).json({
      ok: false,
      error: "Missing appointmentTypeId (provide explicitly or configure city-types.json)",
      account,
      location: location || null
    });
  }

  const date = req.query?.date && isIsoDate(req.query.date)
    ? req.query.date
    : todayISO();

  if (!isIsoDate(date)) {
    return res.status(400).json({ ok: false, error: "Invalid date" });
  }

  const calendarParam = req.query?.calendarID ?? req.query?.calendarId;
  const parsedCalendar = parseCalendarId(calendarParam);
  if (parsedCalendar !== null && Number.isNaN(parsedCalendar)) {
    return res.status(400).json({ ok: false, error: "Invalid calendarID" });
  }

  const typeInfo = await getTypeById(account, appointmentTypeId).catch(() => null);

  let calendarId = parsedCalendar;
  let metadata = {};

  if (calendarId == null) {
    if (!location) {
      return res.status(400).json({
        ok: false,
        error: "Provide either calendarID or location",
        account
      });
    }

    const resolution = resolveStrictCalendars(account, location, typeInfo);
    if (!resolution.configuredIds.length) {
      return res.status(404).json({
        ok: false,
        error: "No calendars configured for this location (strict mode)",
        account,
        location,
        appointmentTypeId,
        typeCalendarIds: resolution.typeCalendarIds,
        unresolved: resolution.unresolved
      });
    }

    if (resolution.typeCalendarIds.length && !resolution.finalIds.length) {
      return res.status(400).json({
        ok: false,
        error: "Configured calendars are not enabled for this appointment type in Acuity",
        account,
        location,
        appointmentTypeId,
        configuredCalendarIds: resolution.configuredIds,
        typeCalendarIds: resolution.typeCalendarIds,
        unresolved: resolution.unresolved,
        disallowedConfiguredIds: resolution.disallowed
      });
    }

    const candidates = resolution.finalIds.length
      ? resolution.finalIds
      : resolution.configuredIds;

    if (!candidates.length) {
      return res.status(404).json({
        ok: false,
        error: "No calendars available after validation",
        account,
        location,
        appointmentTypeId
      });
    }

    calendarId = Number(candidates[0]);
    metadata = {
      calendarSource: resolution.typeCalendarIds.length ? "type" : "config",
      configuredCalendarIds: resolution.configuredIds,
      typeCalendarIds: resolution.typeCalendarIds,
      disallowedConfiguredIds: resolution.disallowed,
      unresolvedConfiguredEntries: resolution.unresolved,
      pooledCalendarIDs: candidates.map((id) => Number(id))
    };
  } else {
    metadata = { calendarSource: "query" };
  }

  try {
    const response = await acuityFetch(account, "availability/times", {
      appointmentTypeID: appointmentTypeId,
      calendarID: calendarId,
      date
    });
    const times = Array.isArray(response) ? response : [];

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

    return res.status(200).json({
      ok: true,
      account,
      location: location || null,
      appointmentTypeId,
      date,
      calendarId,
      appointmentTypeName: typeInfo?.name || null,
      count: times.length,
      times,
      ...metadata
    });
  } catch (error) {
    return res.status(error?.status || 502).json({
      ok: false,
      error: error?.message || "Acuity request failed",
      account,
      location: location || null,
      appointmentTypeId,
      calendarId,
      status: error?.status || 502,
      details: error?.body
    });
  }
};
