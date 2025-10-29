module.exports = async (_req, res) => {
  try {
    const types = require('../city-types.json');
    const locs = require('../location-config.json');

    res.status(200).json({
      ok: true,
      status: {
        'city-types.json': types ? 'ok' : 'missing',
        'location-config.json': locs ? 'ok' : 'missing',
      },
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
};
