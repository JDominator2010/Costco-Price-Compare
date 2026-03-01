/**
 * Cloudflare Worker — Walmart search proxy.
 * 1. Warms up by fetching walmart.com homepage to collect cookies
 * 2. Fetches search page with those cookies + full browser headers
 * 3. Parses __NEXT_DATA__ JSON from HTML
 * 4. Returns clean product JSON with CORS headers
 */

const MAX_RESULTS = 10;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
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

function extractCookies(response) {
  const cookies = [];
  // Workers can read Set-Cookie via getAll
  const raw = response.headers.getAll ? response.headers.getAll("set-cookie") : [];
  for (const c of raw) {
    const name_val = c.split(";")[0];
    if (name_val) cookies.push(name_val.trim());
  }
  return cookies.join("; ");
}

function extractProducts(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>(.+?)<\/script>/s);
  if (!m) return { products: [], debug: "no_next_data" };

  let data;
  try { data = JSON.parse(m[1]); } catch { return { products: [], debug: "json_parse_error" }; }

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
      if (results.length >= MAX_RESULTS) return { products: results, debug: "ok" };
    }
  }

  return { products: results, debug: results.length ? "ok" : "no_products_in_stacks" };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);

    // Health check endpoint
    if (reqUrl.pathname === "/health") {
      return jsonResponse({ status: "ok" });
    }

    if (reqUrl.pathname !== "/search") {
      return jsonResponse({ error: "Use GET /search?q=<query> or GET /health" }, 400);
    }

    const query = reqUrl.searchParams.get("q");
    if (!query) {
      return jsonResponse({ error: "Missing ?q= parameter" }, 400);
    }

    let cookies = "";

    // Step 1: Warm up — fetch homepage to collect cookies (like the Python version)
    try {
      const warmup = await fetch("https://www.walmart.com/", {
        headers: BROWSER_HEADERS,
        redirect: "follow",
      });
      cookies = extractCookies(warmup);
      // Consume body to free connection
      await warmup.text();
    } catch (_) {
      // Continue without cookies
    }

    // Step 2: Fetch search page with cookies
    let html, httpStatus;
    try {
      const searchHeaders = { ...BROWSER_HEADERS, "Referer": "https://www.walmart.com/" };
      if (cookies) searchHeaders["Cookie"] = cookies;

      const resp = await fetch(
        "https://www.walmart.com/search?q=" + encodeURIComponent(query),
        { headers: searchHeaders, redirect: "follow" }
      );
      httpStatus = resp.status;
      html = await resp.text();
    } catch (err) {
      return jsonResponse({ error: "Failed to fetch Walmart", detail: err.message }, 502);
    }

    // Step 3: Parse products
    const { products, debug } = extractProducts(html);

    if (products.length === 0) {
      // Return diagnostic info to help debug
      const hasRobot = html.includes("Robot or human");
      const hasBlocked = html.includes("blocked") || html.includes("Access Denied");
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "unknown";
      return jsonResponse({
        error: "No products found",
        detail: {
          httpStatus,
          parseResult: debug,
          botDetected: hasRobot,
          blocked: hasBlocked,
          pageTitle,
          htmlLength: html.length,
          hint: hasRobot
            ? "Walmart bot detection triggered. The Worker IP may be blocked."
            : "Page loaded but no product data found.",
        },
      }, 200); // 200 so CORS works in browser
    }

    return jsonResponse(products);
  },
};
