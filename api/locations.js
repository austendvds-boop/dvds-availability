module.exports = async (_req, res) => {
  try {
    const types = require('../city-types.json');
    const locs = require('../location-config.json');

    const cities = Object.keys(locs || {}).sort();
    const payload = cities.map((name) => {
      const cfg = locs[name] || {};
      const appointmentType = types[name] ?? null;
      let url = cfg.url;

      if (!url && cfg.baseUrl) {
        const params = new URLSearchParams();
        if (cfg.owner) params.set('owner', cfg.owner);
        if (appointmentType) params.set('appointmentType', appointmentType);
        const query = params.toString();
        if (query) {
          url = `${cfg.baseUrl}${cfg.baseUrl.includes('?') ? '&' : '?'}${query}`;
        } else {
          url = cfg.baseUrl;
        }
      }

      return {
        name,
        appointmentType,
        ...cfg,
        url,
      };
    });

    res.status(200).json({ ok: true, cities: payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
