# Grocery Price Comparator

Compare Costco item prices against Walmart — by price-per-unit.

Two versions are included:
- **`docs/`** — Static GitHub Pages site (HTML/CSS/JS) + Cloudflare Worker backend
- **`price_compare_web/`** — Local Python/FastAPI app (standalone, no cloud needed)

---

## 🌐 GitHub Pages Version (docs/)

A fully static single-page app hosted on GitHub Pages. Walmart search goes through a free Cloudflare Worker proxy.

### Deploy in 3 Steps

#### Step 1: Deploy the Cloudflare Worker

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Deploy the worker:
   ```bash
   cd worker
   wrangler deploy
   ```
4. Wrangler will print your worker URL, e.g.:
   ```
   https://walmart-search-proxy.YOUR_SUBDOMAIN.workers.dev
   ```

#### Step 2: Update the Worker URL in the frontend

Edit `docs/js/app.js` line ~12 and replace:
```js
const WORKER_URL = "https://walmart-search-proxy.YOUR_SUBDOMAIN.workers.dev";
```
with your actual worker URL from Step 1.

#### Step 3: Enable GitHub Pages

1. Go to your repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `master`, folder: `/docs`
4. Click **Save**
5. Your site will be live at `https://<username>.github.io/Costco-Price-Compare/`

### Cloudflare Worker Free Tier
- 100,000 requests/day
- No credit card required
- Zero config beyond `wrangler deploy`

---

## 🐍 Local Python Version (price_compare_web/)

A standalone FastAPI app. No cloud services needed — runs entirely on your machine.

### Setup
```bash
cd price_compare_web
pip install -r requirements.txt
```

### Run
```bash
uvicorn app:app --reload
# → http://127.0.0.1:8000
```

### Run Tests
```bash
pytest tests/ -v
```

---

## Project Structure
```
├── docs/                        # GitHub Pages static site
│   ├── index.html               # Single-page app
│   └── js/
│       ├── app.js               # Main logic + UI rendering
│       ├── normalizer.js        # Unit conversion
│       ├── parser.js            # Title size parsing
│       ├── matcher.js           # Fuzzy scoring
│       └── comparator.js        # PPU comparison
│
├── worker/                      # Cloudflare Worker (Walmart proxy)
│   ├── wrangler.toml
│   └── src/index.js
│
└── price_compare_web/           # Local Python/FastAPI version
    ├── app.py
    ├── services/
    └── tests/
```
