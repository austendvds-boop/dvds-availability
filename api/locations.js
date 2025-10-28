const { loadCityTypes, getLocations, buildSchedulingUrl, isLocationConfigured } = require('./_acuity');

module.exports = (_req, res) => {
  const types = loadCityTypes();
  const locations = getLocations().map((loc) => {
    const schedulingUrl = buildSchedulingUrl(loc.acuity);
    const type = types[loc.type] || null;
    return {
      key: loc.key,
      label: loc.label,
      type: loc.type,
      typeLabel: type ? type.label : null,
      isConfigured: isLocationConfigured(loc),
      schedulingUrl,
    };
  });

  res.status(200).json({ ok: true, locations });
};
