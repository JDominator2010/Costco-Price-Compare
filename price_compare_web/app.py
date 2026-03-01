"""
FastAPI application — Grocery Price Comparator
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import json
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from config import SUPPORTED_UNITS
from models import CostcoItem, NormalizedItem, WalmartCandidate
from services.cache import init_db, get_cached, set_cache
from services.walmart_client import search_walmart
from services.parser import parse_and_filter
from services.matcher import score_match
from services.unit_normalizer import normalize_to_base
from services.comparator import compare

app = FastAPI(title="Grocery Price Comparator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "units": SUPPORTED_UNITS},
    )


def _build_costco_norm(item: CostcoItem) -> NormalizedItem:
    """Normalize a CostcoItem into a NormalizedItem."""
    total_qty, base_unit = normalize_to_base(item.quantity, item.unit)
    ppu = item.price / total_qty if total_qty else 0.0
    return NormalizedItem(
        name=item.name, price=item.price,
        total_quantity=round(total_qty, 4), unit=base_unit,
        price_per_unit=round(ppu, 6),
    )


def _build_candidates(raw_results: list[dict], item: CostcoItem,
                      costco_total_qty: float) -> list[WalmartCandidate]:
    """Parse, score, and enrich raw Walmart results into sorted candidates."""
    candidates = []
    for i, r in enumerate(raw_results):
        qty, bu = parse_and_filter(r["title"], item.unit)
        sc = score_match(item.name, r["title"], costco_total_qty, qty)
        ppu = None
        if r.get("price") is not None and qty:
            ppu = round(r["price"] / qty, 6)
        candidates.append(WalmartCandidate(
            index=i, title=r["title"], price=r.get("price"),
            url=r.get("url", ""), quantity=qty, unit=bu,
            price_per_unit=ppu, match_score=sc,
        ))
    candidates.sort(key=lambda c: c.match_score, reverse=True)
    return candidates


@app.post("/search", response_class=HTMLResponse)
async def search(
    request: Request,
    name: str      = Form(...),
    price: float   = Form(...),
    quantity: float = Form(...),
    unit: str      = Form(...),
):
    """Step 1: show Walmart candidates for the user to pick from."""
    try:
        item = CostcoItem(name=name, price=price, quantity=quantity, unit=unit)
    except Exception as e:
        return templates.TemplateResponse(
            "index.html",
            {"request": request, "units": SUPPORTED_UNITS, "error": str(e)},
            status_code=422,
        )

    costco_norm = _build_costco_norm(item)

    # Fetch Walmart results (cache-aware)
    raw_results = get_cached(item.name)
    if raw_results is None:
        try:
            raw_results = search_walmart(item.name)
        except Exception:
            raw_results = []
        if raw_results:
            set_cache(item.name, raw_results)

    if not raw_results:
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request, "units": SUPPORTED_UNITS,
                "error": "Could not retrieve Walmart results. Please try again.",
                "costco": costco_norm,
                "form_name": name, "form_price": price,
                "form_quantity": quantity, "form_unit": unit,
            },
        )

    candidates = _build_candidates(raw_results, item, costco_norm.total_quantity)

    # Stash raw results as JSON so /compare can re-use them without re-scraping
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request, "units": SUPPORTED_UNITS,
            "costco": costco_norm,
            "candidates": candidates,
            "raw_json": json.dumps(raw_results),
            "form_name": name, "form_price": price,
            "form_quantity": quantity, "form_unit": unit,
        },
    )


@app.post("/compare", response_class=HTMLResponse)
async def compare_prices(
    request: Request,
    name: str       = Form(...),
    price: float    = Form(...),
    quantity: float = Form(...),
    unit: str       = Form(...),
    selected: int   = Form(...),      # index of the chosen walmart item
    raw_json: str   = Form(...),      # cached raw results
):
    """Step 2: compare the user-selected Walmart item against Costco."""
    try:
        item = CostcoItem(name=name, price=price, quantity=quantity, unit=unit)
    except Exception as e:
        return templates.TemplateResponse(
            "index.html",
            {"request": request, "units": SUPPORTED_UNITS, "error": str(e)},
            status_code=422,
        )

    costco_norm = _build_costco_norm(item)

    raw_results = json.loads(raw_json)
    candidates = _build_candidates(raw_results, item, costco_norm.total_quantity)

    # Find the selected candidate by original index
    chosen = next((c for c in candidates if c.index == selected), None)
    if chosen is None or chosen.price is None:
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request, "units": SUPPORTED_UNITS,
                "error": "Selected item has no price data. Pick another.",
                "costco": costco_norm, "candidates": candidates,
                "raw_json": raw_json,
                "form_name": name, "form_price": price,
                "form_quantity": quantity, "form_unit": unit,
            },
        )

    # Normalize Walmart item
    walmart_qty = chosen.quantity or costco_norm.total_quantity
    walmart_ppu = chosen.price / walmart_qty if walmart_qty else 0.0
    walmart_norm = NormalizedItem(
        name=chosen.title, price=chosen.price,
        total_quantity=round(walmart_qty, 4),
        unit=chosen.unit or costco_norm.unit,
        price_per_unit=round(walmart_ppu, 6),
    )

    result = compare(
        costco_norm, walmart_norm,
        chosen.match_score, chosen.title, chosen.url,
    )

    return templates.TemplateResponse(
        "results.html",
        {
            "request": request, "result": result,
            "candidates": candidates,
            "raw_json": raw_json,
            "form_name": name, "form_price": price,
            "form_quantity": quantity, "form_unit": unit,
            "selected": selected, "units": SUPPORTED_UNITS,
        },
    )
