const cityTypes = require('../city-types.json');
const locationConfig = require('../location-config.json');

const toTitleCase = (slug) =>
  slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const buildSchedulingUrl = (config, appointmentType) => {
  if (!config) return null;
  if (config.url) return config.url;
  const baseUrl = config.baseUrl;
  if (!baseUrl) return null;

  try {
    const target = new URL(baseUrl);
    if (config.owner != null) {
      target.searchParams.set('owner', String(config.owner));
    }
    if (appointmentType) {
      target.searchParams.set('appointmentType', String(appointmentType));
    }
    return target.toString();
  } catch (_err) {
    return null;
  }
};

module.exports = (_req, res) => {
  try {
    const keys = Array.from(
      new Set([
        ...Object.keys(cityTypes || {}),
        ...Object.keys(locationConfig || {}),
      ])
    );

    const accounts = {};

    keys.forEach((key) => {
      const config = locationConfig[key] || {};
      const label = config.label || toTitleCase(key);
      const appointmentType = cityTypes[key] != null ? String(cityTypes[key]) : null;
      const accountKey = config.account || 'unassigned';
      const owner = config.owner != null ? String(config.owner) : null;
      const baseUrl = config.baseUrl || null;
      const url = buildSchedulingUrl(config, appointmentType);

      if (!accounts[accountKey]) {
        accounts[accountKey] = {};
      }

      accounts[accountKey][label] = {
        key,
        appointmentType,
        owner,
        baseUrl,
        url,
      };
    });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({ ok: true, accounts }));
  } catch (error) {
    res.status(500).end(
      JSON.stringify({ ok: false, error: error?.message || 'Failed to build availability map' })
    );
  }
};
