const { randomUUID } = require("crypto");

const {
  applyCors,
  normalizeAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById
} = require("./_acuity");

const {
  LOCATION_POOLS,
  resolveLocationCalendars
} = require("./location-availability");

const inferAccountFromLocation = (cityTypes, providedAccount, locationKey, fallbackAccount) => {
  if (providedAccount) return normalizeAccount(providedAccount);
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) return normalizeAccount(fallbackAccount || "main");
  if (cityTypes.parents?.[normalizedLocation]) return "parents";
  const compact = normalizedLocation.replace(/\s+/g, "");
  if (cityTypes.parents?.[compact]) return "parents";
  if (cityTypes.main?.[normalizedLocation]) return "main";
  if (cityTypes.main?.[compact]) return "main";
  return normalizeAccount(fallbackAccount || "main");
};

const resolveCityTypeId = (cityTypes, account, locationKey) => {
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) return null;
  const map = cityTypes[account] || {};
  const direct = map[normalizedLocation];
  if (direct) return String(direct);
  const compact = normalizedLocation.replace(/\s+/g, "");
  if (map[compact]) return String(map[compact]);
  return null;
};

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

  const cityTypes = loadCityTypes();
  const account = inferAccountFromLocation(cityTypes, accountParam, normalizedLocation, poolEntry.account);

  const configuredTypeId =
    resolveCityTypeId(cityTypes, account, normalizedLocation) || poolEntry.appointmentTypeId || null;

  const typeInfo = configuredTypeId ? await getTypeById(account, configuredTypeId) : null;

  try {
    const {
      configured,
      configuredIds,
      configuredSource,
      ids,
      unresolvedNames,
      calendarSource,
      typeCalendarIds
    } = await resolveLocationCalendars(account, normalizedLocation, {
      appointmentTypeId: configuredTypeId,
      typeInfo
    });

    if (!configured.length) {
      return send(404, { ok: false, error: `No calendars configured for \"${normalizedLocation}\"`, account });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return send(200, {
      ok: true,
      account,
      location: normalizedLocation,
      configuredTypeId,
      typeExists: Boolean(typeInfo),
      configured,
      configuredIds,
      configuredSource,
      calendarSource,
      resolvedIds: ids,
      unresolved: unresolvedNames,
      typeCalendarIds: Array.isArray(typeCalendarIds) && typeCalendarIds.length ? typeCalendarIds : undefined
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
