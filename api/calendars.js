const { randomUUID } = require("crypto");

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

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  const send = (status, payload) => res.status(status).json({ requestId, ...payload });
  const logError = (message, meta = {}) => {
    console.error(`[calendars] ${message}`, { requestId, ...meta });
  };

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(405, { ok: false, error: "Method not allowed" });
  }

  const accountParam = String(req.query?.account || "");
  const account = /parents/i.test(accountParam) ? "parents" : "main";

  const credentials = getCredentials(account);
  if (!credentials.user || !credentials.key) {
    logError("missing acuity credentials", { account });
    return send(500, { ok: false, error: "Missing Acuity credentials" });
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const calendars = await getCalendars(account);
    return send(200, {
      ok: true,
      account,
      timezone: DEFAULT_TZ,
      count: Array.isArray(calendars) ? calendars.length : undefined,
      calendars
    });
  } catch (error) {
    logError("calendar fetch failed", { account, error: error?.message });
    return send(502, { ok: false, error: error?.message || "Failed to load calendars" });
  }
};

module.exports.config = { runtime: "nodejs20.x" };
