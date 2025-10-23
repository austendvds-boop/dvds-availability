const DEFAULT_LOCATION = 'main';
const VALID_LOCATIONS = new Set(['main', 'parents']);
const FALLBACK_DEFAULT_DAYS = 90;
const MIN_DAYS = 1;
const MAX_DAYS = 120;

function getQueryParam(req, name, fallback) {
  const value = req.query?.[name];
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function parseNumeric(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function clampDays(value) {
  const parsed = parseNumeric(value);
  const fallback = parseNumeric(process.env.ACUITY_DEFAULT_DAYS) ?? FALLBACK_DEFAULT_DAYS;
  if (parsed == null) {
    return Math.min(Math.max(fallback, MIN_DAYS), MAX_DAYS);
  }
  return Math.min(Math.max(parsed, MIN_DAYS), MAX_DAYS);
}

function resolveTimezone(value) {
  const tz = (value || process.env.TZ_DEFAULT || 'UTC').trim();
  return tz || 'UTC';
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function addDaysISO(dateStr, amount) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function toTimeLabel(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function computeStartDate(rawStart, timeZone) {
  if (rawStart) {
    const parsed = new Date(rawStart);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(parsed, timeZone);
    }
  }
  return formatDate(new Date(), timeZone);
}

function resolveCredentials(location) {
  const creds = {
    main: {
      id: process.env.ACUITY_MAIN_USER_ID,
      key: process.env.ACUITY_MAIN_API_KEY
    },
    parents: {
      id: process.env.ACUITY_PARENTS_USER_ID,
      key: process.env.ACUITY_PARENTS_API_KEY
    }
  };

  const chosen = creds[location];
  if (!chosen?.id || !chosen?.key) {
    return null;
  }
  return chosen;
}

function buildAuthHeader(id, key) {
  const encoded = Buffer.from(`${id}:${key}`).toString('base64');
  return `Basic ${encoded}`;
}

function groupAvailability(slots, timeZone) {
  const map = new Map();

  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot || !slot.time) continue;
    const dateObj = new Date(slot.time);
    if (Number.isNaN(dateObj.getTime())) continue;

    const dateKey = formatDate(dateObj, timeZone);
    const label = toTimeLabel(dateObj, timeZone);

    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
    map.get(dateKey).push({ timestamp: dateObj.getTime(), label });
  }

  return Array.from(map.entries())
    .sort(([dateA], [dateB]) => (dateA < dateB ? -1 : dateA > dateB ? 1 : 0))
    .map(([date, entries]) => ({
      date,
      times: entries
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((entry) => entry.label)
    }));
}

export default async function handler(req, res) {
  const rawLocation = getQueryParam(req, 'location', DEFAULT_LOCATION);
  const normalizedLocation = typeof rawLocation === 'string'
    ? rawLocation.toLowerCase()
    : DEFAULT_LOCATION;
  const location = VALID_LOCATIONS.has(normalizedLocation)
    ? normalizedLocation
    : DEFAULT_LOCATION;

  const appointmentTypeRaw = getQueryParam(req, 'appointmentTypeId');
  const appointmentTypeId = parseNumeric(appointmentTypeRaw);
  if (appointmentTypeId == null) {
    res.status(400).json({ error: 'Missing or invalid appointmentTypeId' });
    return;
  }

  const days = clampDays(getQueryParam(req, 'days'));
  const timezone = resolveTimezone(getQueryParam(req, 'timezone'));
  const startDate = computeStartDate(getQueryParam(req, 'start'), timezone);
  const endDate = addDaysISO(startDate, days - 1);

  const credentials = resolveCredentials(location);
  if (!credentials) {
    res.status(500).json({ error: 'Missing credentials for requested location' });
    return;
  }

  const params = new URLSearchParams({
    appointmentTypeID: String(appointmentTypeId),
    ownerID: String(credentials.id),
    startDate,
    endDate,
    timezone
  });

  try {
    const response = await fetch(`https://acuityscheduling.com/api/v1/availability/times?${params.toString()}`, {
      headers: {
        Authorization: buildAuthHeader(credentials.id, credentials.key)
      }
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `Acuity request failed: ${response.status} ${text}` });
      return;
    }

    const slots = await response.json();
    const daysPayload = groupAvailability(slots, timezone);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      startDate,
      endDate,
      days: daysPayload
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability data', details: error.message });
  }
}
