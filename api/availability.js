const { randomUUID } = require("crypto");

const {
  normalizeAccount,
  normalizeLocation,
  applyCors,
  acuityFetch,
  listCalendars,
  loadCityTypes,
  getTypeById
} = require("./_acuity");

const { getConfiguredIdentifiers } = require("../lib/location-config");

const CALENDAR_IDS = {
  main: {
    anthem: { label: "Anthem", calendarId: null },
    ahwatukee: { label: "Ahwatukee", calendarId: null },
    apachejunction: { label: "Apache Junction", calendarId: null },
    casagrande: { label: "Casa Grande", calendarId: null },
    cavecreek: { label: "Cave Creek", calendarId: null },
    downtownphoenix: { label: "Downtown Phoenix", calendarId: null },
    chandler: { label: "Chandler", calendarId: null },
    gilbert: { label: "Gilbert", calendarId: null },
    mesa: { label: "Mesa", calendarId: null },
    queencreek: { label: "Queen Creek", calendarId: null },
    santanvalley: { label: "San Tan Valley", calendarId: null },
    scottsdale: { label: "Scottsdale", calendarId: null },
    tempe: { label: "Tempe", calendarId: null }
  },
  parents: {
    anthem: { label: "Anthem", calendarId: null },
    glendale: { label: "Glendale", calendarId: null },
    northphoenix: { label: "North Phoenix", calendarId: null },
    peoria: { label: "Peoria", calendarId: null },
    suncity: { label: "Sun City", calendarId: null },
    surprise: { label: "Surprise", calendarId: null },
    parents: { label: "Parents", calendarId: null }
  }
};

const aliasCalendar = (account, sourceKey, aliasKey) => {
  if (CALENDAR_IDS[account] && CALENDAR_IDS[account][sourceKey]) {
    CALENDAR_IDS[account][aliasKey] = CALENDAR_IDS[account][sourceKey];
  }
};

aliasCalendar("main", "apachejunction", "apache junction");
aliasCalendar("main", "casagrande", "casa grande");
aliasCalendar("main", "cavecreek", "cave creek");
aliasCalendar("main", "downtownphoenix", "downtown phoenix");
aliasCalendar("main", "queencreek", "queen creek");
aliasCalendar("main", "santanvalley", "san tan valley");
aliasCalendar("parents", "northphoenix", "north phoenix");
aliasCalendar("parents", "suncity", "sun city");

const parseCalendarId = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const matchCalendarIds = (calendars, label) => {
  if (!Array.isArray(calendars)) return [];
  const target = normalizeLocation(label || "");
  if (!target) return [];
  const matches = [];
  for (const calendar of calendars) {
    const name = normalizeLocation(calendar?.name || "");
    if (!name) continue;
    if (name === target || name.includes(target) || target.includes(name)) {
      const parsed = parseCalendarId(calendar?.id);
      if (parsed != null) {
        matches.push(parsed);
      }
    }
  }
  return matches;
};

const getCalendarEntry = (account, locationKey) => {
  const normalizedAccount = normalizeAccount(account);
  const normalizedLocation = normalizeLocation(locationKey || "");
  const compact = normalizedLocation.replace(/\s+/g, "");
  const accountCalendars = CALENDAR_IDS[normalizedAccount] || {};
  return (
    accountCalendars[normalizedLocation] ||
    accountCalendars[compact] ||
    null
  );
};

const ensureCalendarId = async (account, locationKey) => {
  const entry = getCalendarEntry(account, locationKey);
  if (!entry) return null;

  if (entry.calendarId != null) {
    const parsed = parseCalendarId(entry.calendarId);
    if (parsed != null) return parsed;
  }

  const normalizedAccount = normalizeAccount(account);
  const normalizedLocation = normalizeLocation(locationKey || "");
  const configured = getConfiguredIdentifiers(normalizedAccount, normalizedLocation);
  if (configured.numeric.length) {
    const resolved = configured.numeric[0];
    entry.calendarId = resolved;
    entry.calendarIdSource = "config";
    return resolved;
  }

  const calendars = await listCalendars(normalizedAccount).catch((error) => {
    const err = new Error(error?.message || "Unable to load calendars");
    err.status = error?.status || 500;
    throw err;
  });

  const candidateNames = [entry.label, normalizedLocation].filter(Boolean);
  for (const name of candidateNames) {
    const matches = matchCalendarIds(calendars, name);
    if (matches.length) {
      entry.calendarId = matches[0];
      entry.calendarIdSource = "lookup";
      return matches[0];
    }
  }

  return null;
};

