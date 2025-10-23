const allowedOrigins = [
  "https://www.deervalleydrivingschool.com",
  "https://dvds-availability.vercel.app"
];

export default async function handler(req, res) {
  const origin = req.headers?.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://www.deervalleydrivingschool.com");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { location, appointmentTypeId } = req.query ?? {};
  if (!location || !appointmentTypeId) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing required query parameters" });
  }

  const userId = process.env.ACUITY_USER_ID;
  const apiKey = process.env.ACUITY_API_KEY;
  if (!userId || !apiKey) {
    return res
      .status(500)
      .json({ ok: false, error: "Missing Acuity credentials" });
  }

  try {
    const baseUrl = "https://acuityscheduling.com/api/v1/availability/times";
    const authHeader = Buffer.from(`${userId}:${apiKey}`).toString("base64");
    const url = new URL(baseUrl);
    url.searchParams.set("appointmentTypeID", appointmentTypeId);
    url.searchParams.set("calendar", location);

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${authHeader}` }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Acuity request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return res
      .status(200)
      .json({ ok: true, location, appointmentTypeId, times: data });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, error: error.message ?? "Unknown error" });
  }
}
