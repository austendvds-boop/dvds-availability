const { randomUUID } = require("crypto");

const { applyCors, normalizeAccount, normalizeLocation, loadCityTypes, getConfiguredLocationIds } = require("./_acuity");

const ZIP_TO_CITY = {
  "85085": "anthem",
  "85048": "ahwatukee",
  "85254": "scottsdale",
  "85233": "gilbert",
  "85281": "tempe"
};

const LOCATION_METADATA = [
  { key: "anthem", label: "Anthem", account: "parents" },
  { key: "ahwatukee", label: "Ahwatukee", account: "main" },
  { key: "apache junction", label: "Apache Junction", account: "main" },
  { key: "casa grande", label: "Casa Grande", account: "main" },
  { key: "cave creek", label: "Cave Creek", account: "main" },
  { key: "downtown phoenix", label: "Downtown Phoenix", account: "main" },
  { key: "gilbert", label: "Gilbert", account: "main" },
  { key: "mesa", label: "Mesa", account: "main" },
  { key: "queen creek", label: "Queen Creek", account: "main" },
  { key: "san tan valley", label: "San Tan Valley", account: "main" },
  { key: "scottsdale", label: "Scottsdale", account: "main" },
  { key: "tempe", label: "Tempe", account: "main" },
  { key: "chandler", label: "Chandler", account: "main" },
  { key: "glendale", label: "Glendale", account: "parents" },
  { key: "north phoenix", label: "North Phoenix", account: "parents" },
  { key: "peoria", label: "Peoria", account: "parents" },
  { key: "sun city", label: "Sun City", account: "parents" },
  { key: "surprise", label: "Surprise", account: "parents" },
  { key: "parents", label: "Parents", account: "parents" }
];

const titleCase = (value = "") =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildLocationConfig = () => {
  const cityTypes = loadCityTypes();
  const config = {};

  const ensureEntry = (rawKey, meta = {}) => {
    const normalizedKey = normalizeLocation(rawKey);
    if (!normalizedKey) return;
    const baseMeta = LOCATION_METADATA.find(
      (entry) => normalizeLocation(entry.key) === normalizedKey
    ) || { account: meta.account, label: meta.label };
    const accountCandidate = meta.account || baseMeta.account;
    const inferredAccount = accountCandidate || (cityTypes.parents?.[normalizedKey] ? "parents" : "main");
    const labelCandidate = meta.label || baseMeta.label || titleCase(normalizedKey);
    const appointmentMap = cityTypes[inferredAccount] || {};
    const compactKey = normalizedKey.replace(/\s+/g, "");
    const appointmentTypeId =
      appointmentMap[normalizedKey] || appointmentMap[compactKey] || null;
    const configured = getConfiguredLocationIds(inferredAccount, normalizedKey);
    config[normalizedKey] = {
      label: labelCandidate,
      appointmentTypeId,
      account: normalizeAccount(inferredAccount),
      configuredCalendarIds: configured.configuredIds || [],
      unresolvedEntries: configured.unresolved || []
    };
  };

  LOCATION_METADATA.forEach((meta) => ensureEntry(meta.key, meta));

  for (const [accountKey, locations] of Object.entries(cityTypes || {})) {
    for (const key of Object.keys(locations || {})) {
      if (!config[key]) {
        ensureEntry(key, { account: accountKey });
      }
    }
  }

  for (const [key, value] of Object.entries({ ...config })) {
    const compact = key.replace(/\s+/g, "");
    if (compact && compact !== key && !config[compact]) {
      config[compact] = value;
    }
  }

  return config;
};

const LOCATION_CONFIG = buildLocationConfig();

const FALLBACK_CITY = "scottsdale";

const normalizeZip = (value = "") => value.toString().trim();

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

  const zip = normalizeZip(req.query?.zip || "");
  if (!zip) {
    return send(400, { ok: false, error: "Missing zip" });
  }

  const cityKey = ZIP_TO_CITY[zip] || FALLBACK_CITY;
  const config = LOCATION_CONFIG[cityKey];
  if (!config) {
    return send(404, { ok: false, error: `No calendar for ${cityKey}` });
  }

  const account = normalizeAccount(config.account);
  const configured = getConfiguredLocationIds(account, cityKey);
  const primaryId = Array.isArray(configured.configuredIds) && configured.configuredIds.length
    ? configured.configuredIds[0]
    : null;

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  return send(200, {
    ok: true,
    zip,
    cityKey,
    calendar: config.label,
    calendarId: primaryId,
    calendarSource: primaryId != null ? "config" : undefined,
    configuredCalendarIds: configured.configuredIds || [],
    unresolvedConfiguredEntries: configured.unresolved || [],
    appointmentTypeId: config.appointmentTypeId,
    account
  });
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
module.exports.ZIP_TO_CITY = ZIP_TO_CITY;
module.exports.LOCATION_CONFIG = LOCATION_CONFIG;
