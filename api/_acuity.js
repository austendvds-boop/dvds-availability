const fs = require('fs');
const path = require('path');

let _types, _locCfg;

function readJSON(p) {
  const abs = path.resolve(process.cwd(), p);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function loadCityTypes() {
  return _types || (_types = readJSON('city-types.json'));
}

function loadLocationConfig() {
  return _locCfg || (_locCfg = readJSON('location-config.json'));
}

module.exports = {
  loadCityTypes,
  loadLocationConfig,
};
