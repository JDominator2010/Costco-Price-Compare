"""
Unit tests for services/unit_normalizer.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.unit_normalizer import normalize_to_base, units_compatible


class TestNormalizeToBase:
    def test_oz_passthrough(self):
        qty, unit = normalize_to_base(32, "oz")
        assert unit == "oz"
        assert abs(qty - 32) < 0.001

    def test_lb_to_oz(self):
        qty, unit = normalize_to_base(1, "lb")
        assert unit == "oz"
        assert abs(qty - 16) < 0.01

    def test_kg_to_oz(self):
        qty, unit = normalize_to_base(1, "kg")
        assert unit == "oz"
        assert abs(qty - 35.274) < 0.01

    def test_g_to_oz(self):
        qty, unit = normalize_to_base(100, "g")
        assert unit == "oz"
        assert abs(qty - 3.527) < 0.01

    def test_ml_to_floz(self):
        qty, unit = normalize_to_base(500, "ml")
        assert unit == "fl oz"
        assert abs(qty - 16.907) < 0.01

    def test_l_to_floz(self):
        qty, unit = normalize_to_base(1, "l")
        assert unit == "fl oz"
        assert abs(qty - 33.814) < 0.01

    def test_fl_oz_passthrough(self):
        qty, unit = normalize_to_base(16.9, "fl oz")
        assert unit == "fl oz"
        assert abs(qty - 16.9) < 0.001

    def test_count_passthrough(self):
        qty, unit = normalize_to_base(40, "count")
        assert unit == "count"
        assert qty == 40

    def test_unsupported_unit_raises(self):
        with pytest.raises(ValueError):
            normalize_to_base(1, "furlongs")


class TestUnitsCompatible:
    def test_weight_weight(self):
        assert units_compatible("oz", "lb") is True
        assert units_compatible("g", "kg") is True

    def test_volume_volume(self):
        assert units_compatible("ml", "l") is True
        assert units_compatible("fl oz", "ml") is True

    def test_count_count(self):
        assert units_compatible("count", "count") is True

    def test_weight_volume_incompatible(self):
        assert units_compatible("oz", "ml") is False

    def test_weight_count_incompatible(self):
        assert units_compatible("lb", "count") is False
