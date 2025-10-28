const { loadCityTypes, getLocationsByAccount } = require('./_acuity');

function toLabel(key) {
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = (_req, res) => {
  try {
    const types = loadCityTypes() || {};
    const locations = getLocationsByAccount();
    const payload = {};

    for (const account of Object.keys(types)) {
      const typeMap = types[account] || {};
      const accountLocations = locations[account] || {};
      const normalized = {};

      for (const key of Object.keys(typeMap)) {
        const info = accountLocations[key] || { appointmentTypeId: String(typeMap[key] || ''), locationIds: [] };
        normalized[toLabel(key)] = {
          appointmentTypeId: String(typeMap[key]),
          locationIds: info.locationIds || [],
          isConfigured: Boolean(info.locationIds && info.locationIds.length > 0),
        };
      }

      payload[account] = normalized;
    }

    res.status(200).json({ ok: true, accounts: payload });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Failed to load availability' });
  }
};
