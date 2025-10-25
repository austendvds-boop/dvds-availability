const { randomUUID } = require("crypto");

const {
  DEFAULT_TZ,
  normalizeAccount,
  normalizeLocation,
  applyCors,
  listCalendars,
  acuityFetch,
  groupTimesMerge,
  addDaysISO,
  loadCityTypes,
  getTypeById
} = require("./_acuity");

const { LOCATION_CONFIG } = require("./zip-route");
const { getConfiguredIdentifiers } = require("../lib/location-config");

const buildLocationPools = () => {
  const entries = Object.entries(LOCATION_CONFIG || {}).map(([key, value]) => {
    const calendars = Array.isArray(value?.calendars) && value.calendars.length
      ? value.calendars
      : [value?.label].filter(Boolean);
    return [normalizeLocation(key), { ...value, calendars }];
  });
  return Object.fromEntries(entries);
};

const LOCATION_POOLS = buildLocationPools();

const isoDateInTz = (tz = DEFAULT_TZ) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date())
    .replace(/\//g, "-");

const parseCalendarIdentifier = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return trimmed;
  }
  if (typeof value === "object") {
    if (value.id != null) {
      return parseCalendarIdentifier(value.id);
    }
    if (value.name) {
      return String(value.name);
    }
  }
  return null;
};

const findCalendarIdByName = (calendars, label) => {
  if (!Array.isArray(calendars)) return null;
  const target = normalizeLocation(label);
  if (!target) return null;

  const exact = calendars.find((calendar) => normalizeLocation(calendar?.name) === target);
  if (exact?.id != null) {
    const parsed = parseCalendarIdentifier(exact.id);
    if (parsed != null && typeof parsed === "number") return parsed;
  }

  const partial = calendars.find((calendar) => normalizeLocation(calendar?.name).includes(target));
  if (partial?.id != null) {
    const parsed = parseCalendarIdentifier(partial.id);
    if (parsed != null && typeof parsed === "number") return parsed;
  }

  const reverse = calendars.find((calendar) => target.includes(normalizeLocation(calendar?.name)));
  if (reverse?.id != null) {
    const parsed = parseCalendarIdentifier(reverse.id);
    if (parsed != null && typeof parsed === "number") return parsed;
  }

  return null;
};

const resolveCalendarIds = async (account, calendars) => {
  const explicitIds = [];
  const unresolvedNames = [];

  for (const entry of calendars) {
    const parsed = parseCalendarIdentifier(entry);
    if (parsed == null) continue;
    if (typeof parsed === "number") {
      explicitIds.push(parsed);
    } else {
      unresolvedNames.push(parsed);
    }
  }

  if (!unresolvedNames.length) {
    return { ids: [...new Set(explicitIds)], unresolvedNames: [] };
  }

  const liveCalendars = await listCalendars(account);
  const matchedNames = new Set();
  for (const name of unresolvedNames) {
    const resolved = findCalendarIdByName(liveCalendars, name);
    if (resolved != null) {
      explicitIds.push(resolved);
      matchedNames.add(name);
    }
  }

  const unique = [...new Set(explicitIds.filter((id) => typeof id === "number" && Number.isFinite(id)))];
  const stillUnresolved = unresolvedNames.filter((name) => !matchedNames.has(name));

  return { ids: unique, unresolvedNames: stillUnresolved };
};

