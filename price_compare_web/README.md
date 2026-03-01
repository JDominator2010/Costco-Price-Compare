# Grocery Price Comparator

A local Python web app that compares Costco item prices against Walmart in real time.

## Features
- Manual Costco item entry (name, price, quantity, unit)
- Automated Walmart search via Playwright (headless)
- Smart unit normalization (oz, lb, g, kg, ml, l, fl oz, count)
- Fuzzy product matching (text + size + keywords)
- Price-per-unit comparison with savings calculation
- 24-hour SQLite result cache
- Mobile-first Tailwind UI

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
playwright install chromium
```

### 2. Run the app
```bash
uvicorn app:app --reload
```

### 3. Open in browser
```
http://127.0.0.1:8000
```

## Run Tests
```bash
pytest tests/ -v
```

## Project Structure
```
price_compare_web/
├── app.py                  # FastAPI routes
├── config.py               # Constants & settings
├── models.py               # Pydantic data models
├── services/
│   ├── walmart_client.py   # Playwright scraper
│   ├── matcher.py          # RapidFuzz scoring
│   ├── unit_normalizer.py  # Pint unit conversion
│   ├── parser.py           # Title size extraction
│   ├── comparator.py       # Price-per-unit comparison
│   └── cache.py            # SQLite cache layer
├── templates/
│   ├── base.html
│   ├── index.html          # Input form
│   └── results.html        # Comparison results
├── static/styles.css
├── database/db.sqlite3     # Auto-created on first run
├── requirements.txt
└── tests/
    ├── test_unit_normalizer.py
    ├── test_parser.py
    └── test_matcher.py
```

## Optional Future Enhancements (not implemented)
- Multi-item grocery list comparison
- Barcode lookup
- Export to CSV
- Price history tracking
- Visual comparison of multiple Walmart matches
