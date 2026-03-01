"""
Product matching using RapidFuzz.
Scoring: 60% text similarity + 25% size similarity + 15% keyword overlap.
"""
import re
from rapidfuzz import fuzz
from config import WEIGHT_TEXT, WEIGHT_SIZE, WEIGHT_KEYWORDS


def _extract_keywords(text: str) -> set[str]:
    """Lowercase alpha-numeric tokens, stop-words removed."""
    stop = {"the", "a", "an", "and", "or", "of", "with", "for", "in", "oz", "lb",
            "g", "kg", "ml", "l", "ct", "pk", "fl", "pack", "count"}
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in stop}


def _size_similarity(size_a: float | None, size_b: float | None) -> float:
    """Return 0-1 similarity between two normalized sizes."""
    if size_a is None or size_b is None:
        return 0.5  # neutral when unknown
    if size_a == 0 and size_b == 0:
        return 1.0
    larger  = max(size_a, size_b)
    smaller = min(size_a, size_b)
    if larger == 0:
        return 1.0
    return smaller / larger


def score_match(
    query: str,
    candidate_title: str,
    query_size: float | None,
    candidate_size: float | None,
) -> float:
    """Return composite match score in [0, 100]."""
    text_score = fuzz.token_set_ratio(query, candidate_title) / 100.0

    size_score = _size_similarity(query_size, candidate_size)

    q_kw  = _extract_keywords(query)
    c_kw  = _extract_keywords(candidate_title)
    if q_kw | c_kw:
        kw_score = len(q_kw & c_kw) / len(q_kw | c_kw)
    else:
        kw_score = 0.0

    composite = (
        WEIGHT_TEXT     * text_score +
        WEIGHT_SIZE     * size_score +
        WEIGHT_KEYWORDS * kw_score
    ) * 100.0

    return round(composite, 2)


def find_best_match(
    query: str,
    query_size: float | None,
    candidates: list[dict],  # each has 'title', 'quantity' (normalized)
) -> tuple[dict | None, float]:
    """
    Score all candidates and return (best_candidate, score).
    Returns (None, 0.0) if candidates is empty.
    """
    if not candidates:
        return (None, 0.0)

    scored = []
    for c in candidates:
        s = score_match(
            query,
            c.get("title", ""),
            query_size,
            c.get("quantity"),
        )
        scored.append((s, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    return (best, best_score)
