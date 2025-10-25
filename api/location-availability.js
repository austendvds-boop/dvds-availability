const { randomUUID } = require("crypto");

const {
  DEFAULT_TZ,
  applyCors,
  normalizeAccount,
  normalizeLocation,
  acuityFetch,
  listCalendars,
  groupTimesMerge,
  addDaysISO,
  loadCityTypes,
  getTypeById,
  getConfiguredLocationEntries
} = require("./_acuity");

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

const extractTypeCalendarIds = (typeInfo) => {
  if (!typeInfo) return [];
  const collected = new Set();
  const collect = (entry) => {
    const parsed = parseCalendarIdentifier(entry);
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      collected.add(parsed);
    }
  };

  if (Array.isArray(typeInfo.calendarIDs)) {
    typeInfo.calendarIDs.forEach(collect);
  }
  if (Array.isArray(typeInfo.calendarIds)) {
    typeInfo.calendarIds.forEach(collect);
  }
  if (Array.isArray(typeInfo.calendars)) {
    typeInfo.calendars.forEach((calendar) => {
      collect(calendar?.id);
      collect(calendar?.calendarID);
      collect(calendar?.calendarId);
    });
  }

  return Array.from(collected.values());
};

const findCalendarIdByName = (calendars, label) => {
  if (!Array.isArray(calendars)) return null;
  const target = normalizeLocation(label);
  if (!target) return null;

  for (const calendar of calendars) {
    const name = normalizeLocation(calendar?.name || "");
    if (!name) continue;
    if (name === target || name.includes(target) || target.includes(name)) {
      const parsed = parseCalendarIdentifier(calendar?.id);
      if (typeof parsed === "number" && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const resolveConfiguredCalendars = async (account, location, typeInfo) => {
  const identifiers = getConfiguredLocationEntries(account, location);
  const configuredRaw = Array.isArray(identifiers.raw) ? identifiers.raw : [];
  const configuredIds = Array.isArray(identifiers.numeric) ? identifiers.numeric : [];
  const configuredNames = Array.isArray(identifiers.names) ? identifiers.names : [];

  if (!configuredRaw.length) {
    return {
      ids: [],
      configured: [],
      configuredIds: [],
      configuredNames: [],
      unresolvedNames: [],
      typeCalendarIds: extractTypeCalendarIds(typeInfo),
      typeCalendars: typeInfo?.calendars || []
    };
  }

  const resolved = new Set(configuredIds.filter((id) => typeof id === "number" && Number.isFinite(id)));
  const unresolvedNames = [];

  if (configuredNames.length) {
    const liveCalendars = await listCalendars(account).catch(() => []);
    for (const name of configuredNames) {
      const resolvedId = findCalendarIdByName(liveCalendars, name);
      if (resolvedId != null) {
        resolved.add(resolvedId);
      } else {
        unresolvedNames.push(name);
      }
    }
  }

  const resolvedIds = Array.from(resolved.values());
  const typeCalendarIds = extractTypeCalendarIds(typeInfo);
  let finalIds = resolvedIds;
  let disallowed = [];

  if (typeCalendarIds.length) {
    const allowed = new Set(typeCalendarIds);
    disallowed = resolvedIds.filter((id) => !allowed.has(id));
    finalIds = resolvedIds.filter((id) => allowed.has(id));
  }

  return {
    ids: finalIds,
    configured: configuredRaw,
    configuredIds,
    configuredNames,
    unresolvedNames,
    typeCalendarIds,
    typeCalendars: typeInfo?.calendars || [],
    disallowed
  };
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

const handler = async (req, res) => {
  applyCors(req, res);

  const requestId = String(req.headers["x-request-id"] || randomUUID());
  res.setHeader("X-Request-Id", requestId);

  const respond = (status, payload) => res.status(status).json({ requestId, ...payload });

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return respond(405, { ok: false, error: "Method not allowed" });
  }

  const query = req.query || {};
  const locationParam = query.location || "";
  const normalizedLocation = normalizeLocation(locationParam);
  if (!normalizedLocation) {
    return respond(400, { ok: false, error: "Missing location" });
  }

  const cityTypes = loadCityTypes();
  const account = inferAccountFromLocation(cityTypes, query.account, normalizedLocation);
  const { id: inferredTypeId, source: typeSource } = (() => {
    if (query.appointmentTypeId) {
      return { id: String(query.appointmentTypeId), source: "query" };
    }
    const map = cityTypes[account] || {};
    const direct = map[normalizedLocation];
    if (direct) return { id: String(direct), source: "city-types" };
    const compact = normalizedLocation.replace(/\s+/g, "");
    if (map[compact]) return { id: String(map[compact]), source: "city-types" };
    return { id: null, source: null };
  })();

  const appointmentTypeId = inferredTypeId;
  if (!appointmentTypeId) {
    return respond(400, { ok: false, error: "Missing appointmentTypeId", account, location: normalizedLocation });
  }

  const typeInfo = await getTypeById(account, appointmentTypeId);
  const calendarResolution = await resolveConfiguredCalendars(account, normalizedLocation, typeInfo);

  if (!calendarResolution.configured.length) {
    return respond(404, {
      ok: false,
      error: "No calendars configured for this location (strict mode)",
      account,
      location: normalizedLocation
    });
  }

  if (!calendarResolution.ids.length) {
    if (calendarResolution.typeCalendarIds.length) {
      return respond(400, {
        ok: false,
        error: "Configured calendars are not enabled for this appointment type in Acuity",
        account,
        location: normalizedLocation,
        configured: calendarResolution.configured,
        typeCalendarIds: calendarResolution.typeCalendarIds
      });
    }
    return respond(404, {
      ok: false,
      error: "Configured calendar IDs could not be resolved",
      account,
      location: normalizedLocation,
      unresolved: calendarResolution.unresolvedNames
    });
  }

  const tz = DEFAULT_TZ;
  let baseDate = String(query.date || "").trim();
  if (!baseDate) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    baseDate = today.replace(/\//g, "-");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
    return respond(400, { ok: false, error: "Invalid date. Use YYYY-MM-DD." });
  }

  const parsedDays = Number(query.days);
  const days = Math.max(1, Math.min(7, Number.isFinite(parsedDays) ? Math.round(parsedDays) : 1));

  const results = [];
  const calendarErrors = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = offset === 0 ? baseDate : addDaysISO(baseDate, offset, tz);
    if (!date) {
      calendarErrors.push({ offset, error: "Unable to compute date" });
      continue;
    }

    const perCalendar = await Promise.all(
      calendarResolution.ids.map(async (calendarId) => {
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

  return respond(200, {
    ok: true,
    account,
    location: normalizedLocation,
    appointmentTypeId,
    appointmentTypeSource: typeSource || undefined,
    appointmentTypeName: typeInfo?.name,
    timezone: tz,
    days,
    pooledCalendarIds: calendarResolution.ids,
    configuredCalendars: calendarResolution.configured,
    configuredIds: calendarResolution.configuredIds,
    configuredNames: calendarResolution.configuredNames,
    unresolvedCalendars: calendarResolution.unresolvedNames.length ? calendarResolution.unresolvedNames : undefined,
    disallowedCalendarIds: calendarResolution.disallowed.length ? calendarResolution.disallowed : undefined,
    typeCalendarIds: calendarResolution.typeCalendarIds.length ? calendarResolution.typeCalendarIds : undefined,
    typeCalendars: Array.isArray(calendarResolution.typeCalendars) && calendarResolution.typeCalendars.length
      ? calendarResolution.typeCalendars
      : undefined,
    results,
    errors: calendarErrors.length ? calendarErrors : undefined
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.resolveConfiguredCalendars = resolveConfiguredCalendars;
