"""
Unit tests for services/parser.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.parser import parse_size, parse_and_filter


class TestParseSize:
    def test_simple_oz(self):
        qty, unit = parse_size("Product 32 oz bottle")
        assert unit == "oz"
        assert abs(qty - 32) < 0.01

    def test_lb(self):
        qty, unit = parse_size("Organic Chicken 5 lb")
        assert unit == "oz"
        assert abs(qty - 80) < 0.01  # 5 lb = 80 oz

    def test_fl_oz_count(self):
        qty, unit = parse_size("Water 16.9 fl oz 40 count")
        assert unit == "fl oz"
        assert abs(qty - 676) < 1  # 16.9 * 40

    def test_oz_count(self):
        qty, unit = parse_size("Juice 12 oz 24 pack")
        assert unit == "oz"
        assert abs(qty - 288) < 1  # 12 * 24

    def test_ml(self):
        qty, unit = parse_size("Shampoo 500 ml")
        assert unit == "fl oz"
        assert abs(qty - 16.907) < 0.1

    def test_l(self):
        qty, unit = parse_size("Juice 1.5 l")
        assert unit == "fl oz"
        assert abs(qty - 50.72) < 0.1

    def test_kg(self):
        qty, unit = parse_size("Rice 2 kg bag")
        assert unit == "oz"
        assert abs(qty - 70.548) < 0.1

    def test_count_only(self):
        qty, unit = parse_size("Paper Plates 120 count")
        assert unit == "count"
        assert qty == 120

    def test_ct_alias(self):
        qty, unit = parse_size("Vitamins 90 ct")
        assert unit == "count"
        assert qty == 90

    def test_no_size_returns_none(self):
        qty, unit = parse_size("Product with no size info here")
        assert qty is None
        assert unit is None


class TestParseAndFilter:
    def test_compatible_passes(self):
        qty, unit = parse_and_filter("Water 32 oz", "oz")
        assert qty is not None

    def test_incompatible_filtered_out(self):
        # oz product searched with count unit -> should be filtered
        qty, unit = parse_and_filter("Water 32 oz", "count")
        assert qty is None

    def test_volume_compatible_with_volume(self):
        qty, unit = parse_and_filter("Juice 500 ml", "l")
        assert qty is not None
