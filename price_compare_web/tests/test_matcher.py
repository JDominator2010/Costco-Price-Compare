"""
Unit tests for services/matcher.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.matcher import score_match, find_best_match


class TestScoreMatch:
    def test_identical_returns_high_score(self):
        score = score_match("Kirkland Water", "Kirkland Water", 100, 100)
        assert score > 80

    def test_completely_different_returns_low_score(self):
        score = score_match("Kirkland Water", "Sony PlayStation Controller", 100, 50)
        assert score < 40

    def test_size_mismatch_lowers_score(self):
        score_good = score_match("water bottle", "water bottle 16.9 oz", 16.9, 16.9)
        score_bad  = score_match("water bottle", "water bottle 16.9 oz", 16.9, 500)
        assert score_good > score_bad

    def test_unknown_size_neutral(self):
        score_with    = score_match("water", "water 32 oz", 32, 32)
        score_without = score_match("water", "water 32 oz", None, None)
        # Both should be somewhat reasonable (not crash)
        assert 0 <= score_without <= 100
        assert 0 <= score_with    <= 100

    def test_returns_float(self):
        score = score_match("chips", "tortilla chips", None, None)
        assert isinstance(score, float)


class TestFindBestMatch:
    def test_empty_candidates_returns_none(self):
        best, score = find_best_match("water", 32, [])
        assert best is None
        assert score == 0.0

    def test_selects_best_title_match(self):
        candidates = [
            {"title": "Kirkland Water 16.9 fl oz 40 count", "price": 8.99, "quantity": 676},
            {"title": "Paper Towels 12 pack",                "price": 12.99, "quantity": 12},
            {"title": "Potato Chips 10 oz",                  "price": 3.49, "quantity": 10},
        ]
        best, score = find_best_match("Kirkland Water", 676, candidates)
        assert best["title"] == "Kirkland Water 16.9 fl oz 40 count"
        assert score > 50

    def test_score_in_range(self):
        candidates = [{"title": "Some product", "price": 5.0, "quantity": 32}]
        _, score = find_best_match("product", 32, candidates)
        assert 0 <= score <= 100
