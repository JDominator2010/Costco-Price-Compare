/**
 * Product matching — fuzzy text + size + keyword scoring.
 * Uses a simple Levenshtein-based token set similarity (no external library).
 */

// Simple Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// Token set ratio: compare sorted unique token intersection+remainder
function tokenSetRatio(a, b) {
  const ta = [...new Set(a.toLowerCase().split(/\s+/).filter(Boolean))].sort();
  const tb = [...new Set(b.toLowerCase().split(/\s+/).filter(Boolean))].sort();
  const sa = ta.join(" ");
  const sb = tb.join(" ");
  const maxLen = Math.max(sa.length, sb.length);
  if (maxLen === 0) return 100;
  return ((1 - levenshtein(sa, sb) / maxLen) * 100);
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "with", "for", "in",
  "oz", "lb", "g", "kg", "ml", "l", "ct", "pk", "fl", "pack", "count"
]);

function extractKeywords(text) {
  return new Set(
    text.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !STOP_WORDS.has(w)) || []
  );
}

function sizeSimilarity(a, b) {
  if (a == null || b == null) return 0.5;
  if (a === 0 && b === 0) return 1;
  const larger = Math.max(a, b);
  const smaller = Math.min(a, b);
  return larger === 0 ? 1 : smaller / larger;
}

const W_TEXT = 0.60, W_SIZE = 0.25, W_KW = 0.15;

export function scoreMatch(query, candidateTitle, querySize, candidateSize) {
  const textScore = tokenSetRatio(query, candidateTitle) / 100;
  const sizeScore = sizeSimilarity(querySize, candidateSize);

  const qKw = extractKeywords(query);
  const cKw = extractKeywords(candidateTitle);
  const union = new Set([...qKw, ...cKw]);
  const inter = new Set([...qKw].filter(x => cKw.has(x)));
  const kwScore = union.size ? inter.size / union.size : 0;

  return +((W_TEXT * textScore + W_SIZE * sizeScore + W_KW * kwScore) * 100).toFixed(2);
}
