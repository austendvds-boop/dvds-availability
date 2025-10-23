const { catalog } = require("../../data/dvds");

function normalizeTitle(title) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findMatches(searchTerm) {
  if (!searchTerm) {
    return catalog;
  }

  const normalizedTerm = normalizeTitle(searchTerm);

  return catalog.filter((item) =>
    normalizeTitle(item.title).includes(normalizedTerm)
  );
}

function buildResponsePayload(matches, searchTerm) {
  if (!searchTerm) {
    return {
      ok: true,
      query: null,
      count: matches.length,
      availability: matches,
      message: "Showing the full DVD catalog.",
    };
  }

  if (matches.length === 0) {
    return {
      ok: true,
      query: searchTerm,
      count: 0,
      availability: [],
      message: "No DVD titles matched your search.",
    };
  }

  const exactMatch = matches.find(
    (item) => normalizeTitle(item.title) === normalizeTitle(searchTerm)
  );

  return {
    ok: true,
    query: searchTerm,
    count: matches.length,
    availability: matches,
    message: exactMatch
      ? `${exactMatch.title} is currently ${exactMatch.availability.replace("_", " ")}.`
      : "Showing partial matches for your search.",
  };
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ ok: false, error: `Method ${req.method} not allowed` });
  }

  const { title } = req.query;
  const searchTerm = typeof title === "string" ? title.trim() : "";
  const matches = findMatches(searchTerm);
  const payload = buildResponsePayload(matches, searchTerm);

  res.status(200).json(payload);
}
