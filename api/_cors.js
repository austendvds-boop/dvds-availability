const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';

module.exports = function withCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    return handler(req, res);
  };
};
