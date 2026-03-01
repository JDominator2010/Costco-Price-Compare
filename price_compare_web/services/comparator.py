"""
Price-per-unit comparison between Costco and Walmart items.
"""
from models import NormalizedItem, ComparisonResult
from config import NEARLY_EQUAL_THRESHOLD


def compare(costco: NormalizedItem, walmart: NormalizedItem,
            walmart_score: float, walmart_title: str, walmart_url: str) -> ComparisonResult:
    costco_ppu  = costco.price_per_unit
    walmart_ppu = walmart.price_per_unit

    if costco_ppu == 0 or walmart_ppu == 0:
        percent_diff = 0.0
        ppu_diff = 0.0
        dollar_savings = 0.0
        cheaper = "Equal"
        color = "yellow"
    else:
        avg = (costco_ppu + walmart_ppu) / 2
        percent_diff = abs(costco_ppu - walmart_ppu) / avg * 100.0
        ppu_diff = costco_ppu - walmart_ppu  # positive = Walmart cheaper
        dollar_savings = abs(costco_ppu - walmart_ppu)

        if percent_diff < NEARLY_EQUAL_THRESHOLD:
            cheaper = "Equal"
            color = "yellow"
        elif walmart_ppu < costco_ppu:
            cheaper = "Walmart"
            color = "green"
        else:
            cheaper = "Costco"
            color = "blue"

    # What Walmart would cost for the same quantity as Costco
    equiv_walmart_price = walmart_ppu * costco.total_quantity
    equiv_savings = costco.price - equiv_walmart_price

    return ComparisonResult(
        costco=costco,
        walmart=walmart,
        cheaper_store=cheaper,
        percent_difference=round(percent_diff, 2),
        dollar_savings=round(dollar_savings, 4),
        ppu_difference=round(ppu_diff, 6),
        color=color,
        walmart_match_score=walmart_score,
        walmart_title=walmart_title,
        walmart_url=walmart_url,
        equivalent_walmart_price=round(equiv_walmart_price, 2),
        equivalent_savings=round(equiv_savings, 2),
    )