const dedupeIdentifiers = (values = []) => {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = typeof value === "string" ? `s:${value}` : `n:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
};

const extractTypeCalendarCandidates = (type) => {
  if (!type) return { raw: [], numeric: [], names: [] };
  const collected = [];
  const push = (value) => {
    const parsed = parseCalendarIdentifier(value);
    if (parsed != null) {
      collected.push(parsed);
    }
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
      if (calendar?.name) {
        push(calendar.name);
      }
    });
  }

  const raw = dedupeIdentifiers(collected);
  const numeric = raw.filter((value) => typeof value === "number");
  const names = raw.filter((value) => typeof value === "string");

  return { raw, numeric, names };
};

const extractTypeCalendarIds = (type) => extractTypeCalendarCandidates(type).numeric;

const getFallbackCalendars = (location) => {
  const fallback = LOCATION_POOLS[normalizeLocation(location)];
  if (!fallback) return [];
  const calendars = Array.isArray(fallback?.calendars) ? [...fallback.calendars] : [];
  if (fallback?.label) {
    calendars.push(fallback.label);
  }
  return calendars;
};

const inferAccountFromLocation = (cityTypes, providedAccount, locationKey, defaultAccount) => {
  if (providedAccount) return normalizeAccount(providedAccount);
  const normalizedLocation = normalizeLocation(locationKey || "");
  if (!normalizedLocation) return normalizeAccount(defaultAccount || "main");
  if (cityTypes.parents?.[normalizedLocation]) return "parents";
  const compact = normalizedLocation.replace(/\s+/g, "");
  if (cityTypes.parents?.[compact]) return "parents";
  if (cityTypes.main?.[normalizedLocation]) return "main";
  if (cityTypes.main?.[compact]) return "main";
  return normalizeAccount(defaultAccount || "main");
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

const resolveLocationCalendars = async (account, location, { appointmentTypeId, typeInfo } = {}) => {
  const normalizedAccount = normalizeAccount(account);
  const normalizedLocation = normalizeLocation(location);

  const configured = getConfiguredIdentifiers(normalizedAccount, normalizedLocation);
  const candidateSets = [];

  if (configured.raw.length) {
    candidateSets.push({ source: "config", values: configured.raw });
  }

  const typeCandidates = extractTypeCalendarCandidates(typeInfo);
  if (appointmentTypeId && typeCandidates.raw.length) {
    candidateSets.push({ source: "type", values: typeCandidates.raw, typeCalendars: typeInfo?.calendars || [] });
  }

  const fallbackCandidates = getFallbackCalendars(normalizedLocation);
  if (fallbackCandidates.length) {
    candidateSets.push({ source: "fallback", values: fallbackCandidates });
  }

  let resolved = { ids: [], unresolvedNames: [] };
  let calendarSource = null;
  let configuredUsed = [];
  let unresolvedNames = [];
  let typeCalendars = typeInfo?.calendars || [];
  const typeCalendarIds = extractTypeCalendarIds(typeInfo);

  for (const set of candidateSets) {
    const attempt = await resolveCalendarIds(normalizedAccount, set.values);
    if (set.source === "type" && set.typeCalendars) {
      typeCalendars = set.typeCalendars;
    }
    if (attempt.ids.length) {
      resolved = attempt;
      calendarSource = set.source;
      configuredUsed = set.values;
      unresolvedNames = attempt.unresolvedNames;
      break;
    }
    if (!configuredUsed.length) {
      configuredUsed = set.values;
      unresolvedNames = attempt.unresolvedNames;
    }
  }

  if (!resolved.ids.length) {
    const allCalendars = await listCalendars(normalizedAccount).catch(() => []);
    const ids = (allCalendars || [])
      .map((calendar) => parseCalendarIdentifier(calendar?.id))
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    resolved = { ids: [...new Set(ids)], unresolvedNames: [] };
    calendarSource = "all";
    configuredUsed = (allCalendars || []).map((calendar) => calendar?.id).filter((value) => value != null);
  }

  return {
    ids: resolved.ids,
    unresolvedNames,
    configured: configuredUsed,
    configuredIds: configured.numeric,
    configuredSource: calendarSource || (configured.raw.length ? "config" : "fallback"),
    calendarSource: calendarSource || (configured.raw.length ? "config" : "fallback"),
    typeCalendarIds,
    typeCalendars
  };
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

  const {
    account: accountParam,
    location: locationParam,
    appointmentTypeId: appointmentTypeParam,
    date: dateParam,
    days: daysParam
  } = req.query || {};

  const normalizedLocation = normalizeLocation(locationParam || "");
  if (!normalizedLocation) {
    return send(400, { ok: false, error: "Missing location" });
  }

  const locationConfig = LOCATION_POOLS[normalizedLocation];
  if (!locationConfig) {
    return send(404, { ok: false, error: `No calendars configured for \"${normalizedLocation}\"` });
  }

  const cityTypes = loadCityTypes();
  const account = inferAccountFromLocation(cityTypes, accountParam, normalizedLocation, locationConfig.account);

  const { id: resolvedTypeId, source: appointmentTypeSource } = resolveAppointmentTypeId(
    cityTypes,
    account,
    normalizedLocation,
    appointmentTypeParam
  );

  const appointmentTypeId = resolvedTypeId || locationConfig.appointmentTypeId || null;
  if (!appointmentTypeId) {
    return send(400, { ok: false, error: "Missing appointmentTypeId" });
  }

  const typeInfo = await getTypeById(account, appointmentTypeId);

  const tz = DEFAULT_TZ;
  const baseDate = (dateParam || isoDateInTz(tz)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
    return send(400, { ok: false, error: "Invalid date. Use YYYY-MM-DD." });
  }

  const parsedDays = Number(daysParam);
  const normalizedDays = Number.isFinite(parsedDays) ? Math.round(parsedDays) : 1;
  const days = Math.max(1, Math.min(7, normalizedDays || 1));

  let calendarResolution;
  try {
    calendarResolution = await resolveLocationCalendars(account, normalizedLocation, {
      appointmentTypeId,
      typeInfo
    });
  } catch (error) {
    const status = error?.status || 502;
    return send(status, { ok: false, error: error?.message || "Failed to resolve calendars", account });
  }

  const {
    ids: calendarIds,
    unresolvedNames,
    configured,
    configuredIds,
    configuredSource,
    calendarSource,
    typeCalendarIds,
    typeCalendars
  } = calendarResolution;
  if (!calendarIds.length) {
    return send(404, { ok: false, error: `No calendar IDs resolved for \"${normalizedLocation}\"` });
  }

  const results = [];
  const calendarErrors = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = offset === 0 ? baseDate : addDaysISO(baseDate, offset, tz);
    if (!date) {
      calendarErrors.push({ offset, error: "Unable to compute date" });
      continue;
    }

    const perCalendar = await Promise.all(
      calendarIds.map(async (calendarId) => {
        try {
          const times = await acuityFetch(account, "availability/times", {
            calendarID: calendarId,
            appointmentTypeID: appointmentTypeId,
            date
          });
          if (!Array.isArray(times)) return [];
          return times.map((entry) => ({ ...entry, calendarID: calendarId }));
        } catch (error) {
          calendarErrors.push({
            calendarId,
            status: error?.status,
            message: error?.message || "Acuity request failed",
            date
          });
          return [];
        }
      })
    );

    const merged = groupTimesMerge(perCalendar);
    const totalSlots = merged.reduce((sum, slot) => sum + (Number(slot.slots) || 0), 0);
    results.push({ date, times: merged, totalSlots });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  return send(200, {
    ok: true,
    account,
    location: normalizedLocation,
    appointmentTypeId,
    appointmentTypeSource: appointmentTypeSource || (locationConfig.appointmentTypeId ? "location-config" : undefined),
    appointmentTypeName: typeInfo?.name,
    days,
    timezone: tz,
    pooledCalendarIds: calendarIds,
    calendarSource,
    configuredCalendars: configured,
    configuredIds,
    configuredSource,
    typeCalendarIds: typeCalendarIds && typeCalendarIds.length ? typeCalendarIds : undefined,
    typeCalendars: Array.isArray(typeCalendars) && typeCalendars.length ? typeCalendars : undefined,
    unresolvedCalendars: unresolvedNames.length ? unresolvedNames : undefined,
    results,
    errors: calendarErrors.length ? calendarErrors : undefined
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.LOCATION_POOLS = LOCATION_POOLS;
module.exports.resolveLocationCalendars = resolveLocationCalendars;
