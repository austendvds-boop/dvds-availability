export default (req, res) => {
  res.status(200).json({ ok: true, path: "/api/availability" });
};
