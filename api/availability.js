const fetch = global.fetch;
const accountOverride = new Map();

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

const withCors = require('./_cors');

module.exports = withCors(async (req, res) => {
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

    const tz = pickTimezone();
    const defaultDays = pickDefaultDays();

    const today = ymd(new Date());
    const start = fromQ || today;
    const end   = toQ   || ymd(new Date(Date.now() + defaultDays*86400000));

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

    const configuredAccount = cfg.account || "main";
    const normalizedConfigured = normalizeAccount(configuredAccount);
    const cachedAccount = accountOverride.get(city);
    const primaryAccount = cachedAccount || normalizedConfigured;
    const fallbackAccount = primaryAccount === "parents" ? "main" : "parents";

    const attempt = async (accountLabel) => {
      const creds = pickCreds(accountLabel);
      const { user, key, label } = creds;
      if (!user || !key) {
        return {
          success: false,
          status: 500,
          error: `Missing ${label.toUpperCase()} credentials in env`,
          detail: null,
          statusCode: undefined
        };
      }

      const auth = Buffer.from(`${user}:${key}`).toString("base64");
      const { resp: r1, json: j1, text: t1 } = await acuityJSON(urlFor("times", rangeQS), auth);

      if (r1.ok && Array.isArray(j1)) {
        const times = j1.map(t => ({
          time: t.time,
          slots: t.slots ?? 1,
          readable: new Date(t.time).toLocaleString("en-US", { timeZone: tz })
        }));
        return {
          success: true,
          payload: {
            ok: true,
            city,
            account: cfg.account || "main",
            appointmentType: apptType,
            calendarId: cfg.calendarId ?? null,
            timezone: tz,
            range: { from: start, to: end },
            count: times.length,
            times
          }
        };
      }

      const detailPayload = j1 || t1;
      const statusCode = typeof j1 === "object" && j1 !== null ? j1.status_code : undefined;
      const needsDate = r1 && r1.status === 400 && (t1 || "").toLowerCase().includes("date") && (t1 || "").toLowerCase().includes("required");
      if (!r1.ok && !needsDate) {
        return {
          success: false,
          status: r1.status || 500,
          error: `Acuity ${r1.status || 500}`,
          detail: detailPayload,
          statusCode
        };
      }

      const days = datesBetween(start, end);
      const { times, errors } = await perDayAggregate(days, tz, apptType, cfg, auth, urlFor);

      return {
        success: true,
        payload: {
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
        }
      };
    };

    const shouldRetry = (result) => {
      if (!result || result.success) return false;
      const status = result.status;
      const statusCode = result.statusCode;
      return status === 403 || status === 404 || statusCode === 403 || statusCode === 404;
    };

    const finalize = (payload, usedAccount) => {
      const enriched = {
        ...payload,
        accountConfigured: configuredAccount,
        accountUsed: normalizeAccount(usedAccount)
      };
      try { res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60'); } catch {}
      return res.status(200).json(enriched);
    };

    const firstAttempt = await attempt(primaryAccount);
    if (firstAttempt.success) {
      accountOverride.set(city, normalizeAccount(primaryAccount));
      return finalize(firstAttempt.payload, primaryAccount);
    }

    if (shouldRetry(firstAttempt) && fallbackAccount !== primaryAccount) {
      const secondAttempt = await attempt(fallbackAccount);
      if (secondAttempt.success) {
        accountOverride.set(city, normalizeAccount(fallbackAccount));
        return finalize(secondAttempt.payload, fallbackAccount);
      }
    }

    return res.status(firstAttempt.status || 500).json({ ok:false, error: firstAttempt.error, detail: firstAttempt.detail });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});
