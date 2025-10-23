import fetch from "node-fetch";

export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://www.deervalleydrivingschool.com"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { location, appointmentTypeId } = req.query;
  if (!location || !appointmentTypeId)
    return res
      .status(400)
      .json({ ok: false, error: "Missing required query parameters" });

  try {
    const baseUrl = "https://acuityscheduling.com/api/v1/availability/times";
    const authHeader = Buffer.from(
      `${process.env.ACUITY_USER_ID}:${process.env.ACUITY_API_KEY}`
    ).toString("base64");

    const response = await fetch(
      `${baseUrl}?appointmentTypeID=${appointmentTypeId}&calendar=${location}`,
      { headers: { Authorization: `Basic ${authHeader}` } }
    );

    const data = await response.json();
    res
      .status(200)
      .json({ ok: true, location, appointmentTypeId, times: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
