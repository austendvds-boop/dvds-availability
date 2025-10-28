const fetch = global.fetch;

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const city = url.searchParams.get('city');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (!city) {
      return res.status(400).json({ ok: false, error: 'Missing ?city' });
    }

    const types = require('../city-types.json');
    const locs = require('../location-config.json');
    const apptType = types[city];

    if (!apptType) {
      return res
        .status(404)
        .json({ ok: false, error: `Unknown city or missing appointmentType for "${city}"` });
    }

    const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
    const ACUITY_API_KEY = process.env.ACUITY_API_KEY;
    const ACUITY_TZ = process.env.ACUITY_TIMEZONE || 'America/Phoenix';

    if (!ACUITY_USER_ID || !ACUITY_API_KEY) {
      return res
        .status(500)
        .json({ ok: false, error: 'Missing ACUITY_USER_ID / ACUITY_API_KEY env vars' });
    }

    const ymd = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    const start = from || ymd(today);
    const end = to || ymd(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000));

    const cityCfg = (locs && locs[city]) || {};
    const calendarId = cityCfg.calendarId || undefined;

    const qs = new URLSearchParams({
      appointmentTypeID: String(apptType),
      timezone: ACUITY_TZ,
      from: start,
      to: end,
    });

    if (calendarId) {
      qs.set('calendarID', String(calendarId));
    }

    const acuityURL = `https://acuityscheduling.com/api/v1/availability/times?${qs.toString()}`;
    const auth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64');

    const resp = await fetch(acuityURL, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res
        .status(resp.status)
        .json({ ok: false, error: `Acuity ${resp.status}`, detail: text.slice(0, 500) });
    }

    const data = await resp.json();
    const ACUITY_TZ_FORMAT = ACUITY_TZ;
    const times = Array.isArray(data)
      ? data.map((t) => ({
          time: t.time,
          slots: t.slots ?? 1,
          readable: new Date(t.time).toLocaleString('en-US', { timeZone: ACUITY_TZ_FORMAT }),
        }))
      : [];

    res.status(200).json({
      ok: true,
      city,
      appointmentType: apptType,
      calendarId: calendarId ?? null,
      timezone: ACUITY_TZ,
      range: { from: start, to: end },
      count: times.length,
      times,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
