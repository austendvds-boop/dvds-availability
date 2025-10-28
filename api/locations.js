const {
  applyCors,
  loadCityTypes,
  getConfiguredLocationIds
} = require("./_acuity");

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const cityTypes = loadCityTypes();
    const locations = [];

    for (const account of ["main", "parents"]) {
      const entries = cityTypes[account] || {};
      for (const [key, appointmentTypeId] of Object.entries(entries)) {
        const { configuredIds } = getConfiguredLocationIds(account, key);

        locations.push({
          key,
          label: key.replace(/\b\w/g, (char) => char.toUpperCase()),
          account,
          appointmentTypeId: String(appointmentTypeId),
          configuredIds,
          calendarCount: configuredIds.length,
          isConfigured: configuredIds.length > 0
        });
      }
    }

    locations.sort((a, b) => {
      if (a.isConfigured !== b.isConfigured) {
        return a.isConfigured ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });

    return res.status(200).json({
      ok: true,
      locations,
      configuredCount: locations.length
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load locations"
    });
  }
};
