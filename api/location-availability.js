const { randomUUID } = require("crypto");

const {
  DEFAULT_TZ,
  normalizeAccount,
  normalizeLocation,
  applyCors,
  listCalendars,
  acuityFetch,
  groupTimesMerge,
  addDaysISO
} = require("./_acuity");

const { LOCATION_CONFIG } = require("./zip-route");

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

  const account = normalizeAccount(accountParam || locationConfig.account || "main");
  const appointmentTypeId = appointmentTypeParam || locationConfig.appointmentTypeId;
  if (!appointmentTypeId) {
    return send(400, { ok: false, error: "Missing appointmentTypeId" });
  }

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
    calendarResolution = await resolveCalendarIds(account, locationConfig.calendars || []);
  } catch (error) {
    const status = error?.status || 502;
    return send(status, { ok: false, error: error?.message || "Failed to resolve calendars", account });
  }

  const { ids: calendarIds, unresolvedNames } = calendarResolution;
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
    days,
    timezone: tz,
    pooledCalendarIds: calendarIds,
    unresolvedCalendars: unresolvedNames.length ? unresolvedNames : undefined,
    results,
    errors: calendarErrors.length ? calendarErrors : undefined
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.LOCATION_POOLS = LOCATION_POOLS;
