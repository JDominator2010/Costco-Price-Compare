import os

# Cache
CACHE_TTL_SECONDS = 86400  # 24 hours
DB_PATH = os.path.join(os.path.dirname(__file__), "database", "db.sqlite3")

# Scraper
SCRAPE_TIMEOUT_MS = 10_000
WALMART_SEARCH_URL = "https://www.walmart.com/search?q={query}"
MAX_RESULTS = 10

# Matching weights
WEIGHT_TEXT = 0.60
WEIGHT_SIZE = 0.25
WEIGHT_KEYWORDS = 0.15

# Supported units
SUPPORTED_UNITS = ["oz", "lb", "g", "kg", "ml", "l", "count"]

# Nearly-equal threshold (percent)
NEARLY_EQUAL_THRESHOLD = 2.0
