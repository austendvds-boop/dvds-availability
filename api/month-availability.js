const { randomUUID } = require("crypto");

const {
  DEFAULT_TZ,
  normalizeAccount,
  normalizeLocation,
  applyCors,
  acuityFetch,
  addDaysISO,
  startOfMonthISO,
  daysInMonth,
  loadCityTypes,
  getTypeById
} = require("./_acuity");

const { resolveLocationCalendars } = require("./location-availability");

const inferAccountFromLocation = (cityTypes, providedAccount, locationKey, fallbackAccount = "main") => {
  if (providedAccount) return normalizeAccount(providedAccount);
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) return normalizeAccount(fallbackAccount);
  const compact = normalizedLocation.replace(/\s+/g, "");
  if (cityTypes.parents?.[normalizedLocation] || cityTypes.parents?.[compact]) {
    return "parents";
  }
  if (cityTypes.main?.[normalizedLocation] || cityTypes.main?.[compact]) {
    return "main";
  }
  return normalizeAccount(fallbackAccount);
};

const resolveAppointmentTypeId = (cityTypes, account, locationKey, explicitType) => {
  if (explicitType) {
    return { id: String(explicitType), source: "query" };
  }
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) {
    return { id: null, source: null };
  }
  const map = cityTypes[account] || {};
  const compact = normalizedLocation.replace(/\s+/g, "");
  const resolved = map[normalizedLocation] || map[compact] || null;
  return { id: resolved ? String(resolved) : null, source: resolved ? "city-types" : null };
};

const isoToday = (tz = DEFAULT_TZ) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date())
    .replace(/\//g, "-");

const handler = async (req, res) => {
  applyCors(req, res);

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ requestId, ok: false, error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

  const query = req.query || {};
  const cityTypes = loadCityTypes();
  const normalizedLocation = normalizeLocation(query.location || "");

  if (!normalizedLocation) {
    return res.status(400).json({ requestId, ok: false, error: "Missing location" });
  }

  const account = inferAccountFromLocation(cityTypes, query.account, normalizedLocation, "main");
  const { id: appointmentTypeId, source: appointmentTypeSource } = resolveAppointmentTypeId(
    cityTypes,
    account,
    normalizedLocation,
    query.appointmentTypeId
  );

  if (!appointmentTypeId) {
    return res.status(400).json({
      requestId,
      ok: false,
      error: "Missing appointmentTypeId (provide it directly or configure the location)",
      account,
      location: normalizedLocation
    });
  }

  const tz = DEFAULT_TZ;
  const baseDate = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : isoToday(tz);
  const monthStart = startOfMonthISO(baseDate, tz);
  const totalDays = daysInMonth(baseDate, tz);

  let typeInfo = null;
  try {
    typeInfo = await getTypeById(account, appointmentTypeId);
  } catch (error) {
    // continue without type metadata; downstream logic will fall back to configured/all calendars
  }

  let calendarResolution;
  try {
    calendarResolution = await resolveLocationCalendars(account, normalizedLocation, {
      appointmentTypeId,
      typeInfo
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      requestId,
      ok: false,
      error: error.message || "Failed to resolve calendars",
      account,
      location: normalizedLocation
    });
  }

  const calendarIds = Array.isArray(calendarResolution?.ids) ? calendarResolution.ids : [];
  if (!calendarIds.length) {
    return res.status(404).json({
      requestId,
      ok: false,
      error: `No calendars available for "${normalizedLocation}"`,
      account,
      location: normalizedLocation,
      calendarSource: calendarResolution?.calendarSource || null
    });
  }

  const byDate = {};
  const errors = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const day = offset === 0 ? monthStart : addDaysISO(monthStart, offset, tz);
    if (!day) continue;
    byDate[day] = 0;
    await Promise.all(
      calendarIds.map(async (calendarID) => {
        try {
          const response = await acuityFetch(account, "availability/times", {
            appointmentTypeID: appointmentTypeId,
            calendarID,
            date: day
          });
          if (Array.isArray(response)) {
            const sum = response.reduce((total, entry) => total + Number(entry?.slots || 1), 0);
            byDate[day] += Number.isFinite(sum) ? sum : 0;
          }
        } catch (error) {
          errors.push({
            calendarID,
            date: day,
            status: error?.status || null,
            message: error?.message || "Acuity request failed"
          });
        }
      })
    );
  }

  return res.status(200).json({
    requestId,
    ok: true,
    account,
    location: normalizedLocation,
    appointmentTypeId: String(appointmentTypeId),
    appointmentTypeSource,
    monthStart,
    days: totalDays,
    calendarIDs: calendarIds,
    calendarSource: calendarResolution?.calendarSource || null,
    configuredIds: calendarResolution?.configuredIds || [],
    configured: calendarResolution?.configured || [],
    unresolvedCalendars: calendarResolution?.unresolvedNames || [],
    typeCalendarIds: calendarResolution?.typeCalendarIds || [],
    typeCalendars: calendarResolution?.typeCalendars || [],
    byDate,
    errors
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
