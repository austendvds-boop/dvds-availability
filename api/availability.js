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
    return {
      user: process.env.ACUITY_PARENTS_USER_ID,
      key:  process.env.ACUITY_PARENTS_API_KEY,
      label: "parents"
    };
  }
  // default → MAIN (also covers "students")
  return {
    user: process.env.ACUITY_MAIN_USER_ID,
    key:  process.env.ACUITY_MAIN_API_KEY,
    label: "main"
  };
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const city = url.searchParams.get("city");
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to   = url.searchParams.get("to");   // YYYY-MM-DD

    if (!city) return res.status(400).json({ ok:false, error:"Missing ?city" });

    const types = require("../city-types.json");
    const locs  = require("../location-config.json");

    const apptType = types[city];
    const cfg = locs[city] || {}; // may contain { account, calendarId, url, ... }

    if (!apptType) {
      return res.status(404).json({ ok:false, error:`Unknown city or missing appointmentType for "${city}"` });
    }

    const { user, key, label } = pickCreds(cfg.account);
    if (!user || !key) {
      return res.status(500).json({ ok:false, error:`Missing ${label.toUpperCase()} credentials in env` });
    }

    const tz = pickTimezone();
    const defaultDays = pickDefaultDays();

    // date range defaults
    function ymd(d) { return d.toISOString().slice(0,10); }
    const today = new Date();
    const start = from || ymd(today);
    const end   = to || ymd(new Date(today.getTime() + defaultDays*24*60*60*1000));

    const qs = new URLSearchParams({
      appointmentTypeID: String(apptType),
      timezone: tz,
      from: start,
      to: end
    });

    if (cfg.calendarId) qs.set("calendarID", String(cfg.calendarId));

    const acuityURL = `https://acuityscheduling.com/api/v1/availability/times?${qs.toString()}`;
    const auth = Buffer.from(`${user}:${key}`).toString("base64");

    const resp = await fetch(acuityURL, { headers: { Authorization: `Basic ${auth}` } });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>"");
      const detail = resp.status === 400 || resp.status === 401 ? text : text.slice(0,500);
      return res.status(resp.status).json({ ok:false, error:`Acuity ${resp.status}`, detail });
    }

    const data = await resp.json(); // array of availability objects
    const times = Array.isArray(data) ? data.map(t => ({
      time: t.time,
      slots: t.slots ?? 1,
      readable: new Date(t.time).toLocaleString("en-US", { timeZone: tz })
    })) : [];

    res.status(200).json({
      ok: true,
      city,
      account: cfg.account || "main",
      appointmentType: apptType,
      calendarId: cfg.calendarId ?? null,
      timezone: tz,
      range: { from: start, to: end },
      count: times.length,
      times
    });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
};
