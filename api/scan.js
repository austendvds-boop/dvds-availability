const fetch = global.fetch;

function pickTimezone() {
  return process.env.ACUITY_TIMEZONE || process.env.TZ_DEFAULT || "America/Phoenix";
}
function pickDefaultDays() {
  const n = Number(process.env.ACUITY_DEFAULT_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 14;
}
function normalizeAccount(account) {
  return String(account || "").toLowerCase() === "parents" ? "parents" : "main";
}
function pickCreds(account) {
  const label = normalizeAccount(account);
  if (label === "parents") {
    return { user: process.env.ACUITY_PARENTS_USER_ID, key: process.env.ACUITY_PARENTS_API_KEY, label };
  }
  return { user: process.env.ACUITY_MAIN_USER_ID, key: process.env.ACUITY_MAIN_API_KEY, label: "main" };
}
function ymd(d) { return new Date(d).toISOString().slice(0,10); }
function datesBetween(fromStr, toStr) {
  const out = [];
  const start = new Date(fromStr + "T00:00:00");
  const end   = new Date(toStr   + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    out.push(ymd(d));
  }
  return out;
}

async function acuityJSON(url, auth) {
  const resp = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { resp, json, text };
}

async function mapLimit(items, limit, iter) {
  const ret = [];
  let i = 0, active = 0;
  return await new Promise((resolve, reject) => {
    const kick = () => {
      if (i === items.length && active === 0) return resolve(ret);
      while (active < limit && i < items.length) {
        const idx = i++, val = items[idx];
        active++;
        Promise.resolve()
          .then(() => iter(val, idx))
          .then(r => { ret[idx] = r; active--; kick(); })
          .catch(err => { reject(err); });
      }
    };
    kick();
  });
}

async function perDayAggregate(dates, tz, apptType, cfg, auth, urlFor) {
  const results = await mapLimit(dates, 6, async (day) => {
    const params = { appointmentTypeID: String(apptType), timezone: tz, date: day };
    const { resp, json, text } = await acuityJSON(urlFor("times", params), auth);
    if (!resp.ok) return { _error: true, day, status: resp.status, detail: json || text };
    const arr = Array.isArray(json) ? json : [];
    return arr.map(t => ({
      time: t.time,
      slots: t.slots ?? 1,
      readable: new Date(t.time).toLocaleString("en-US", { timeZone: tz })
    }));
  });

  const times = [];
  const errors = [];
  for (const r of results) {
    if (!r) continue;
    if (Array.isArray(r)) times.push(...r);
    else if (r._error) errors.push(r);
  }
  return { times, errors };
}

module.exports = async (req, res) => {
  try {
    const types = require('../city-types.json');
    const locs  = require('../location-config.json');

    const url = new URL(req.url, 'http://localhost');
    const city = url.searchParams.get('city');
    if (!city) return res.status(400).json({ ok:false, error: 'Missing ?city' });
    if (!types[city] || !locs[city]) {
      return res.status(404).json({ ok:false, error: `Unknown city "${city}"` });
    }

    const cfg = locs[city];
    const apptType = types[city];

    const fromParam = url.searchParams.get('from');
    const daysParam = Number(url.searchParams.get('days'));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.floor(daysParam) : 7;

    const defaultFrom = ymd(new Date());
    const from = fromParam || defaultFrom;
    const startDate = new Date(from + 'T00:00:00');
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ ok:false, error: 'Invalid from date' });
    }
    const rangeDays = days || pickDefaultDays();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (rangeDays - 1));
    const to = ymd(endDate);

    const tz = pickTimezone();
    const base = "https://acuityscheduling.com/api/v1/availability";
    const urlFor = (endpoint, params) => {
      const qs = new URLSearchParams(params);
      if (cfg.calendarId) qs.set('calendarID', String(cfg.calendarId));
      return `${base}/${endpoint}?${qs.toString()}`;
    };

    const rangeQS = {
      appointmentTypeID: String(apptType),
      timezone: tz,
      from,
      to
    };

    const evaluate = async (accountLabel) => {
      const creds = pickCreds(accountLabel);
      const { user, key, label } = creds;
      if (!user || !key) {
        return {
          ok: false,
          status: 500,
          count: 0,
          error: `Missing ${label.toUpperCase()} credentials in env`
        };
      }

      const auth = Buffer.from(`${user}:${key}`).toString('base64');
      const { resp: r1, json: j1, text: t1 } = await acuityJSON(urlFor('times', rangeQS), auth);

      if (r1.ok && Array.isArray(j1)) {
        return { ok: true, status: r1.status, count: j1.length };
      }

      const detailPayload = j1 || t1;
      const statusCode = typeof j1 === 'object' && j1 !== null ? j1.status_code : undefined;
      const needsDate = r1 && r1.status === 400 && (t1 || '').toLowerCase().includes('date') && (t1 || '').toLowerCase().includes('required');
      if (!r1.ok && !needsDate) {
        return {
          ok: false,
          status: r1.status || 500,
          count: 0,
          error: `Acuity ${r1.status || 500}`,
          detail: detailPayload,
          statusCode
        };
      }

      const daysList = datesBetween(from, to);
      const { times, errors } = await perDayAggregate(daysList, tz, apptType, cfg, auth, urlFor);
      const result = { ok: true, status: 200, count: times.length };
      if (errors.length) result.errors = errors;
      return result;
    };

    const mainResult = await evaluate('main').catch((error) => ({ ok:false, status:0, count:0, error: error.message }));
    const parentsResult = await evaluate('parents').catch((error) => ({ ok:false, status:0, count:0, error: error.message }));

    const forbidden = (r) => !r.ok && (r.status === 403 || r.status === 404 || r.statusCode === 403 || r.statusCode === 404);
    let suggestedAccount = null;
    if (parentsResult.ok && forbidden(mainResult)) {
      suggestedAccount = 'parents';
    } else if (mainResult.ok && forbidden(parentsResult)) {
      suggestedAccount = 'main';
    }

    const suggestion = suggestedAccount
      ? `Update location-config.json city '${city}' to account '${suggestedAccount}'`
      : null;

    res.status(200).json({
      ok: true,
      city,
      window: { from, to },
      main: mainResult,
      parents: parentsResult,
      suggestedAccount,
      suggestion
    });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
};
