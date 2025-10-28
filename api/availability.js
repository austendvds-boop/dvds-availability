const fetch = global.fetch;

function pickTimezone() {
  return process.env.ACUITY_TIMEZONE || process.env.TZ_DEFAULT || "America/Phoenix";
}
function pickDefaultDays() {
  const n = Number(process.env.ACUITY_DEFAULT_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 14;
}
function pickCreds(account) {
  const isParents = String(account || "").toLowerCase() === "parents";
  if (isParents) {
    return { user: process.env.ACUITY_PARENTS_USER_ID, key: process.env.ACUITY_PARENTS_API_KEY, label: "parents" };
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

// concurrency helper
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
    const url = new URL(req.url, "http://localhost");
    const city = url.searchParams.get("city");
    const fromQ = url.searchParams.get("from");
    const toQ   = url.searchParams.get("to");

    if (!city) return res.status(400).json({ ok:false, error:"Missing ?city" });

    const types = require("../city-types.json");
    const locs  = require("../location-config.json");

    const apptType = types[city];
    const cfg = locs[city] || {};
    if (!apptType) return res.status(404).json({ ok:false, error:`Unknown city or missing appointmentType for "${city}"` });

    const { user, key, label } = pickCreds(cfg.account);
    if (!user || !key) return res.status(500).json({ ok:false, error:`Missing ${label.toUpperCase()} credentials in env` });

    const tz = pickTimezone();
    const defaultDays = pickDefaultDays();

    const today = ymd(new Date());
    const start = fromQ || today;
    const end   = toQ   || ymd(new Date(Date.now() + defaultDays*86400000));
    const auth  = Buffer.from(`${user}:${key}`).toString("base64");

    const base = "https://acuityscheduling.com/api/v1/availability";

    const urlFor = (endpoint, params) => {
      const qs = new URLSearchParams(params);
      if (cfg.calendarId) qs.set("calendarID", String(cfg.calendarId));
      return `${base}/${endpoint}?${qs.toString()}`;
    };

    const rangeQS = {
      appointmentTypeID: String(apptType),
      timezone: tz,
      from: start,
      to: end
    };
    let { resp: r1, json: j1, text: t1 } = await acuityJSON(urlFor("times", rangeQS), auth);

    if (r1.ok && Array.isArray(j1)) {
      const times = j1.map(t => ({
        time: t.time,
        slots: t.slots ?? 1,
        readable: new Date(t.time).toLocaleString("en-US", { timeZone: tz })
      }));
      try { res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60'); } catch {}
      return res.status(200).json({ ok:true, city, account: cfg.account || "main", appointmentType: apptType,
        calendarId: cfg.calendarId ?? null, timezone: tz, range: { from: start, to: end }, count: times.length, times });
    }

    const needsDate = r1 && r1.status === 400 && (t1 || "").toLowerCase().includes("date") && (t1 || "").toLowerCase().includes("required");
    if (!r1.ok && !needsDate) {
      return res.status(r1.status || 500).json({ ok:false, error:`Acuity ${r1.status || 500}`, detail: j1 || t1 });
    }

    const days = datesBetween(start, end);
    const { times, errors } = await perDayAggregate(days, tz, apptType, cfg, auth, urlFor);

    try { res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60'); } catch {}

    return res.status(200).json({
      ok: true,
      city,
      account: cfg.account || "main",
      appointmentType: apptType,
      calendarId: cfg.calendarId ?? null,
      timezone: tz,
      range: { from: start, to: end },
      count: times.length,
      times,
      errors
    });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
};
