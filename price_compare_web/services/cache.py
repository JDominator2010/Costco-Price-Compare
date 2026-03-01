"""
SQLite cache for Walmart search results.
"""
import sqlite3
import time
import json
from typing import Optional
from config import DB_PATH, CACHE_TTL_SECONDS


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS walmart_cache (
                query     TEXT NOT NULL,
                results   TEXT NOT NULL,  -- JSON array of product dicts
                timestamp INTEGER NOT NULL,
                PRIMARY KEY (query)
            )
        """)
        conn.commit()


def get_cached(query: str) -> Optional[list[dict]]:
    cutoff = int(time.time()) - CACHE_TTL_SECONDS
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT results FROM walmart_cache WHERE query=? AND timestamp>?",
            (query.lower(), cutoff)
        ).fetchone()
    if row:
        return json.loads(row["results"])
    return None


def set_cache(query: str, results: list[dict]) -> None:
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO walmart_cache (query, results, timestamp) VALUES (?,?,?)",
            (query.lower(), json.dumps(results), int(time.time()))
        )
        conn.commit()
