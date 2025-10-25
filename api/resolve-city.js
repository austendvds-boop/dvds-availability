const { applyCors, pickAccount, loadCityTypes, normalizeLocation } = require("./_acuity");

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const account = pickAccount(req.query);
  const cityTypes = loadCityTypes();
  const bucket = cityTypes[account] || {};

  if (String(req.query?.list || "") === "1") {
    return res.status(200).json({
      ok: true,
      account,
      cities: Object.keys(bucket)
    });
  }

  const city = normalizeLocation(req.query?.location || "");
  const compact = city.replace(/\s+/g, "");
  const typeId = bucket[city] || bucket[compact] || null;

  return res.status(200).json({
    ok: true,
    account,
    city: city || null,
    typeId
  });
};
