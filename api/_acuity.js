const fs = require('fs');
const path = require('path');

let _types;
let _locCfg;

function readJSON(p) {
  const abs = path.resolve(process.cwd(), p);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function loadCityTypes() {
  if (_types) return _types;
  _types = readJSON('city-types.json');
  return _types;
}

function loadLocationConfig() {
  if (_locCfg) return _locCfg;
  _locCfg = readJSON('location-config.json');
  return _locCfg;
}

function getTypeById(id) {
  const types = loadCityTypes();
  return types[id] || null;
}

function getLocations() {
  const cfg = loadLocationConfig();
  if (!cfg || !Array.isArray(cfg.locations)) return [];
  return cfg.locations;
}

function getLocationByKey(key) {
  return getLocations().find((loc) => loc.key === key) || null;
}

function buildSchedulingUrl(acuity) {
  if (!acuity || !acuity.appointmentType) return null;
  const baseUrl = acuity.baseUrl || 'https://app.acuityscheduling.com/schedule.php';
  const url = new URL(baseUrl);
  if (acuity.owner) url.searchParams.set('owner', acuity.owner);
  url.searchParams.set('appointmentType', acuity.appointmentType);
  return url.toString();
}

function isLocationConfigured(loc) {
  return Boolean(buildSchedulingUrl(loc && loc.acuity));
}

function toAcuityMetadata(loc) {
  const acuity = loc ? loc.acuity : null;
  const url = buildSchedulingUrl(acuity);
  return {
    owner: acuity && acuity.owner ? acuity.owner : null,
    appointmentType: acuity && acuity.appointmentType ? acuity.appointmentType : null,
    url,
  };
}

module.exports = {
  loadCityTypes,
  loadLocationConfig,
  getTypeById,
  getLocations,
  getLocationByKey,
  buildSchedulingUrl,
  isLocationConfigured,
  toAcuityMetadata,
};
