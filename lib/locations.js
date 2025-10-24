const LOCATION_CONFIG = {
  anthem: { label: "Anthem", appointmentTypeId: "50529778", account: "main" },
  ahwatukee: { label: "Ahwatukee", appointmentTypeId: "50529778", account: "main" },
  apachejunction: {
    label: "Apache Junction",
    appointmentTypeId: "50529778",
    account: "main"
  },
  chandler: { label: "Chandler", appointmentTypeId: "50529778", account: "main" },
  gilbert: { label: "Gilbert", appointmentTypeId: "50529778", account: "main" },
  mesa: { label: "Mesa", appointmentTypeId: "50529778", account: "main" },
  scottsdale: { label: "Scottsdale", appointmentTypeId: "50529778", account: "main" },
  tempe: { label: "Tempe", appointmentTypeId: "50529778", account: "main" },
  parents: { label: "Parents", appointmentTypeId: "50529778", account: "parents" }
};

const ZIP_TO_CITY = {
  "85085": "anthem",
  "85048": "ahwatukee",
  "85254": "scottsdale",
  "85233": "gilbert",
  "85281": "tempe"
};

const normalizeLocation = (value = "") => value.trim().toLowerCase();

const getLocationConfig = (value) => LOCATION_CONFIG[normalizeLocation(value)] || null;

module.exports = {
  LOCATION_CONFIG,
  ZIP_TO_CITY,
  normalizeLocation,
  getLocationConfig
};
