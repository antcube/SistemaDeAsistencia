const ALLOWED_RANGES = [
  "100K",
  "250K",
  "500K",
  "ELITE",
  "PRESIDENTIAL",
  "INFINITY",
];

const normalizeRange = (value) => {
  const text = String(value || "")
    .trim()
    .toUpperCase();

  if (!text) return "";

  for (const range of ALLOWED_RANGES) {
    const pattern = new RegExp(
      `(^|[^A-Z0-9])${range.replace("K", "\\s*K")}(?=$|[^A-Z0-9])`,
      "i"
    );

    if (pattern.test(text)) {
      return range;
    }
  }

  return "";
};

module.exports = {
  ALLOWED_RANGES,
  normalizeRange,
};