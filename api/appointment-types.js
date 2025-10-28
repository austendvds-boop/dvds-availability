const { randomUUID } = require("crypto");

const { applyCors, listAppointmentTypes, normalizeAccount } = require("./_acuity");

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

  const account = normalizeAccount(req.query?.account);

  try {
    const appointmentTypes = await listAppointmentTypes(account);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return send(200, { ok: true, account, appointmentTypes });
  } catch (error) {
    return send(error?.status || 502, {
      ok: false,
      error: error?.message || "Failed to load appointment types",
      account,
      acuityStatus: error?.status,
      acuityBody: error?.body
    });
  }
};

module.exports = handler;
module.exports.config = { runtime: "nodejs20.x" };
