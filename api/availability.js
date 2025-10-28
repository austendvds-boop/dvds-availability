const path = require("path");

const checkCityData = require(path.join(__dirname, "check_city.json"));

module.exports = (req, res) => {
  res.status(200).json({ ok: true, locations: checkCityData });
};
