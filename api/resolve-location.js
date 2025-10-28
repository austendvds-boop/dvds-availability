const { loadCityTypes, loadLocationConfig, getTypeById } = require("./_acuity");

module.exports = async (req, res) => {
  try {
    const location = String(req.query?.location || "").toLowerCase();
    if (!location) return res.status(400).json({ ok: false, error: "Missing location" });

    const types = loadCityTypes();
    const cfg = loadLocationConfig();

    let account = "main";
    if (types.parents && types.parents[location]) account = "parents";
    else if (!(types.main && types.main[location])) {
      return res.status(404).json({ ok: false, error: `Unknown location "${location}"` });
    }

    const appointmentTypeId = String((types[account] || {})[location] || "");
    if (!appointmentTypeId) {
      return res.status(400).json({
        ok: false,
        error: "Missing appointmentTypeId (configure city-types.json)"
      });
    }

    const configuredIds = (cfg[account] && cfg[account][location])
      ? cfg[account][location].map(Number).filter(Boolean)
      : [];
    if (!configuredIds.length) {
      return res.status(404).json({
        ok: false,
        account,
        location,
        appointmentTypeId,
        error: "No calendars configured for this location (location-config.json)"
      });
    }

    let typeCalendarIds = [];
    try {
      const t = await getTypeById(account, appointmentTypeId);
      const raw = (t && (t.calendarIDs || t.calendars)) || [];
      typeCalendarIds = raw.map((x) => Number(x.id || x)).filter(Boolean);
    } catch (error) {
      // ignore lookup failure; continue with configured ids only
    }

    let intersection = configuredIds;
    if (typeCalendarIds.length) {
      const allow = new Set(typeCalendarIds);
      intersection = configuredIds.filter((id) => allow.has(id));
    }

    if (!intersection.length) {
      return res.status(400).json({
        ok: false,
        account,
        location,
        appointmentTypeId,
        configuredIds,
        typeCalendarIds,
        error: "Configured calendars aren’t enabled for this type in Acuity"
      });
    }

    res.status(200).json({
      ok: true,
      account,
      location,
      appointmentTypeId,
      configuredIds,
      typeCalendarIds,
      intersection
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "resolve failed" });
  }
};
