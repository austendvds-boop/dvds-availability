const { getLocations, toAcuityMetadata } = require('./_acuity');

module.exports = (_req, res) => {
  const grouped = {
    studentLocations: {},
    parentLocations: {},
  };

  for (const loc of getLocations()) {
    const bucket = loc.type === 'parent' ? 'parentLocations' : 'studentLocations';
    grouped[bucket][loc.label] = toAcuityMetadata(loc);
  }

  res.status(200).json({ ok: true, locations: grouped });
};
