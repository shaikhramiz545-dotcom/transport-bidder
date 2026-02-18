/**
 * Wallet credit conversion helper.
 * 1 Sol = 20 credits.
 * Examples: 5 soles → 100, 10 → 200, 20 → 400, 100 → 2000.
 */
function calculateCredits(soles) {
  const s = Number(soles);
  if (Number.isNaN(s) || s <= 0) return 0;
  return Math.floor(s * 20);
}

module.exports = { calculateCredits };
