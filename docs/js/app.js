/**
 * Main application — orchestrates search, candidate display, and comparison.
 */
import { normalizeToBase } from "./normalizer.js";
import { parseAndFilter } from "./parser.js";
import { scoreMatch } from "./matcher.js";
import { compare } from "./comparator.js";

// ── Config ──────────────────────────────────────────────────────────────────
function getWorkerUrl() {
  // Provided by inline script in index.html (always available)
  if (typeof window.__getWorkerUrl === "function") return window.__getWorkerUrl();
  return (localStorage.getItem("pricecompare_worker_url") || "").trim();
}

// ── DOM refs ────────────────────────────────────────────────────────────────
const form         = document.getElementById("costco-form");
const candidatesEl = document.getElementById("candidates");
const comparisonEl = document.getElementById("comparison");
const costcoCardEl = document.getElementById("costco-summary");
const statusEl     = document.getElementById("status-msg");
const placeholderEl = document.getElementById("placeholder");

let currentCostco = null;   // { name, price, totalQty, unit, pricePerUnit }
let currentCandidates = []; // enriched walmart items
let rawResults = [];

// ── Helpers ─────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const fmt = (n, d = 2) => Number(n).toFixed(d);

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = `text-center py-3 text-sm font-medium rounded-xl mb-3 ${
    isError ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
  }`;
  statusEl.classList.remove("hidden");
}
function hideStatus() { statusEl.classList.add("hidden"); }

