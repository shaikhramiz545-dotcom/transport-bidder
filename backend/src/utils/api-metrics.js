/**
 * Response time + error rate tracking – last 60 seconds sliding window.
 */
const WINDOW_MS = 60 * 1000;
const entries = [];

function record(durationMs, isError) {
  const now = Date.now();
  entries.push({ time: now, durationMs, isError });
  const cutoff = now - WINDOW_MS;
  while (entries.length > 0 && entries[0].time < cutoff) {
    entries.shift();
  }
}

function getMetrics() {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = entries.filter((e) => e.time >= cutoff);
  const total = recent.length;
  const errors = recent.filter((e) => e.isError).length;
  const sumMs = recent.reduce((a, e) => a + e.durationMs, 0);
  const avgMs = total > 0 ? Math.round(sumMs / total) : 0;
  const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : 0;
  return {
    avgResponseTimeMs: avgMs,
    errorCount: errors,
    totalRequests: total,
    errorRatePercent: parseFloat(errorRate),
  };
}

module.exports = { record, getMetrics };
