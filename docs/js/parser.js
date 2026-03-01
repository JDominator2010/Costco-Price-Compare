/**
 * Parse size/quantity from Walmart product titles.
 */
import { normalizeToBase, unitsCompatible } from "./normalizer.js";

const PATTERNS = [
  // "16.9 fl oz, 40 count"
  { re: /([\d.]+)\s*fl[\s-]?oz[,\s]+(\d+)\s*(?:count|ct|pk|pack)/i, type: "fl_oz_count" },
  // "12 oz, 24 pack"
  { re: /([\d.]+)\s*oz[,\s]+(\d+)\s*(?:count|ct|pk|pack)/i, type: "oz_count" },
  // "5 lb"
  { re: /([\d.]+)\s*lbs?(?!\s*\w)/i, type: "lb" },
  // "32 fl oz"
  { re: /([\d.]+)\s*fl[\s-]?oz/i, type: "fl oz" },
  // "32 oz"
  { re: /([\d.]+)\s*oz/i, type: "oz" },
  // "2 kg"
  { re: /([\d.]+)\s*kg/i, type: "kg" },
  // "500 g"
  { re: /([\d.]+)\s*g(?:r(?:ams?)?)?(?!\w)/i, type: "g" },
  // "1.5 l"
  { re: /([\d.]+)\s*(?:liters?|litres?|[lL])(?!\w)/i, type: "l" },
  // "500 ml"
  { re: /([\d.]+)\s*ml/i, type: "ml" },
  // "24 count"
  { re: /(\d+)\s*(?:count|ct|pk|pack|pcs?|pieces?)/i, type: "count" },
];

export function parseSize(title) {
  const t = title.toLowerCase();

  for (const { re, type } of PATTERNS) {
    const m = t.match(re);
    if (!m) continue;

    if (type === "fl_oz_count") {
      const perUnit = parseFloat(m[1]);
      const count = parseFloat(m[2]);
      if (isNaN(perUnit) || isNaN(count)) continue;
      const n = normalizeToBase(perUnit * count, "fl oz");
      return n;
    }

    if (type === "oz_count") {
      const perUnit = parseFloat(m[1]);
      const count = parseFloat(m[2]);
      if (isNaN(perUnit) || isNaN(count)) continue;
      const n = normalizeToBase(perUnit * count, "oz");
      return n;
    }

    const val = parseFloat(m[1]);
    if (isNaN(val) || val <= 0) continue;
    return normalizeToBase(val, type);
  }

  return { qty: null, unit: null };
}

export function parseAndFilter(title, targetUnit) {
  const result = parseSize(title);
  if (result.qty === null) return { qty: null, unit: null };
  if (!unitsCompatible(result.unit, targetUnit)) return { qty: null, unit: null };
  return result;
}
