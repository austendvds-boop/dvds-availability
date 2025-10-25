const { randomUUID } = require("crypto");

const {
  DEFAULT_TZ,
  applyCors,
  normalizeAccount,
  normalizeLocation,
  loadCityTypes,
  getTypeById,
  acuityFetch,
  addDaysISO,
  startOfMonthISO,
  daysInMonth
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
  const { id: appointmentTypeId, source: appointmentTypeSource } = resolveAppointmentTypeId(
    cityTypes,
    account,
    normalizedLocation,
    query.appointmentTypeId
  );

  if (!appointmentTypeId) {
    return send(400, { ok: false, error: "Missing appointmentTypeId", account, location: normalizedLocation });
  }

  const tz = DEFAULT_TZ;
  const baseDate = String(query.date || "").trim() || new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()).replace(/\//g, "-");
  const monthStart = startOfMonthISO(baseDate, tz);
  const totalDays = daysInMonth(baseDate, tz);

  const typeInfo = await getTypeById(account, appointmentTypeId);
  const calendarResolution = await resolveConfiguredCalendars(account, normalizedLocation, typeInfo);

  if (!calendarResolution.configured.length) {
    return send(404, {
      ok: false,
      error: "No calendars configured for this location (strict mode)",
      account,
      location: normalizedLocation
    });
  }

  if (!calendarResolution.ids.length) {
    if (calendarResolution.typeCalendarIds.length) {
      return send(400, {
        ok: false,
        error: "Configured calendars are not enabled for this appointment type in Acuity",
        account,
        location: normalizedLocation,
        configured: calendarResolution.configured,
        typeCalendarIds: calendarResolution.typeCalendarIds
      });
    }
    return send(404, {
      ok: false,
      error: "Configured calendar IDs could not be resolved",
      account,
      location: normalizedLocation,
      unresolved: calendarResolution.unresolvedNames
    });
  }

  const byDate = {};
  for (let i = 0; i < totalDays; i += 1) {
    const day = addDaysISO(monthStart, i, tz);
    byDate[day] = 0;
  }

  const baseUrl = "availability/times";
  await Promise.all(
    calendarResolution.ids.map(async (calendarId) => {
      for (let i = 0; i < totalDays; i += 1) {
        const date = addDaysISO(monthStart, i, tz);
        try {
          const times = await acuityFetch(account, baseUrl, {
            calendarID: calendarId,
            appointmentTypeID: appointmentTypeId,
            date
          });
          if (Array.isArray(times) && times.length) {
            const total = times.reduce((sum, entry) => sum + (Number(entry.slots) || 0), 0);
            byDate[date] += total;
          }
        } catch (error) {
          // ignore individual calendar failures; strict config prevents most invalid requests
        }
      }
    })
  );

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

  return send(200, {
    ok: true,
    account,
    location: normalizedLocation,
    appointmentTypeId,
    appointmentTypeSource: appointmentTypeSource || undefined,
    appointmentTypeName: typeInfo?.name,
    monthStart,
    days: totalDays,
    calendarIDs: calendarResolution.ids,
    configuredCalendars: calendarResolution.configured,
    configuredIds: calendarResolution.configuredIds,
    typeCalendarIds: calendarResolution.typeCalendarIds.length ? calendarResolution.typeCalendarIds : undefined,
    unresolvedCalendars: calendarResolution.unresolvedNames.length ? calendarResolution.unresolvedNames : undefined,
    byDate
  });
};

module.exports.config = { runtime: "nodejs20.x" };
