module.exports = async (req, res) => {
  const ALLOWED = new Set([
    "https://www.deervalleydrivingschool.com",
    "https://dvds-availability.vercel.app"
  ]);
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const { location, appointmentTypeId } = req.query || {};
  if (!location || !appointmentTypeId)
    return res.status(400).json({ ok:false, error:"Missing location or appointmentTypeId" });

  const isParents = /parents/i.test(location);
  const user = process.env[isParents ? "ACUITY_PARENTS_USER_ID" : "ACUITY_MAIN_USER_ID"];
  const key  = process.env[isParents ? "ACUITY_PARENTS_API_KEY" : "ACUITY_MAIN_API_KEY"];
  if (!user || !key) return res.status(500).json({ ok:false, error:"Missing Acuity credentials" });

  const baseUrl = "https://acuityscheduling.com/api/v1/availability/times";
  const auth = "Basic " + Buffer.from(`${user}:${key}`).toString("base64");
  const url = `${baseUrl}?appointmentTypeID=${encodeURIComponent(appointmentTypeId)}&calendar=${encodeURIComponent(location)}`;

  try {
    const r = await fetch(url, { headers: { Authorization: auth } });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ ok:false, error:text || `Acuity ${r.status}` });
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return res.status(200).json({ ok:true, source:isParents?"parents":"main", location, appointmentTypeId, count:Array.isArray(data)?data.length:undefined, times:data });
  } catch (e) {
    return res.status(500).json({ ok:false, error:e?.message || "Internal error" });
  }
};
