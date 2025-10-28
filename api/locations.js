const { loadCityTypes, loadLocationConfig } = require('./_acuity');

function toLabel(key) {
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = async (_req, res) => {
  try {
    const types = loadCityTypes();
    const cfg = loadLocationConfig();
    const out = [];

    for (const account of ['main', 'parents']) {
      const typeMap = types[account] || {};
      const configMap = cfg[account] || {};

      for (const key of Object.keys(typeMap)) {
        const configuredIds = Array.isArray(configMap[key]) ? configMap[key] : [];
        const normalizedIds = configuredIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0);

        out.push({
          key,
          label: toLabel(key),
          account,
          appointmentTypeId: String(typeMap[key]),
          isConfigured: normalizedIds.length > 0,
        });
      }
    }

    out.sort((a, b) => {
      if (a.isConfigured !== b.isConfigured) {
        return a.isConfigured ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });

    res.status(200).json({ ok: true, locations: out });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Failed to load locations' });
  }
};
