const fs = require("fs");
const path = require("path");

const { normalizeAccount, normalizeLocation } = require("../api/_acuity");

let cachedConfig = null;
let cachedMtime = 0;

const CONFIG_PATH = path.join(process.cwd(), "location-config.json");

const safeParse = (text) => {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    // ignore parse errors and fall through to empty object
  }
  return {};
};

const loadLocationConfig = () => {
  try {
    const stats = fs.statSync(CONFIG_PATH);
    if (!cachedConfig || stats.mtimeMs !== cachedMtime) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      cachedConfig = safeParse(raw);
      cachedMtime = stats.mtimeMs;
    }
  } catch (error) {
    cachedConfig = {};
    cachedMtime = 0;
  }
  return cachedConfig;
};

const reloadLocationConfig = () => {
  cachedConfig = null;
  cachedMtime = 0;
  return loadLocationConfig();
};

const normalizeEntry = (entry) => {
  if (entry == null) return null;
  if (typeof entry === "number") {
    return Number.isFinite(entry) ? entry : null;
  }
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return trimmed;
  }
  if (typeof entry === "object") {
    if (entry.id != null) {
      return normalizeEntry(entry.id);
    }
    if (entry.name) {
      return String(entry.name);
    }
  }
  return null;
};

const unique = (values = []) => {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

const getConfiguredEntries = (account, location) => {
  const config = loadLocationConfig();
  const normalizedAccount = normalizeAccount(account || "main");
  const normalizedLocation = normalizeLocation(location || "");
  if (!normalizedLocation) return [];

  const accountConfig = config?.[normalizedAccount];
  if (!accountConfig) return [];

  const compactKey = normalizedLocation.replace(/\s+/g, "");
  const raw = accountConfig[normalizedLocation] ?? accountConfig[compactKey];
  if (!Array.isArray(raw)) return [];

  return raw.map((entry) => normalizeEntry(entry)).filter((entry) => entry != null);
};

const splitConfiguredEntries = (entries = []) => {
  const numeric = [];
  const names = [];
  for (const entry of entries) {
    if (typeof entry === "number") {
      numeric.push(entry);
    } else if (typeof entry === "string") {
      names.push(entry);
    }
  }
  return {
    numeric: unique(numeric),
    names: unique(names),
    raw: entries
  };
};

const getConfiguredIdentifiers = (account, location) => {
  const entries = getConfiguredEntries(account, location);
  return splitConfiguredEntries(entries);
};

const getAllConfiguredLocations = () => {
  const config = loadLocationConfig();
  const result = {};
  for (const [account, locations] of Object.entries(config || {})) {
    const normalizedAccount = normalizeAccount(account);
    result[normalizedAccount] = {};
    for (const [location, entries] of Object.entries(locations || {})) {
      const normalizedLocation = normalizeLocation(location);
      const parsed = splitConfiguredEntries(Array.isArray(entries) ? entries : []);
      result[normalizedAccount][normalizedLocation] = parsed;
    }
  }
  return result;
};

module.exports = {
  CONFIG_PATH,
  loadLocationConfig,
  reloadLocationConfig,
  getConfiguredEntries,
  getConfiguredIdentifiers,
  getAllConfiguredLocations
};
