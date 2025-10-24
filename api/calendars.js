const { URL } = require("url");

const ALLOWED_ORIGINS = new Set([
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
]);

const DEFAULT_TZ = process.env.TZ_DEFAULT || "America/Phoenix";

const credentialForAccount = (account) => {
  if (account === "parents") {
    return {
      user: process.env.ACUITY_PARENTS_USER_ID,
      key: process.env.ACUITY_PARENTS_API_KEY
    };
  }
  return {
    user: process.env.ACUITY_MAIN_USER_ID || process.env.ACUITY_USER_ID,
    key: process.env.ACUITY_MAIN_API_KEY || process.env.ACUITY_API_KEY
  };
};

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
  const { user, key } = credentialForAccount(account);

  if (!user || !key) {
    return res.status(500).json({ ok: false, error: "Missing Acuity credentials" });
  }

  const url = new URL("https://acuityscheduling.com/api/v1/calendars");
  url.searchParams.set("timezone", DEFAULT_TZ);

  const auth =
    "Basic " + Buffer.from(`${user}:${key}`, "utf8").toString("base64");

  try {
    const response = await fetch(url, { headers: { Authorization: auth } });
    const text = await response.text();
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ ok: false, error: text || `Acuity ${response.status}` });
    }

    let calendars;
    try {
      calendars = JSON.parse(text);
    } catch (error) {
      calendars = text;
    }

    return res.status(200).json({
      ok: true,
      account,
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
