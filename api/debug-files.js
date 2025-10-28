module.exports = async (_req, res) => {
  try {
    const types = require('../city-types.json');
    const locations = require('../location-config.json');

    const typeKeys = Object.keys(types || {});
    const locationKeys = Object.keys(locations || {});

    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(
      JSON.stringify(
        {
          ok: true,
          counts: {
            cityTypes: typeKeys.length,
            locationConfigs: locationKeys.length,
          },
          status: {
            'city-types.json': typeKeys.length > 0 ? 'ok' : 'empty',
            'location-config.json': locationKeys.length > 0 ? 'ok' : 'empty',
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(
      JSON.stringify({ ok: false, error: error?.message || 'Failed to read JSON files' })
    );
  }
};
