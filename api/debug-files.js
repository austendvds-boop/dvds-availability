const fs = require('fs');
const path = require('path');

module.exports = async (_req, res) => {
  const check = (p) => {
    const abs = path.resolve(process.cwd(), p);
    try {
      const stat = fs.statSync(abs);
      return { exists: true, size: stat.size, path: abs };
    } catch (error) {
      return { exists: false, error: error.message, path: abs };
    }
  };

  res.status(200).json({
    ok: true,
    cwd: process.cwd(),
    cityTypes: check('city-types.json'),
    locationConfig: check('location-config.json'),
  });
};
