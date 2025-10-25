const {
  DEFAULT_TZ,
  applyCors,
  pickAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById,
  resolveStrictCalendars,
  acuityFetch,
  groupTimesMerge,
  addDaysISO
} = require("./_acuity");

const formatToday = () =>
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

  const baseDate = req.query?.date && isIsoDate(req.query.date)
    ? req.query.date
    : formatToday();

  if (!isIsoDate(baseDate)) {
    return res.status(400).json({ ok: false, error: "Invalid date" });
  }

  const rawDays = Number(req.query?.days || 1);
  const days = Math.min(7, Math.max(1, Number.isFinite(rawDays) ? rawDays : 1));

  const typeInfo = await getTypeById(account, appointmentTypeId).catch(() => null);
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

  if (
    resolution.typeCalendarIds.length &&
    !resolution.finalIds.length
  ) {
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

  const activeCalendarIds = (resolution.finalIds.length
    ? resolution.finalIds
    : resolution.configuredIds
  ).map((id) => Number(id));

  if (!activeCalendarIds.length) {
    return res.status(404).json({
      ok: false,
      error: "No calendars available after validation",
      account,
      location,
      appointmentTypeId
    });
  }

  const calendarSource = resolution.typeCalendarIds.length ? "type" : "config";
  const results = [];
  const errors = [];

  for (let i = 0; i < days; i += 1) {
    const day = addDaysISO(baseDate, i, DEFAULT_TZ);
    if (!day) continue;

    const perCalendar = [];
    for (const calendarID of activeCalendarIds) {
      try {
        const response = await acuityFetch(account, "availability/times", {
          appointmentTypeID: appointmentTypeId,
          calendarID,
          date: day
        });
        const normalized = Array.isArray(response)
          ? response.map((entry) => ({ ...entry, calendarID }))
          : [];
        perCalendar.push(normalized);
      } catch (error) {
        errors.push({
          calendarID,
          date: day,
          status: error?.status || 500,
          message: error?.message || "Acuity request failed"
        });
      }
    }

    const merged = groupTimesMerge(perCalendar);
    const totalSlots = merged.reduce((sum, entry) => sum + Number(entry.slots || 0), 0);
    results.push({ date: day, times: merged, totalSlots });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

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
    days,
    startDate: baseDate,
    results,
    errors: errors.length ? errors : undefined
  });
};
