const ZIP_TO_CITY = {
  "85254": "scottsdale",
  "85016": "phoenix",
  "85018": "arcadia",
  "85251": "old-town",
  "85260": "scottsdale-north",
};

const CITY_TO_CALENDAR = {
  scottsdale: 4018261,
  phoenix: 4018262,
  arcadia: 4018263,
  "old-town": 4018264,
  "scottsdale-north": 4018265,
};

function getCityForZip(zip) {
  if (!zip) {
    return null;
  }

  return ZIP_TO_CITY[String(zip).trim()];
}

function getCalendarForCity(city) {
  if (!city) {
    return null;
  }

  return CITY_TO_CALENDAR[String(city).toLowerCase()];
}

function sendCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handler(req, res) {
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
}

module.exports = handler;
module.exports.ZIP_TO_CITY = ZIP_TO_CITY;
module.exports.CITY_TO_CALENDAR = CITY_TO_CALENDAR;
module.exports.getCityForZip = getCityForZip;
module.exports.getCalendarForCity = getCalendarForCity;
module.exports.config = { runtime: "nodejs20.x" };
