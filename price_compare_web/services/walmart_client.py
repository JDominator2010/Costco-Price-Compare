"""
Walmart search using curl_cffi to mimic Chrome's TLS fingerprint,
bypassing PerimeterX bot detection.
Parses product data from the embedded __NEXT_DATA__ JSON.
"""
import re
import json
from typing import Optional
from urllib.parse import quote_plus

from curl_cffi import requests as cf_requests

from config import WALMART_SEARCH_URL, MAX_RESULTS, SCRAPE_TIMEOUT_MS

_IMPERSONATE = "chrome131"
_TIMEOUT_S   = SCRAPE_TIMEOUT_MS / 1000

_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}


def _parse_price(price_str: str) -> Optional[float]:
    """Extract float from strings like '$19.22' or '19.22'."""
    if not price_str:
        return None
    m = re.search(r"[\d]+\.?\d*", price_str.replace(",", ""))
    return float(m.group()) if m else None


def _extract_products(html: str) -> list[dict]:
    """Parse __NEXT_DATA__ JSON and pull out product items."""
    m = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.+?)</script>',
        html, re.DOTALL
    )
    if not m:
        return []

    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return []

    initial = (data.get("props", {})
                   .get("pageProps", {})
                   .get("initialData", {}))
    stacks = initial.get("searchResult", {}).get("itemStacks", [])

    results = []
    for stack in stacks:
        for item in stack.get("items", []):
            if item.get("__typename") != "Product":
                continue
            title = item.get("name", "").strip()
            if not title:
                continue

            price_info = item.get("priceInfo", {})
            # linePrice is most reliable; fall back to itemPrice
            raw_price = price_info.get("linePrice") or price_info.get("itemPrice", "")
            price = _parse_price(raw_price)

            canonical = item.get("canonicalUrl", "")
            url = (
                f"https://www.walmart.com{canonical}"
                if canonical.startswith("/")
                else canonical
            )

            results.append({"title": title, "price": price, "url": url})
            if len(results) >= MAX_RESULTS:
                return results

    return results


def search_walmart(query: str) -> list[dict]:
    """
    Fetch Walmart search results for *query*.
    Returns up to MAX_RESULTS product dicts: {title, price, url}.
    """
    url = WALMART_SEARCH_URL.format(query=quote_plus(query))

    with cf_requests.Session(impersonate=_IMPERSONATE) as session:
        # Warm-up: visit homepage to obtain cookies/session tokens
        try:
            session.get("https://www.walmart.com/", headers=_HEADERS,
                        timeout=_TIMEOUT_S)
        except Exception:
            pass  # non-fatal

        try:
            resp = session.get(url, headers=_HEADERS, timeout=_TIMEOUT_S)
        except Exception:
            return []

    if resp.status_code != 200:
        return []

    return _extract_products(resp.text)

