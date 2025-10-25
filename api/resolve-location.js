const { randomUUID } = require("crypto");

const {
  applyCors,
  normalizeAccount,
  normalizeLocation
} = require("./_acuity");

const {
  LOCATION_POOLS,
  resolveLocationCalendars
} = require("./location-availability");

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

  const { account: accountParam, location: locationParam } = req.query || {};
  const normalizedLocation = normalizeLocation(locationParam || "");
  if (!normalizedLocation) {
    return send(400, { ok: false, error: "Missing location" });
  }

  const poolEntry = LOCATION_POOLS[normalizedLocation];
  if (!poolEntry) {
    return send(404, { ok: false, error: `Unknown location \"${normalizedLocation}\"` });
  }

  const account = normalizeAccount(accountParam || poolEntry.account || "main");

  try {
    const { configured, ids, unresolvedNames } = await resolveLocationCalendars(account, normalizedLocation);
    if (!configured.length) {
      return send(404, { ok: false, error: `No calendars configured for \"${normalizedLocation}\"`, account });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return send(200, {
      ok: true,
      account,
      location: normalizedLocation,
      configured,
      resolvedIds: ids,
      unresolved: unresolvedNames
    });
  } catch (error) {
    const status = error?.status || 502;
    return send(status, {
      ok: false,
      error: error?.message || "Failed to resolve location",
      account
    });
  }
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
