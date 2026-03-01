from pydantic import BaseModel, Field
from typing import Optional


class CostcoItem(BaseModel):
    name: str = Field(..., min_length=1)
    price: float = Field(..., gt=0)
    quantity: float = Field(..., gt=0)
    unit: str  # oz | lb | g | kg | ml | l | count


class NormalizedItem(BaseModel):
    name: str
    price: float
    total_quantity: float  # in base unit
    unit: str              # base unit label shown to user
    price_per_unit: float


class WalmartCandidate(BaseModel):
    """Enriched Walmart product shown in the candidate list."""
    index: int
    title: str
    price: Optional[float]
    url: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    price_per_unit: Optional[float] = None
    match_score: float = 0.0


class ComparisonResult(BaseModel):
    costco: NormalizedItem
    walmart: NormalizedItem
    cheaper_store: str          # "Costco" | "Walmart" | "Equal"
    percent_difference: float   # absolute %
    dollar_savings: float       # absolute $
    ppu_difference: float       # PPU difference in dollars
    color: str                  # "green" | "blue" | "yellow"
    walmart_match_score: float
    walmart_title: str
    walmart_url: str
    # For a hypothetical "same size" comparison
    equivalent_walmart_price: float  # what Walmart would cost for same qty as Costco
    equivalent_savings: float        # dollar difference at equivalent size