const extractTypeCalendarIds = (type) => {
  if (!type) return [];
  const ids = [];
  const push = (value) => {
    const parsed = parseCalendarId(value);
    if (parsed != null) ids.push(parsed);
  };

  if (Array.isArray(type.calendarIDs)) {
    type.calendarIDs.forEach(push);
  }
  if (Array.isArray(type.calendarIds)) {
    type.calendarIds.forEach(push);
  }
  if (Array.isArray(type.calendars)) {
    type.calendars.forEach((calendar) => {
      push(calendar?.id);
      push(calendar?.calendarID);
      push(calendar?.calendarId);
    });
  }

  return [...new Set(ids)];
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

  const query = req.query || {};
  const locationParam = query.location || query.city || "";
  const normalizedLocation = normalizeLocation(locationParam);

  const cityTypes = loadCityTypes();
  let account = inferAccountFromLocation(cityTypes, query.account, normalizedLocation);
  account = normalizeAccount(account);

  const { id: resolvedTypeId, source: appointmentTypeSource } = resolveAppointmentTypeId(
    cityTypes,
    account,
    normalizedLocation,
    query.appointmentTypeId
  );

  const appointmentTypeId = resolvedTypeId;
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

  const primaryCalendarId = parseCalendarId(query.calendarId);
  const altCalendarId = parseCalendarId(query.calendarID);
  const candidateMap = new Map();
  const addCandidate = (value, source) => {
    const parsed = parseCalendarId(value);
    if (parsed == null) return;
    if (!candidateMap.has(parsed)) {
      candidateMap.set(parsed, source);
    }
  };

  if (primaryCalendarId != null) addCandidate(primaryCalendarId, "query");
  if (altCalendarId != null) addCandidate(altCalendarId, "query");

  const configured = normalizedLocation
    ? getConfiguredIdentifiers(account, normalizedLocation)
    : { numeric: [], names: [], raw: [] };

  configured.numeric.forEach((id) => addCandidate(id, "config"));

  let calendarsCache = null;
  const loadCalendarsList = async () => {
    if (calendarsCache) return calendarsCache;
    calendarsCache = await listCalendars(account).catch(() => []);
    return calendarsCache;
  };

  if (configured.names && configured.names.length) {
    const calendars = await loadCalendarsList();
    for (const name of configured.names) {
      matchCalendarIds(calendars, name).forEach((id) => addCandidate(id, "config"));
    }
  }

  const typeInfo = await getTypeById(account, appointmentTypeId);
  const typeCalendarIds = extractTypeCalendarIds(typeInfo);
  typeCalendarIds.forEach((id) => addCandidate(id, "type"));

  if (candidateMap.size === 0 && Array.isArray(typeInfo?.calendars)) {
    const calendars = await loadCalendarsList();
    for (const calendar of typeInfo.calendars) {
      const name = calendar?.name || calendar?.calendar || calendar?.label;
      matchCalendarIds(calendars, name).forEach((id) => addCandidate(id, "type"));
    }
  }

  if (candidateMap.size === 0 && normalizedLocation) {
    const entry = getCalendarEntry(account, normalizedLocation);
    if (entry?.calendarId != null) {
      addCandidate(entry.calendarId, entry.calendarIdSource || "cache");
    }
    const calendars = await loadCalendarsList();
    const namesToTry = [];
    if (entry?.label) namesToTry.push(entry.label);
    if (normalizedLocation) namesToTry.push(normalizedLocation);
    for (const name of namesToTry) {
      matchCalendarIds(calendars, name).forEach((id) => addCandidate(id, "lookup"));
    }
  }

  if (candidateMap.size === 0) {
    const calendars = await loadCalendarsList();
    calendars.forEach((calendar) => addCandidate(calendar?.id, "all"));
  }

  const candidates = Array.from(candidateMap.entries()).map(([id, source]) => ({ id, source }));
  if (!candidates.length) {
    return send(404, { ok: false, error: "No calendar candidates available", account });
  }

  const attemptErrors = [];
  let selectedCandidate = null;
  let times = [];

  for (const candidate of candidates) {
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
    calendarCandidates: candidates,
    configuredCalendarIds: configured.numeric,
    configuredCalendarNames: configured.names,
    typeCalendarIds,
    errors: attemptErrors.length ? attemptErrors : undefined,
    count,
    times
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.CALENDAR_IDS = CALENDAR_IDS;
module.exports.ensureCalendarId = ensureCalendarId;
