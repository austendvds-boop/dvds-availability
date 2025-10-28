module.exports = (_req, res) => {
  res.status(200).json({
    ok: true,
    hasUserId: !!process.env.ACUITY_USER_ID,
    hasApiKey: !!process.env.ACUITY_API_KEY,
    timezone: process.env.ACUITY_TIMEZONE || 'not-set',
    node: process.version,
  });
};
