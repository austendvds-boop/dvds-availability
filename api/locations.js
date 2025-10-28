const { loadCityTypes, loadLocationConfig } = require("./_acuity");

module.exports = async (req, res) => {
  try {
    const types = loadCityTypes();
    const cfg = loadLocationConfig();
    const showAll = String(req.query.all || "") === "1";
    const out = [];

    for (const account of ["main", "parents"]) {
      const t = types[account] || {};
      const c = cfg[account] || {};
      for (const key of Object.keys(t)) {
        const configuredIds = (c[key] || []).map(Number).filter(Boolean);
        const isConfigured = configuredIds.length > 0;
        if (!showAll && !isConfigured) continue;
        out.push({
          key,
          label: key.replace(/\b\w/g, (m) => m.toUpperCase()),
          account,
          appointmentTypeId: String(t[key]),
          isConfigured
        });
      }
    }

    out.sort((a, b) => (b.isConfigured - a.isConfigured) || a.label.localeCompare(b.label));
    res.status(200).json({ ok: true, locations: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "failed to load locations" });
  }
};
