const MAX_DAYS = 120;
const MIN_DAYS = 1;

const credentials = {
  main: {
    id: process.env.ACUITY_MAIN_USER_ID,
    key: process.env.ACUITY_MAIN_API_KEY
  },
  parents: {
    id: process.env.ACUITY_PARENTS_USER_ID,
    key: process.env.ACUITY_PARENTS_API_KEY
  }
};

const TZ_DEFAULT = process.env.TZ_DEFAULT || 'America/Phoenix';
const DEFAULT_DAYS = Number.parseInt(process.env.ACUITY_DEFAULT_DAYS || '90', 10) || 90;

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatTimeInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: true,
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function addDaysIso(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clampDays(value) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, numeric));
}

function getLocation(reqQuery) {
  const location = typeof reqQuery.location === 'string' ? reqQuery.location.toLowerCase() : 'main';
  return location === 'parents' ? 'parents' : 'main';
}

function validateAppointmentTypeId(value) {
  const numeric = Number.parseInt(value, 10);
  if (!value || Number.isNaN(numeric)) {
    return { error: 'Missing or invalid appointmentTypeId' };
  }
  return { value: numeric };
}

function getStartDate(query, timeZone) {
  if (query.start) {
    const candidate = new Date(query.start);
    if (!Number.isNaN(candidate.getTime())) {
      return formatDateInTimeZone(candidate, timeZone);
    }
  }
  return formatDateInTimeZone(new Date(), timeZone);
}

function ensureCredentials(creds) {
  if (!creds || !creds.id || !creds.key) {
    throw new Error('Missing credentials for Acuity Scheduling');
  }
}

function buildAuthHeader(creds) {
  const token = Buffer.from(`${creds.id}:${creds.key}`).toString('base64');
  return `Basic ${token}`;
}

function groupTimesByDay(times, timeZone) {
  const map = new Map();
  for (const slot of Array.isArray(times) ? times : []) {
    const slotTime = slot.time || slot.datetime || slot.startTime;
    if (!slotTime) {
      continue;
    }
    const dateObj = new Date(slotTime);
    if (Number.isNaN(dateObj.getTime())) {
      continue;
    }
    const dateKey = formatDateInTimeZone(dateObj, timeZone);
    const formattedTime = formatTimeInTimeZone(dateObj, timeZone);
    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
    map.get(dateKey).push({
      time: formattedTime,
      sortValue: dateObj.getTime()
    });
  }

  const days = Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, values]) => {
      const times = values
        .sort((a, b) => a.sortValue - b.sortValue)
        .map((entry) => entry.time);
      return { date, times };
    });

  return days;
}

export default async function handler(req, res) {
  try {
    const { query } = req;
    const location = getLocation(query);
    const creds = credentials[location];
    ensureCredentials(creds);

    const appointmentTypeValidation = validateAppointmentTypeId(query.appointmentTypeId);
    if (appointmentTypeValidation.error) {
      res.status(400).json({ error: appointmentTypeValidation.error });
      return;
    }

    const requestedDays = query.days ? clampDays(query.days) : undefined;
    const days = requestedDays ?? clampDays(DEFAULT_DAYS) ?? DEFAULT_DAYS;

    const timeZone = typeof query.timezone === 'string' && query.timezone.trim() ? query.timezone : TZ_DEFAULT;
    const startDate = getStartDate(query, timeZone);
    const endDate = addDaysIso(startDate, days - 1);

    const url = new URL('https://acuityscheduling.com/api/v1/availability/times');
    url.searchParams.set('appointmentTypeID', String(appointmentTypeValidation.value));
    url.searchParams.set('ownerID', String(creds.id));
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    url.searchParams.set('timezone', timeZone);

    const response = await fetch(url, {
      headers: {
        Authorization: buildAuthHeader(creds)
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Acuity API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const daysPayload = groupTimesByDay(data, timeZone);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      startDate,
      endDate,
      days: daysPayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message === 'Missing credentials for Acuity Scheduling' ? 500 : 500;
    res.status(status).json({ error: message });
  }
}
