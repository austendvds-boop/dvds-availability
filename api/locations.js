module.exports = async (_req, res) => {
  try {
    const types = require('../city-types.json');
    const locs = require('../location-config.json');

    const cities = Object.keys(locs || {}).sort();
    const payload = cities.map((name) => ({
      name,
      appointmentType: types[name] ?? null,
      ...locs[name],
    }));

    res.status(200).json({ ok: true, cities: payload });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