// ── Search flow ─────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  comparisonEl.innerHTML = "";

  const name = form.name.value.trim();
  const price = parseFloat(form.price.value);
  const quantity = parseFloat(form.quantity.value);
  const unit = form.unit.value;

  if (!name || isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0) {
    showStatus("⚠️ Please fill in all fields correctly.", true);
    return;
  }

  // Normalize Costco item
  const norm = normalizeToBase(quantity, unit);
  const ppu = price / norm.qty;
  currentCostco = {
    name, price,
    totalQty: +norm.qty.toFixed(4),
    unit: norm.unit,
    pricePerUnit: +ppu.toFixed(6),
  };

  renderCostcoSummary();

  // Fetch Walmart results
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    showStatus("⚠️ Worker URL not configured. Click the ⚙️ gear icon to set it up.", true);
    candidatesEl.innerHTML = "";
    return;
  }
  showStatus("🔍 Searching Walmart…");
  placeholderEl?.classList.add("hidden");

  try {
    const resp = await fetch(`${workerUrl}/search?q=${encodeURIComponent(name)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    rawResults = await resp.json();
  } catch (err) {
    showStatus(`⚠️ Could not reach Walmart search. Check your Worker URL in ⚙️ Settings. (${err.message})`, true);
    candidatesEl.innerHTML = "";
    return;
  }

  // Handle error/diagnostic response from worker
  if (rawResults.error) {
    const d = rawResults.detail;
    let msg = `⚠️ ${rawResults.error}`;
    if (typeof d === "object" && d.botDetected) {
      msg = "⚠️ Walmart bot detection triggered. Try again in a minute, or redeploy the worker.";
    } else if (typeof d === "object" && d.hint) {
      msg = `⚠️ ${d.hint}`;
    } else if (typeof d === "string") {
      msg = `⚠️ ${rawResults.error}: ${d}`;
    }
    showStatus(msg, true);
    candidatesEl.innerHTML = "";
    return;
  }

  if (!Array.isArray(rawResults) || !rawResults.length) {
    showStatus("No Walmart results found. Try a different search term.", true);
    candidatesEl.innerHTML = "";
    return;
  }

  hideStatus();

  // Enrich candidates
  currentCandidates = rawResults.map((r, i) => {
    const parsed = parseAndFilter(r.title, unit);
    const sc = scoreMatch(name, r.title, norm.qty, parsed.qty);
    let ppuW = null;
    if (r.price != null && parsed.qty) ppuW = +(r.price / parsed.qty).toFixed(6);
    return { ...r, index: i, qty: parsed.qty, pUnit: parsed.unit, ppu: ppuW, score: sc };
  });

  currentCandidates.sort((a, b) => b.score - a.score);
  renderCandidates();
});

// ── Render functions ────────────────────────────────────────────────────────
function renderCostcoSummary() {
  const c = currentCostco;
  costcoCardEl.innerHTML = `
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Your Costco Item Summary</p>
    <p class="font-semibold text-gray-800 text-base mb-2">${c.name}</p>
    <div class="grid grid-cols-3 gap-2 text-sm">
      <div class="bg-gray-50 rounded-lg p-2 text-center">
        <p class="text-xs text-gray-400 uppercase">Price</p>
        <p class="font-bold text-gray-800">$${fmt(c.price)}</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-2 text-center">
        <p class="text-xs text-gray-400 uppercase">Size</p>
        <p class="font-semibold">${c.totalQty} ${c.unit}</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-2 text-center">
        <p class="text-xs text-gray-400 uppercase">PPU</p>
        <p class="font-bold text-blue-700">$${fmt(c.pricePerUnit, 4)}</p>
      </div>
    </div>`;
  costcoCardEl.classList.remove("hidden");
}

function renderCandidates(selectedIdx = null) {
  const c = currentCostco;
  candidatesEl.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-bold uppercase tracking-widest text-white bg-[#0071CE] px-2 py-0.5 rounded">WALMART</span>
      <h2 class="text-lg font-bold">Matching Items</h2>
      <span class="ml-auto text-xs text-gray-400">${currentCandidates.length} results</span>
    </div>
    <div class="space-y-2" id="cand-list"></div>`;

  const list = document.getElementById("cand-list");

  for (const item of currentCandidates) {
    const isSel = item.index === selectedIdx;
    let diffBadge = "";
    if (item.ppu != null && c.pricePerUnit) {
      const diff = ((item.ppu - c.pricePerUnit) / c.pricePerUnit * 100);
      if (diff < -2) diffBadge = `<span class="bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">${Math.round(diff)}%</span>`;
      else if (diff > 2) diffBadge = `<span class="bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">+${Math.round(diff)}%</span>`;
      else diffBadge = `<span class="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">≈ equal</span>`;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `w-full text-left rounded-xl border transition-all p-3 group ${
      isSel ? "bg-blue-50 border-blue-400 shadow-md" : "bg-white border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md"
    }`;
    btn.innerHTML = `
      <div class="flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm text-gray-800 leading-snug mb-1 ${isSel ? 'text-blue-800' : 'group-hover:text-blue-700'} transition-colors">
            ${isSel ? '✓ ' : ''}${item.title}
          </p>
          <div class="flex flex-wrap gap-1.5 text-xs">
            ${item.price != null
              ? `<span class="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full">$${fmt(item.price)}</span>`
              : `<span class="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">No price</span>`}
            ${item.qty ? `<span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">${item.qty.toFixed(1)} ${item.pUnit}</span>` : ''}
            ${item.ppu != null ? `<span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">$${fmt(item.ppu, 4)}/${item.pUnit}</span>` : ''}
            ${diffBadge}
          </div>
        </div>
        <div class="flex flex-col items-end gap-0.5 shrink-0 text-xs">
          <span class="text-gray-400">${Math.round(item.score)}%</span>
          ${isSel
            ? '<span class="text-blue-700 font-semibold">Selected</span>'
            : '<span class="text-blue-600 font-semibold group-hover:underline">Compare →</span>'}
        </div>
      </div>`;

    btn.addEventListener("click", () => selectCandidate(item.index));
    list.appendChild(btn);
  }
}

// ── Selection & comparison ──────────────────────────────────────────────────
function selectCandidate(idx) {
  const item = currentCandidates.find(c => c.index === idx);
  if (!item || item.price == null) {
    showStatus("⚠️ This item has no price data. Pick another.", true);
    return;
  }
  hideStatus();

  const wQty = item.qty || currentCostco.totalQty;
  const wPpu = item.price / wQty;
  const walmart = {
    name: item.title, price: item.price,
    totalQty: +wQty.toFixed(4),
    unit: item.pUnit || currentCostco.unit,
    pricePerUnit: +wPpu.toFixed(6),
  };

  const result = compare(currentCostco, walmart);
  result.walmartUrl = item.url || "";
  result.matchScore = item.score;

  renderCandidates(idx);
  renderComparison(result);
}

function renderComparison(r) {
  const bannerCls = { green: "bg-green-50 border-green-300 text-green-800",
                      blue: "bg-blue-50 border-blue-300 text-blue-800",
                      yellow: "bg-yellow-50 border-yellow-300 text-yellow-800" };
  const icons = { green: "🟢", blue: "🔵", yellow: "🟡" };

  const c = r.costco, w = r.walmart;
  const maxPpu = Math.max(c.pricePerUnit, w.pricePerUnit) || 1;
  const cPct = (c.pricePerUnit / maxPpu * 100).toFixed(1);
  const wPct = (w.pricePerUnit / maxPpu * 100).toFixed(1);

  comparisonEl.innerHTML = `
    <!-- Banner -->
    <div class="rounded-2xl border-2 ${bannerCls[r.color]} px-5 py-4 mb-4 text-center">
      <p class="text-2xl font-extrabold mb-1">${icons[r.color]}
        ${r.cheaper === "Equal" ? "Nearly Equal Price" : `${r.cheaper} Wins`}
      </p>
      ${r.cheaper !== "Equal"
        ? `<p class="text-base font-medium">${fmt(r.percentDiff, 1)}% cheaper per ${c.unit}</p>`
        : `<p class="text-sm">Within ${fmt(r.percentDiff, 1)}% of each other</p>`}
    </div>

    <!-- Side by side cards -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      ${storeCard("COSTCO", "#005DAA", c, r.cheaper === "Costco", null)}
      ${storeCard("WALMART", "#0071CE", w, r.cheaper === "Walmart", r.walmartUrl)}
    </div>

    <!-- Breakdown -->
    <div class="bg-white rounded-2xl shadow-md p-5 mb-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Price Breakdown</p>
      <div class="space-y-3 mb-4">
        ${ppuBar("Costco PPU", c.pricePerUnit, c.unit, "#005DAA", cPct)}
        ${ppuBar("Walmart PPU", w.pricePerUnit, w.unit, "#0071CE", wPct)}
      </div>
      <div class="border-t border-gray-100 pt-3 space-y-2">
        ${statRow("PPU Difference",
          r.ppuDiff > 0 ? `<span class="font-semibold text-green-700">$${fmt(Math.abs(r.ppuDiff), 4)} cheaper at Walmart</span>` :
          r.ppuDiff < 0 ? `<span class="font-semibold text-blue-700">$${fmt(Math.abs(r.ppuDiff), 4)} cheaper at Costco</span>` :
          `<span class="font-semibold text-yellow-600">Equal</span>`)}
        ${statRow("Percent Difference", `<span class="font-semibold text-gray-800">${fmt(r.percentDiff, 1)}%</span>`)}
        ${statRow(`If Walmart sold same size (${c.totalQty} ${c.unit})`,
          `<span class="font-semibold text-gray-800">$${fmt(r.equivWalmartPrice)}</span>`)}
        ${statRow("Savings at equivalent size",
          r.equivSavings > 0 ? `<span class="font-bold text-blue-700">You save $${fmt(r.equivSavings)} at Costco</span>` :
          r.equivSavings < 0 ? `<span class="font-bold text-green-700">You save $${fmt(Math.abs(r.equivSavings))} at Walmart</span>` :
          `<span class="font-semibold text-yellow-600">Same price</span>`)}
        ${statRow("Match Score", `<span class="text-gray-600">${Math.round(r.matchScore)}%</span>`)}
      </div>
    </div>`;

  comparisonEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function storeCard(label, bgColor, item, isWinner, url) {
  return `
    <div class="bg-white rounded-2xl shadow-md p-4 ${isWinner ? 'ring-2 ring-green-400' : ''}">
      <div class="flex items-center gap-1.5 mb-2">
        <span class="text-[10px] font-bold uppercase tracking-widest text-white px-1.5 py-0.5 rounded" style="background:${bgColor}">${label}</span>
        ${isWinner ? '<span class="text-[10px] text-green-700 font-semibold bg-green-100 px-1.5 py-0.5 rounded-full">✓ Winner</span>' : ''}
      </div>
      <p class="font-semibold text-gray-800 text-sm leading-snug mb-2">${item.name.length > 60 ? item.name.slice(0, 60) + '…' : item.name}</p>
      <div class="space-y-1.5 text-sm">
        <div class="bg-gray-50 rounded-lg px-2 py-1.5">
          <p class="text-[10px] text-gray-400 uppercase">Total Price</p>
          <p class="font-bold text-gray-800">$${fmt(item.price)}</p>
        </div>
        <div class="bg-gray-50 rounded-lg px-2 py-1.5">
          <p class="text-[10px] text-gray-400 uppercase">Size</p>
          <p class="font-semibold text-gray-700">${item.totalQty} ${item.unit}</p>
        </div>
        <div class="bg-blue-50 rounded-lg px-2 py-1.5">
          <p class="text-[10px] text-blue-400 uppercase">Price Per Unit</p>
          <p class="font-bold text-blue-800 text-base">$${fmt(item.pricePerUnit, 4)}</p>
          <p class="text-[10px] text-blue-500">per ${item.unit}</p>
        </div>
      </div>
      ${url ? `<a href="${url}" target="_blank" rel="noopener" class="mt-2 block text-center text-blue-600 border border-blue-200 rounded-lg py-1.5 text-xs font-medium hover:bg-blue-50">View on Walmart →</a>` : ''}
    </div>`;
}

function ppuBar(label, ppu, unit, color, pct) {
  return `<div>
    <div class="flex justify-between text-xs text-gray-500 mb-1">
      <span>${label}</span>
      <span class="font-semibold">$${fmt(ppu, 4)} / ${unit}</span>
    </div>
    <div class="h-4 bg-gray-100 rounded-full overflow-hidden">
      <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${color}"></div>
    </div>
  </div>`;
}

function statRow(label, valueHtml) {
  return `<div class="flex justify-between text-sm">
    <span class="text-gray-500">${label}</span>${valueHtml}
  </div>`;
}
