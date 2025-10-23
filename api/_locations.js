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

module.exports = {
  ZIP_TO_CITY,
  CITY_TO_CALENDAR,
  getCityForZip,
  getCalendarForCity,
};
