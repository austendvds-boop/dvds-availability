const allowedOrigin = "https://www.deervalleydrivingschool.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { location, appointmentTypeId } = req.query;
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
    const requestUrl =
      `${baseUrl}?appointmentTypeID=${encodeURIComponent(appointmentTypeId)}` +
      `&calendar=${encodeURIComponent(location)}`;

    const response = await fetch(requestUrl, {
      headers: { Authorization: `Basic ${authHeader}` }
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      throw new Error(
        errorPayload?.message || `Acuity request failed with ${response.status}`
      );
    }

    const data = await response.json();
    return res
      .status(200)
      .json({ ok: true, location, appointmentTypeId, times: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}
