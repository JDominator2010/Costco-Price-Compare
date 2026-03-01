"""
Parse size/quantity information from product title strings.
Returns (quantity_in_base_unit, base_unit) or (None, None) if unparseable.
"""
import re
from .unit_normalizer import normalize_to_base, units_compatible

# Patterns ordered by specificity (most specific first)
_PATTERNS = [
    # "16.9 fl oz, 40 count" or "16.9 fl oz 40 ct"
    (r"([\d.]+)\s*fl[\s\-]?oz[,\s]+(\d+)\s*(?:count|ct|pk|pack)", "fl_oz_count"),
    # "12 oz, 24 count" or "12oz 24pk"
    (r"([\d.]+)\s*oz[,\s]+(\d+)\s*(?:count|ct|pk|pack)", "oz_count"),
    # "5 lb" or "5lb"
    (r"([\d.]+)\s*lb(?:s)?(?!\s*\w)", "lb"),
    # "32 oz" or "32oz"
    (r"([\d.]+)\s*fl[\s\-]?oz", "fl oz"),
    (r"([\d.]+)\s*oz", "oz"),
    # "2 kg" or "2kg"
    (r"([\d.]+)\s*kg", "kg"),
    # "500 g" or "500g"
    (r"([\d.]+)\s*g(?:r(?:ams?)?)?(?!\w)", "g"),
    # "1.5 l" or "1.5L"
    (r"([\d.]+)\s*(?:liters?|litres?|[lL])(?!\w)", "l"),
    # "500 ml" or "500mL"
    (r"([\d.]+)\s*ml", "ml"),
    # "24 count" / "24 ct" / "24 pack" / "24 pk"
    (r"(\d+)\s*(?:count|ct|pk|pack|pcs?|pieces?)", "count"),
]


def parse_size(title: str) -> tuple[float | None, str | None]:
    """
    Extract the total normalized quantity from a product title.
    Returns (normalized_quantity, base_unit_label) or (None, None).
    """
    t = title.lower()

    for pattern, unit_type in _PATTERNS:
        m = re.search(pattern, t)
        if not m:
            continue

        if unit_type == "fl_oz_count":
            try:
                per_unit = float(m.group(1))
                count    = float(m.group(2))
            except ValueError:
                continue
            total    = per_unit * count
            qty, base = normalize_to_base(total, "fl oz")
            return (qty, base)

        if unit_type == "oz_count":
            try:
                per_unit = float(m.group(1))
                count    = float(m.group(2))
            except ValueError:
                continue
            total    = per_unit * count
            qty, base = normalize_to_base(total, "oz")
            return (qty, base)

        qty_raw_str = m.group(1)
        try:
            qty_raw = float(qty_raw_str)
        except ValueError:
            continue
        if qty_raw <= 0:
            continue
        qty, base = normalize_to_base(qty_raw, unit_type)
        return (qty, base)

    return (None, None)


def parse_and_filter(title: str, target_unit: str) -> tuple[float | None, str | None]:
    """
    Parse size and discard result if unit category doesn't match target_unit.
    """
    qty, base = parse_size(title)
    if qty is None:
        return (None, None)
    if not units_compatible(base, target_unit):
        return (None, None)
    return (qty, base)
