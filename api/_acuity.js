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

function getAccountKeys() {
  const types = loadCityTypes() || {};
  const cfg = loadLocationConfig() || {};
  return Array.from(new Set([...Object.keys(types), ...Object.keys(cfg)]));
}

function getLocationEntries() {
  const types = loadCityTypes() || {};
  const cfg = loadLocationConfig() || {};
  const accounts = getAccountKeys();
  const entries = [];

  for (const account of accounts) {
    const typeMap = types[account] || {};
    const configMap = cfg[account] || {};
    const keys = new Set([...Object.keys(typeMap), ...Object.keys(configMap)]);

    for (const key of keys) {
      const appointmentTypeId = typeMap[key];
      const configuredIds = Array.isArray(configMap[key]) ? configMap[key] : [];
      entries.push({
        account,
        key,
        appointmentTypeId: appointmentTypeId != null ? String(appointmentTypeId) : null,
        locationIds: configuredIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
      });
    }
  }

  return entries;
}

function getLocationsByAccount() {
  return getLocationEntries().reduce((acc, entry) => {
    if (!acc[entry.account]) {
      acc[entry.account] = {};
    }
    acc[entry.account][entry.key] = {
      appointmentTypeId: entry.appointmentTypeId,
      locationIds: entry.locationIds,
      isConfigured: entry.locationIds.length > 0,
    };
    return acc;
  }, {});
}

module.exports = {
  loadCityTypes,
  loadLocationConfig,
  getLocationEntries,
  getLocationsByAccount,
};
