const {
  ZIP_TO_CITY,
  CITY_TO_CALENDAR,
  getCityForZip,
  getCalendarForCity,
} = require("./_locations");

function sendCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = function handler(req, res) {
  sendCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "public, max-age=3600");

  const { zip, city } = req.query;

  if (zip) {
    const normalizedZip = Array.isArray(zip) ? zip[0] : zip;
    const matchedCity = getCityForZip(normalizedZip);

    if (!matchedCity) {
      return res.status(404).json({
        ok: false,
        error: `No service city found for ZIP ${normalizedZip}`,
      });
    }

    return res.status(200).json({
      ok: true,
      zip: normalizedZip,
      city: matchedCity,
      calendarId: getCalendarForCity(matchedCity) ?? null,
    });
  }

  if (city) {
    const normalizedCity = Array.isArray(city) ? city[0] : city;
    const calendarId = getCalendarForCity(normalizedCity);

    if (!calendarId) {
      return res.status(404).json({
        ok: false,
        error: `No calendar mapping found for city ${normalizedCity}`,
      });
    }

    return res.status(200).json({
      ok: true,
      city: normalizedCity,
      calendarId,
    });
  }

  return res.status(200).json({
    ok: true,
    zipToCity: ZIP_TO_CITY,
    cityToCalendar: CITY_TO_CALENDAR,
  });
};
