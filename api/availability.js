const { randomUUID } = require("crypto");

const {
  normalizeAccount,
  normalizeLocation,
  applyCors,
  acuityFetch,
  listCalendars,
  loadCityTypes,
  getTypeById,
  getConfiguredLocationEntries
} = require("./_acuity");

const parseCalendarId = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

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

const resolveAppointmentTypeId = (cityTypes, account, locationKey, explicitType) => {
  if (explicitType) {
    return { id: String(explicitType), source: "query" };
  }
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) {
    return { id: null, source: null };
  }
  const map = cityTypes[account] || {};
  const direct = map[normalizedLocation];
  if (direct) {
    return { id: String(direct), source: "city-types" };
  }
  const compact = normalizedLocation.replace(/\s+/g, "");
  if (map[compact]) {
    return { id: String(map[compact]), source: "city-types" };
  }
  return { id: null, source: null };
};

const parseConfiguredEntries = (account, location) => {
  const identifiers = getConfiguredLocationEntries(account, location);
  const numeric = identifiers.numeric || [];
  const names = identifiers.names || [];
  const raw = identifiers.raw || [];
  return {
    raw,
    numeric: numeric.filter((id) => typeof id === "number" && Number.isFinite(id)),
    names: names.filter((name) => typeof name === "string" && name.trim())
  };
};

