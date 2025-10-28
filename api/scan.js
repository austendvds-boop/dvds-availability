const availability = require('./availability');

module.exports = async (_req, res) => {
  try {
    const types = require('../city-types.json');
    const locs  = require('../location-config.json');
    const cities = Object.keys(locs);
    const today = new Date();
    const toDate = new Date(Date.now() + 7 * 86400000);

    function ymd(d) {
      return d.toISOString().slice(0, 10);
    }

    const from = ymd(today);
    const to = ymd(toDate);

    const results = [];
    for (const name of cities) {
      const query = `/api/availability?city=${encodeURIComponent(name)}&from=${from}&to=${to}`;
      try {
        const result = await new Promise((resolve) => {
          const req = { url: query };
          const capture = {
            status(code) {
              this.statusCode = code;
              return this;
            },
            json(payload) {
              resolve({ status: this.statusCode ?? 200, payload });
            }
          };
          availability(req, capture).catch((err) => {
            resolve({ status: 500, payload: { ok: false, error: err.message } });
          });
        });

        const payload = result.payload || {};
        results.push({
          city: name,
          status: result.status,
          ok: payload.ok === true,
          count: payload.count ?? 0,
          error: payload.error || null,
          detail: payload.detail || null,
          account: (locs[name] || {}).account || 'main',
          apptType: types[name] || null
        });
      } catch (error) {
        results.push({
          city: name,
          status: 0,
          ok: false,
          count: 0,
          error: error.message,
          account: (locs[name] || {}).account || 'main',
          apptType: types[name] || null
        });
      }
    }

    res.status(200).json({ ok: true, from, to, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
