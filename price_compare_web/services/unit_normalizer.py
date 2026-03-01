"""
Unit normalization using manual conversion factors (no external library).
All weights normalize to ounces (oz).
All volumes normalize to fluid ounces (fl oz).
Counts stay as 'count'.
"""

# Conversion factors → base unit
_TO_OZ: dict[str, float] = {
    "oz":    1.0,
    "lb":    16.0,
    "g":     0.035274,
    "kg":    35.27396,
}

_TO_FL_OZ: dict[str, float] = {
    "fl oz":  1.0,
    "fl_oz":  1.0,
    "ml":     0.033814,
    "l":      33.8140,
}

_WEIGHT_UNITS = set(_TO_OZ)
_VOLUME_UNITS = set(_TO_FL_OZ)
_COUNT_UNITS  = {"count", "ct", "pack"}


def _category(unit: str) -> str:
    u = unit.lower().strip()
    if u in _WEIGHT_UNITS:
        return "weight"
    if u in _VOLUME_UNITS:
        return "volume"
    if u in _COUNT_UNITS:
        return "count"
    return "unknown"


def normalize_to_base(quantity: float, unit: str) -> tuple[float, str]:
    """
    Convert quantity+unit to base unit.
    Returns (normalized_quantity, base_unit_label).
    base_unit_label is always 'oz', 'fl oz', or 'count'.
    """
    u = unit.lower().strip()
    cat = _category(u)

    if cat == "count":
        return (quantity, "count")

    if cat == "weight":
        factor = _TO_OZ.get(u)
        if factor is None:
            raise ValueError(f"Unsupported unit: {unit!r}")
        return (round(quantity * factor, 6), "oz")

    if cat == "volume":
        factor = _TO_FL_OZ.get(u)
        if factor is None:
            raise ValueError(f"Unsupported unit: {unit!r}")
        return (round(quantity * factor, 6), "fl oz")

    raise ValueError(f"Unsupported unit: {unit!r}")


def units_compatible(unit_a: str, unit_b: str) -> bool:
    """Return True if both units belong to the same category."""
    return _category(unit_a) == _category(unit_b)
