const { randomUUID } = require("crypto");

const {
  applyCors,
  normalizeAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById,
  getConfiguredLocationEntries
} = require("./_acuity");

const { resolveConfiguredCalendars } = require("./location-availability");

const inferAccountFromLocation = (cityTypes, providedAccount, locationKey) => {
  if (providedAccount) return normalizeAccount(providedAccount);
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) return "main";
  if (cityTypes.parents?.[normalizedLocation]) return "parents";
  const compact = normalizedLocation.replace(/\s+/g, "");
  if (cityTypes.parents?.[compact]) return "parents";
  if (cityTypes.main?.[normalizedLocation]) return "main";
  if (cityTypes.main?.[compact]) return "main";
  return "main";
};

const resolveTypeId = (cityTypes, account, location, explicit) => {
  if (explicit) return String(explicit);
  const map = cityTypes[account] || {};
  const direct = map[location];
  if (direct) return String(direct);
  const compact = location.replace(/\s+/g, "");
  if (map[compact]) return String(map[compact]);
  return null;
};

module.exports = async (req, res) => {
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

  const query = req.query || {};
  const normalizedLocation = normalizeLocation(query.location || "");
  if (!normalizedLocation) {
    return send(400, { ok: false, error: "Missing location" });
  }

  const cityTypes = loadCityTypes();
  const account = inferAccountFromLocation(cityTypes, query.account, normalizedLocation);
  const configuredEntries = getConfiguredLocationEntries(account, normalizedLocation);

  if (!configuredEntries.raw.length) {
    return send(404, {
      ok: false,
      error: "No calendars configured for this location (strict mode)",
      account,
      location: normalizedLocation
    });
  }

  const appointmentTypeId = resolveTypeId(cityTypes, account, normalizedLocation, query.appointmentTypeId);
  const typeInfo = appointmentTypeId ? await getTypeById(account, appointmentTypeId) : null;

  const resolution = await resolveConfiguredCalendars(account, normalizedLocation, typeInfo);

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  return send(200, {
    ok: true,
    account,
    location: normalizedLocation,
    configuredIds: configuredEntries.numeric,
    configuredNames: configuredEntries.names,
    configuredRaw: configuredEntries.raw,
    appointmentTypeId: appointmentTypeId || null,
    typeExists: Boolean(typeInfo),
    typeCalendarIds: resolution.typeCalendarIds.length ? resolution.typeCalendarIds : undefined,
    resolvedIds: resolution.ids,
    unresolvedNames: resolution.unresolvedNames,
    disallowed: resolution.disallowed
  });
};

module.exports.config = { runtime: "nodejs20.x" };
