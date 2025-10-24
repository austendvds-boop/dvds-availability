const { DEFAULT_TZ, getCalendars, credentialForAccount } = require("../lib/acuity");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const accountParam = String(req.query?.account || "");
  const account = /parents/i.test(accountParam) ? "parents" : "main";

  try {
    const { user, key } = credentialForAccount(account);
    if (!user || !key) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing Acuity credentials" });
    }

    const { calendars } = await getCalendars(account);

    return res.status(200).json({
      ok: true,
      account,
      timezone: DEFAULT_TZ,
      count: Array.isArray(calendars) ? calendars.length : undefined,
      calendars
    });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, error: error?.message || "Internal error" });
  }
};

module.exports.config = {
  runtime: "nodejs20.x"
};
