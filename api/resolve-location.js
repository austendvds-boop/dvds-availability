const {
  applyCors,
  pickAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById,
  resolveStrictCalendars
} = require("./_acuity");

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
  const inferredType = bucket[location] || bucket[compact] || null;
  const appointmentTypeId = req.query?.appointmentTypeId
    ? String(req.query.appointmentTypeId)
    : inferredType;

  const typeInfo = appointmentTypeId ? await getTypeById(account, appointmentTypeId).catch(() => null) : null;
  const resolution = resolveStrictCalendars(account, location, typeInfo);

  if (!resolution.configuredIds.length) {
    return res.status(404).json({
      ok: false,
      account,
      location,
      appointmentTypeId,
      error: "No calendars configured for this location (strict mode)",
      configuredIds: [],
      typeCalendarIds: resolution.typeCalendarIds,
      unresolved: resolution.unresolved
    });
  }

  if (
    appointmentTypeId &&
    resolution.typeCalendarIds.length &&
    !resolution.finalIds.length
  ) {
    return res.status(400).json({
      ok: false,
      account,
      location,
      appointmentTypeId,
      error: "Configured calendars are not enabled for this appointment type in Acuity",
      configuredIds: resolution.configuredIds,
      typeCalendarIds: resolution.typeCalendarIds,
      unresolved: resolution.unresolved,
      disallowed: resolution.disallowed
    });
  }

  return res.status(200).json({
    ok: true,
    account,
    location,
    appointmentTypeId,
    configuredIds: resolution.configuredIds,
    typeCalendarIds: resolution.typeCalendarIds,
    intersection: resolution.finalIds,
    unresolved: resolution.unresolved,
    disallowed: resolution.disallowed
  });
};
