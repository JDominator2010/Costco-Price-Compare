/**
 * Unit normalization — converts any supported unit to a base unit.
 * Weight → oz, Volume → fl oz, Count → count
 */

const TO_OZ = { oz: 1, lb: 16, g: 0.035274, kg: 35.27396 };
const TO_FLOZ = { "fl oz": 1, ml: 0.033814, l: 33.814 };
const COUNT_UNITS = new Set(["count", "ct", "pack"]);

export function category(unit) {
  const u = unit.toLowerCase().trim();
  if (u in TO_OZ) return "weight";
  if (u in TO_FLOZ) return "volume";
  if (COUNT_UNITS.has(u)) return "count";
  return "unknown";
}

export function normalizeToBase(quantity, unit) {
  const u = unit.toLowerCase().trim();
  const cat = category(u);

  if (cat === "count") return { qty: quantity, unit: "count" };

  if (cat === "weight") {
    const factor = TO_OZ[u];
    if (!factor) throw new Error(`Unsupported unit: ${unit}`);
    return { qty: +(quantity * factor).toFixed(6), unit: "oz" };
  }

  if (cat === "volume") {
    const factor = TO_FLOZ[u];
    if (!factor) throw new Error(`Unsupported unit: ${unit}`);
    return { qty: +(quantity * factor).toFixed(6), unit: "fl oz" };
  }

  throw new Error(`Unsupported unit: ${unit}`);
}

export function unitsCompatible(a, b) {
  return category(a) === category(b);
}
