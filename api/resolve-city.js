const { randomUUID } = require("crypto");

const {
  applyCors,
  normalizeAccount,
  normalizeLocation,
  loadCityTypes,
  listAppointmentTypes
} = require("./_acuity");

const handler = async (req, res) => {
  applyCors(req, res);

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  const send = (status, payload) => res.status(status).json({ requestId, ...payload });

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(405, { ok: false, error: "Method not allowed" });
  }

  const cityTypes = loadCityTypes();
  const account = normalizeAccount(req.query?.account || "main");
  const city = normalizeLocation(req.query?.location || "");

  if (!city) {
    return send(400, { ok: false, error: "Missing location" });
  }

  const configuredMap = cityTypes[account] || {};
  const configuredTypeId = configuredMap[city] || null;

  let typeExists = false;
  if (configuredTypeId) {
    const types = await listAppointmentTypes(account).catch(() => null);
    typeExists = Array.isArray(types)
      ? types.some((type) => String(type?.id) === String(configuredTypeId))
      : false;
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  return send(200, {
    ok: true,
    account,
    city,
    configuredTypeId,
    typeExists
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
