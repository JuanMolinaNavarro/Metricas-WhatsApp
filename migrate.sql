ALTER TABLE conversation_day_metrics ADD COLUMN team_uuid TEXT;
ALTER TABLE conversation_day_metrics ADD COLUMN team_name TEXT;

CREATE TABLE team_day_metrics (
    team_uuid TEXT NOT NULL,
    team_name TEXT NOT NULL,
    local_date DATE NOT NULL,
    inbound_count INTEGER NOT NULL DEFAULT 0,
    outbound_count INTEGER NOT NULL DEFAULT 0,
    conversations INTEGER NOT NULL DEFAULT 0,
    answered_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT team_day_metrics_pkey PRIMARY KEY (team_uuid, local_date)
);

CREATE INDEX team_day_metrics_team_name_idx ON team_day_metrics(team_name);
CREATE INDEX team_day_metrics_local_date_idx ON team_day_metrics(local_date);
