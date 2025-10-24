const { MAP: CALENDARS } = require("./calendars");
// Seeded ZIPs; expand later with full AZ coverage
const ZIP_TO_CITY = {
  "85085":"anthem", "85048":"ahwatukee",
  "85254":"scottsdale", "85233":"gilbert", "85281":"tempe"
};
module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.deervalleydrivingschool.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const zip = String(req.query?.zip || "").trim();
  if (!zip) return res.status(400).json({ ok:false, error:"Missing zip" });
  const cityKey = ZIP_TO_CITY[zip] || "scottsdale"; // fallback until full map is added
  const cal = CALENDARS[cityKey];
  if (!cal) return res.status(404).json({ ok:false, error:`No calendar for ${cityKey}` });
  res.status(200).json({ ok:true, zip, cityKey, calendar: cal.label, appointmentTypeId: cal.appointmentTypeId });
};
