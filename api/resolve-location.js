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

  const cityTypes = loadCityTypes();

  if (String(req.query?.list || "") === "1") {
    const requested = String(req.query?.account || "").toLowerCase();
    if (requested === "main" || requested === "parents") {
      const cities = Object.keys(cityTypes[requested] || {}).sort((a, b) => a.localeCompare(b));
      return res.status(200).json({ ok: true, account: requested, cities });
    }

    const combined = new Set([
      ...Object.keys(cityTypes.main || {}),
      ...Object.keys(cityTypes.parents || {})
    ]);
    return res.status(200).json({
      ok: true,
      account: null,
      cities: Array.from(combined).sort((a, b) => a.localeCompare(b))
    });
  }

  const location = normalizeLocation(req.query?.location || "");
  if (!location) {
    return res.status(400).json({ ok: false, error: "Missing location" });
  }

  let account = null;
  const requestedAccount = String(req.query?.account || "");
  if (requestedAccount) {
    account = pickAccount(requestedAccount);
  } else if ((cityTypes.main || {})[location]) {
    account = "main";
  } else if ((cityTypes.parents || {})[location]) {
    account = "parents";
  } else {
    return res.status(404).json({ ok: false, error: `Unknown location \"${location}\"` });
  }

  const bucket = cityTypes[account] || {};
  const compact = location.replace(/\s+/g, "");
  const inferredType = bucket[location] || bucket[compact] || null;
  const appointmentTypeId = req.query?.appointmentTypeId
    ? String(req.query.appointmentTypeId)
    : inferredType;

  if (!appointmentTypeId) {
    return res.status(400).json({
      ok: false,
      account,
      location,
      error: "Missing appointmentTypeId for this location"
    });
  }

  const typeInfo = await getTypeById(account, appointmentTypeId).catch(() => null);
  const resolution = resolveStrictCalendars(account, location, typeInfo);

  if (!resolution.finalIds.length) {
    return res.status(200).json({
      ok: false,
      account,
      location,
      appointmentTypeId,
      configuredIds: resolution.configuredIds,
      typeCalendarIds: resolution.typeCalendarIds,
      unresolved: resolution.unresolved,
      disallowed: resolution.disallowed,
      intersection: [],
      error: "No calendars available for this location and appointment type"
    });
  }

  return res.status(200).json({
    ok: true,
    account,
    location,
    appointmentTypeId,
    configuredIds: resolution.configuredIds,
    typeCalendarIds: resolution.typeCalendarIds,
    unresolved: resolution.unresolved,
    disallowed: resolution.disallowed,
    intersection: resolution.finalIds,
    calendarSource: resolution.source
  });
};
