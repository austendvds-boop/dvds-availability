module.exports = (_req, res) => {
  const hasMainUser = !!process.env.ACUITY_MAIN_USER_ID;
  const hasMainKey  = !!process.env.ACUITY_MAIN_API_KEY;
  const hasParUser  = !!process.env.ACUITY_PARENTS_USER_ID;
  const hasParKey   = !!process.env.ACUITY_PARENTS_API_KEY;

  const googleKey = process.env.googlemapsapi || process.env.GOOGLE_MAPS_API_KEY || null;

  const tz = process.env.ACUITY_TIMEZONE || process.env.TZ_DEFAULT || "America/Phoenix";
  const days = Number(process.env.ACUITY_DEFAULT_DAYS || 14);

  res.status(200).json({
    ok: true,
    main: { user: hasMainUser, key: hasMainKey },
    parents: { user: hasParUser, key: hasParKey },
    timezone: tz,
    defaultDays: days,
    googlemapsapi: googleKey,
    googleMapsApiKey: googleKey
  });
};
