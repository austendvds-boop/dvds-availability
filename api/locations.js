const { loadCityTypes, loadLocationConfig } = require("./_acuity");

module.exports = async (_req, res) => {
  try {
    const types = loadCityTypes();
    const cfg   = loadLocationConfig();
    const out   = [];

    for (const account of ["main","parents"]) {
      const t = types[account] || {};
      const c = cfg[account]   || {};
      for (const key of Object.keys(t)) {
        const ids = (c[key] || []).map(Number).filter(Boolean);
        if (!ids.length) continue; // ONLY configured
        out.push({
          key,
          label: key.replace(/\b\w/g, m => m.toUpperCase()),
          account,
          appointmentTypeId: String(t[key])
        });
      }
    }

    out.sort((a,b)=> a.label.localeCompare(b.label));
    res.status(200).json({ ok:true, locations: out });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || "failed to load locations" });
  }
};