const resolveConfiguredIds = async (account, location, typeInfo, { allowEmpty = false } = {}) => {
  const configured = parseConfiguredEntries(account, location);
  if (!allowEmpty && !configured.raw.length) {
    const error = new Error("No calendars configured for this location (strict mode)");
    error.status = 404;
    throw error;
  }

  const resolved = new Set(configured.numeric);
  const unresolvedNames = [];

  if (configured.names.length) {
    const calendars = await listCalendars(account).catch(() => []);
    for (const name of configured.names) {
      const normalized = normalizeLocation(name);
      const match = calendars.find((calendar) => normalizeLocation(calendar?.name || "") === normalized);
      if (match?.id != null) {
        const parsed = parseCalendarId(match.id);
        if (parsed != null) resolved.add(parsed);
      } else {
        unresolvedNames.push(name);
      }
    }
  }

  const resolvedIds = Array.from(resolved.values());
  let typeCalendarIds = Array.isArray(typeInfo?.calendarIDs)
    ? typeInfo.calendarIDs.map(parseCalendarId).filter((id) => id != null)
    : [];
  if (!typeCalendarIds.length && Array.isArray(typeInfo?.calendarIds)) {
    typeCalendarIds = typeInfo.calendarIds.map(parseCalendarId).filter((id) => id != null);
  }
  if (!typeCalendarIds.length && Array.isArray(typeInfo?.calendars)) {
    typeInfo.calendars.forEach((calendar) => {
      const parsed = parseCalendarId(calendar?.id || calendar?.calendarID || calendar?.calendarId);
      if (parsed != null) typeCalendarIds.push(parsed);
    });
  }

  typeCalendarIds = Array.from(new Set(typeCalendarIds.filter((id) => typeof id === "number")));
  const allowedSet = new Set(typeCalendarIds);
  const disallowed = [];
  let finalIds = resolvedIds;
  if (allowedSet.size) {
    finalIds = resolvedIds.filter((id) => allowedSet.has(id));
    disallowed.push(...resolvedIds.filter((id) => !allowedSet.has(id)));
  }

  return {
    configured,
    resolvedIds,
    finalIds,
    typeCalendarIds,
    unresolvedNames,
    disallowed
  };
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
  const locationParam = query.location || query.city || "";
  const normalizedLocation = normalizeLocation(locationParam);

  const cityTypes = loadCityTypes();
  const account = inferAccountFromLocation(cityTypes, query.account, normalizedLocation);

  const { id: appointmentTypeId, source: appointmentTypeSource } = resolveAppointmentTypeId(
    cityTypes,
    account,
    normalizedLocation,
    query.appointmentTypeId
  );

  if (!appointmentTypeId) {
    return send(400, { ok: false, error: "Missing appointmentTypeId", account, location: normalizedLocation || undefined });
  }

  const date = String(query.date || "").trim();
  if (!date) {
    return send(400, { ok: false, error: "Missing date (YYYY-MM-DD)" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return send(400, { ok: false, error: "Invalid date. Use YYYY-MM-DD." });
  }

  const explicitCalendarIds = new Map();
  const addCandidate = (value, source, opts = {}) => {
    const parsed = parseCalendarId(value);
    if (parsed == null) return;
    if (!explicitCalendarIds.has(parsed)) {
      explicitCalendarIds.set(parsed, { source, bypassAllowList: Boolean(opts.bypassAllowList) });
    }
  };

  addCandidate(query.calendarId, "query", { bypassAllowList: true });
  addCandidate(query.calendarID, "query", { bypassAllowList: true });

  const typeInfo = await getTypeById(account, appointmentTypeId);

  let configuredIds = { configured: { raw: [], numeric: [], names: [] }, resolvedIds: [], finalIds: [], typeCalendarIds: [], unresolvedNames: [], disallowed: [] };
  if (normalizedLocation) {
    try {
      configuredIds = await resolveConfiguredIds(account, normalizedLocation, typeInfo);
      configuredIds.finalIds.forEach((id) => addCandidate(id, "config"));
    } catch (error) {
      if (explicitCalendarIds.size === 0) {
        return send(error.status || 404, { ok: false, error: error.message, account, location: normalizedLocation });
      }
    }
  }

  const candidates = [];
  for (const [id, meta] of explicitCalendarIds.entries()) {
    candidates.push({ id, source: meta.source, bypassAllowList: meta.bypassAllowList });
  }

  if (!candidates.length) {
    return send(404, {
      ok: false,
      error: "No calendar IDs available for this request",
      account,
      location: normalizedLocation || undefined
    });
  }

  const attemptErrors = [];
  let selectedCandidate = null;
  let times = [];

  for (const candidate of candidates) {
    if (!candidate.bypassAllowList && configuredIds.typeCalendarIds.length) {
      const allowedSet = new Set(configuredIds.typeCalendarIds);
      if (!allowedSet.has(candidate.id)) {
        attemptErrors.push({
          calendarId: candidate.id,
          source: candidate.source,
          status: 400,
          message: "Calendar ID is not enabled for this appointment type"
        });
        continue;
      }
    }

    try {
      const response = await acuityFetch(account, "availability/times", {
        calendarID: candidate.id,
        appointmentTypeID: appointmentTypeId,
        date
      });
      selectedCandidate = candidate;
      times = Array.isArray(response) ? response : [];
      break;
    } catch (error) {
      attemptErrors.push({
        calendarId: candidate.id,
        source: candidate.source,
        status: error?.status,
        message: error?.message || "Acuity request failed"
      });
    }
  }

  if (!selectedCandidate) {
    const firstError = attemptErrors[0] || {};
    return send(firstError.status || 502, {
      ok: false,
      error: firstError.message || "Unable to fetch availability",
      account,
      appointmentTypeId,
      calendarCandidates: candidates,
      errors: attemptErrors
    });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const count = Array.isArray(times) ? times.length : 0;

  return send(200, {
    ok: true,
    account,
    location: normalizedLocation || undefined,
    appointmentTypeId,
    appointmentTypeSource: appointmentTypeSource || undefined,
    appointmentTypeName: typeInfo?.name,
    date,
    calendarId: selectedCandidate.id,
    calendarSource: selectedCandidate.source,
    configuredCalendarIds: configuredIds.configured.numeric || [],
    configuredCalendarNames: configuredIds.configured.names || [],
    resolvedConfiguredIds: configuredIds.resolvedIds,
    typeCalendarIds: configuredIds.typeCalendarIds,
    disallowedConfiguredIds: configuredIds.disallowed,
    unresolvedConfiguredNames: configuredIds.unresolvedNames,
    calendarCandidates: candidates,
    errors: attemptErrors.length ? attemptErrors : undefined,
    count,
    times
  });
};

module.exports.config = { runtime: "nodejs20.x" };
