-- TBidder Health: store health check history for uptime % and bar graph (4-7 days)
CREATE TABLE IF NOT EXISTS health_check_history (
  id SERIAL PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_check_history_checked_at ON health_check_history(checked_at DESC);
