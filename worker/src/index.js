/**
 * Cloudflare Worker — Walmart search proxy.
 * Fetches Walmart search HTML, parses __NEXT_DATA__, returns clean JSON.
 * Allows CORS from any origin (for GitHub Pages).
 */

const WALMART_SEARCH = "https://www.walmart.com/search?q=";
const MAX_RESULTS = 10;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function parsePrice(str) {
  if (!str) return null;
  const m = str.replace(/,/g, "").match(/[\d]+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

function extractProducts(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>(.+?)<\/script>/s);
  if (!m) return [];

  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const stacks = data?.props?.pageProps?.initialData?.searchResult?.itemStacks || [];
  const results = [];

  for (const stack of stacks) {
    for (const item of stack.items || []) {
      if (item.__typename !== "Product") continue;
      const title = (item.name || "").trim();
      if (!title) continue;

      const priceInfo = item.priceInfo || {};
      const rawPrice = priceInfo.linePrice || priceInfo.itemPrice || "";
      const price = parsePrice(rawPrice);

      const canonical = item.canonicalUrl || "";
      const url = canonical.startsWith("/")
        ? `https://www.walmart.com${canonical}`
        : canonical;

      results.push({ title, price, url });
      if (results.length >= MAX_RESULTS) return results;
    }
  }

  return results;
}

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/search") {
      return jsonResponse({ error: "Use GET /search?q=<query>" }, 400);
    }

    const query = url.searchParams.get("q");
    if (!query) {
      return jsonResponse({ error: "Missing ?q= parameter" }, 400);
    }

    // Fetch Walmart search page
    let html;
    try {
      const resp = await fetch(WALMART_SEARCH + encodeURIComponent(query), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      html = await resp.text();
    } catch (err) {
      return jsonResponse({ error: "Failed to fetch Walmart", detail: err.message }, 502);
    }

    const products = extractProducts(html);
    return jsonResponse(products);
  },
};
