const {
  DEFAULT_TZ,
  applyCors,
  pickAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById,
  resolveStrictCalendars,
  acuityFetch,
  addDaysISO,
  startOfMonthISO,
  daysInMonth
} = require("./_acuity");

const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TZ });

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

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
  if (!location) {
    return res.status(400).json({ ok: false, error: "Missing location" });
  }

  const cityTypes = loadCityTypes();
  const bucket = cityTypes[account] || {};
  const compact = location.replace(/\s+/g, "");
  const appointmentTypeId = req.query?.appointmentTypeId
    ? String(req.query.appointmentTypeId)
    : bucket[location] || bucket[compact] || null;

  if (!appointmentTypeId) {
    return res.status(400).json({
      ok: false,
      error: "Missing appointmentTypeId (configure city-types.json)",
      account,
      location
    });
  }

  const referenceDate = req.query?.date && isIsoDate(req.query.date)
    ? req.query.date
    : todayISO();

  if (!isIsoDate(referenceDate)) {
    return res.status(400).json({ ok: false, error: "Invalid date" });
  }

  const monthStart = startOfMonthISO(referenceDate, DEFAULT_TZ);
  const totalDays = daysInMonth(referenceDate, DEFAULT_TZ);

  const typeInfo = await getTypeById(account, appointmentTypeId).catch(() => null);
  const resolution = resolveStrictCalendars(account, location, typeInfo);

  if (!resolution.finalIds.length) {
    if (resolution.configuredIds.length && resolution.typeCalendarIds.length) {
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

    return res.status(404).json({
      ok: false,
      error: "No calendars available for this location",
      account,
      location,
      appointmentTypeId,
      typeCalendarIds: resolution.typeCalendarIds,
      unresolved: resolution.unresolved
    });
  }

  const activeCalendarIds = resolution.finalIds.map((id) => Number(id));

  if (!activeCalendarIds.length) {
    return res.status(404).json({
      ok: false,
      error: "No calendars available after validation",
      account,
      location,
      appointmentTypeId
    });
  }

  const calendarSource = resolution.source || (resolution.typeCalendarIds.length ? "type" : "config");
  const byDate = {};
  const errors = [];

  for (let i = 0; i < totalDays; i += 1) {
    const day = addDaysISO(monthStart, i, DEFAULT_TZ);
    if (day) byDate[day] = 0;
  }

  for (const calendarID of activeCalendarIds) {
    for (let i = 0; i < totalDays; i += 1) {
      const day = addDaysISO(monthStart, i, DEFAULT_TZ);
      if (!day) continue;
      try {
        const response = await acuityFetch(account, "availability/times", {
          appointmentTypeID: appointmentTypeId,
          calendarID,
          date: day
        });
        if (Array.isArray(response) && response.length) {
          const count = response.reduce((sum, entry) => sum + Number(entry.slots || 0), 0);
          byDate[day] += count;
        }
      } catch (error) {
        errors.push({
          calendarID,
          date: day,
          status: error?.status || 500,
          message: error?.message || "Acuity request failed"
        });
      }
    }
  }

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

  return res.status(200).json({
    ok: true,
    account,
    location,
    appointmentTypeId,
    calendarSource,
    configuredCalendarIds: resolution.configuredIds,
    typeCalendarIds: resolution.typeCalendarIds,
    disallowedConfiguredIds: resolution.disallowed,
    unresolvedConfiguredEntries: resolution.unresolved,
    pooledCalendarIDs: activeCalendarIds,
    monthStart,
    days: totalDays,
    byDate,
    errors: errors.length ? errors : undefined
  });
};
