const { loadCityTypes, loadLocationConfig } = require('./_acuity');

const toLabel = (key) => key.replace(/\b\w/g, (c) => c.toUpperCase());

module.exports = (_req, res) => {
  try {
    const types = loadCityTypes() || {};
    const config = loadLocationConfig() || {};
    const accounts = {};
    const accountKeys = new Set([...Object.keys(types), ...Object.keys(config)]);

    for (const account of accountKeys) {
      const typeMap = types[account] || {};
      const configMap = config[account] || {};
      const locationKeys = new Set([...Object.keys(typeMap), ...Object.keys(configMap)]);
      const locations = {};

      for (const key of locationKeys) {
        const appointmentTypeId = typeMap[key] != null ? String(typeMap[key]) : null;
        const configuredIds = Array.isArray(configMap[key]) ? configMap[key] : [];
        const normalizedIds = configuredIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);

        locations[toLabel(key)] = {
          appointmentTypeId,
          locationIds: normalizedIds,
          isConfigured: normalizedIds.length > 0,
        };
      }

      accounts[account] = locations;
    }

    res.status(200).json({ ok: true, accounts });
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || 'failed' });
  }
};
