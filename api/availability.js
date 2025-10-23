const {
  getCityForZip,
  getCalendarForCity,
} = require("./_locations");

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function ensureEnv() {
  const userId = process.env.ACUITY_USER_ID;
  const apiKey = process.env.ACUITY_API_KEY;

  if (!userId || !apiKey) {
    throw new Error("Missing ACUITY credentials");
  }

  return { userId, apiKey };
}

async function fetchAvailability({ calendarId, appointmentTypeId, startDate }) {
  const { userId, apiKey } = ensureEnv();
  const searchParams = new URLSearchParams({
    appointmentTypeID: String(appointmentTypeId),
    calendarID: String(calendarId),
  });

  if (startDate) {
    searchParams.set("startDate", startDate);
  }

  const response = await fetch(
    `https://acuityscheduling.com/api/v1/availability/times?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${userId}:${apiKey}`).toString("base64")}`,
        "User-Agent": "dvd-availability-api",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error("Acuity request failed");
    error.status = response.status;
    error.body = text;
    throw error;
  }

  return response.json();
}

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { location, zip, appointmentTypeId, startDate } = req.query;
  const normalizedLocation = Array.isArray(location) ? location[0] : location;
  const normalizedZip = Array.isArray(zip) ? zip[0] : zip;
  const normalizedAppointment = Array.isArray(appointmentTypeId)
    ? appointmentTypeId[0]
    : appointmentTypeId;
  const normalizedStartDate = Array.isArray(startDate) ? startDate[0] : startDate;

  const calendarCity =
    normalizedLocation || getCityForZip(normalizedZip ?? "");
  const calendarId = getCalendarForCity(calendarCity);

  if (!calendarId) {
    return res.status(400).json({
      ok: false,
      error: "Unknown location. Provide a valid location or zip parameter.",
    });
  }

  if (!normalizedAppointment) {
    return res.status(400).json({
      ok: false,
      error: "Missing required appointmentTypeId parameter.",
    });
  }

  try {
    const data = await fetchAvailability({
      calendarId,
      appointmentTypeId: normalizedAppointment,
      startDate: normalizedStartDate,
    });

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
    return res.status(200).json({
      ok: true,
      location: calendarCity,
      calendarId,
      appointmentTypeId: normalizedAppointment,
      data,
    });
  } catch (error) {
    const status = error.status || 502;
    return res.status(status).json({
      ok: false,
      error: error.message,
      details: error.body || undefined,
    });
  }
};
