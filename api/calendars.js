// TODO: update appointmentTypeId values with real IDs for each city
const CALENDARS = {
  anthem:       { label: "Anthem",       appointmentTypeId: "50529778" },
  ahwatukee:    { label: "Ahwatukee",    appointmentTypeId: "50529778" },
  apachejunction:{ label:"Apache Junction", appointmentTypeId:"50529778" },
  chandler:     { label: "Chandler",     appointmentTypeId: "50529778" },
  gilbert:      { label: "Gilbert",      appointmentTypeId: "50529778" },
  mesa:         { label: "Mesa",         appointmentTypeId: "50529778" },
  scottsdale:   { label: "Scottsdale",   appointmentTypeId: "50529778" },
  tempe:        { label: "Tempe",        appointmentTypeId: "50529778" },
  parents:      { label: "Parents",      appointmentTypeId: "50529778" }
};
module.exports = (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.deervalleydrivingschool.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.status(200).end();
  res.status(200).json({ ok:true, calendars: CALENDARS });
};
module.exports.MAP = CALENDARS;
