-- Speeds up lookups for the active case of a conversation.
CREATE INDEX IF NOT EXISTS conversation_cases_open_lookup_idx
  ON conversation_cases (conversation_href, is_closed, opened_received_at_utc DESC);
