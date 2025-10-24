const { DEFAULT_TZ, getCredentials, getCalendars } = require("../lib/acuity-client");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const respondCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

module.exports = async (req, res) => {
  respondCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const accountParam = String(req.query?.account || "");
  const account = /parents/i.test(accountParam) ? "parents" : "main";

  const credentials = getCredentials(account);
  if (!credentials.user || !credentials.key) {
    return res.status(500).json({ ok: false, error: "Missing Acuity credentials" });
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const calendars = await getCalendars(account);
    return res.status(200).json({
      ok: true,
      account,
      timezone: DEFAULT_TZ,
      count: Array.isArray(calendars) ? calendars.length : undefined,
      calendars
    });
  } catch (error) {
    return res
      .status(502)
      .json({ ok: false, error: error?.message || "Failed to load calendars" });
  }
};

module.exports.config = { runtime: "nodejs20.x" };
