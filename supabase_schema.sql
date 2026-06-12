-- Supabase Schema setup for AI-Native Mini CRM

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT DEFAULT 'marketer',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     TEXT UNIQUE,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    phone           TEXT,
    city            TEXT,
    tags            TEXT[] DEFAULT '{}',
    total_spent     NUMERIC(12,2) DEFAULT 0,
    order_count     INTEGER DEFAULT 0,
    last_order_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_customers_total_spent ON customers(total_spent);
CREATE INDEX idx_customers_last_order_at ON customers(last_order_at);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    external_id     TEXT UNIQUE,
    amount          NUMERIC(12,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'completed',
    channel         TEXT,
    items           JSONB DEFAULT '[]',
    ordered_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at);
CREATE INDEX idx_orders_amount ON orders(amount);

CREATE TABLE segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    filter_rules    JSONB NOT NULL,
    ai_prompt       TEXT,
    audience_size   INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    segment_id      UUID REFERENCES segments(id) ON DELETE SET NULL,
    channel         TEXT NOT NULL,
    message_template TEXT NOT NULL,
    ai_prompt       TEXT,
    status          TEXT NOT NULL DEFAULT 'draft',
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    audience_snapshot JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_segment_id ON campaigns(segment_id);

CREATE TABLE communication_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL,
    message_body    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued',
    idempotency_key TEXT UNIQUE NOT NULL,
    external_ref    TEXT,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    converted_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_commlog_campaign_id ON communication_logs(campaign_id);
CREATE INDEX idx_commlog_customer_id ON communication_logs(customer_id);
CREATE INDEX idx_commlog_status ON communication_logs(status);
CREATE UNIQUE INDEX idx_commlog_idempotency ON communication_logs(idempotency_key);

CREATE TABLE receipt_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_log_id UUID NOT NULL REFERENCES communication_logs(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB,
    received_at     TIMESTAMPTZ DEFAULT NOW(),
    is_duplicate    BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_receipt_events_log_id ON receipt_events(communication_log_id);
CREATE INDEX idx_receipt_events_type ON receipt_events(event_type);

CREATE VIEW campaign_funnel_stats AS
SELECT
    campaign_id,
    COUNT(*) FILTER (WHERE status != 'queued')          AS total_sent,
    COUNT(*) FILTER (WHERE status = 'delivered'
        OR delivered_at IS NOT NULL)                     AS total_delivered,
    COUNT(*) FILTER (WHERE status = 'failed')            AS total_failed,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL)        AS total_opened,
    COUNT(*) FILTER (WHERE read_at IS NOT NULL)          AS total_read,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)       AS total_clicked,
    COUNT(*) FILTER (WHERE converted_at IS NOT NULL)     AS total_converted,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)
        / NULLIF(COUNT(*) FILTER (WHERE status != 'queued'), 0), 2
    )                                                    AS delivery_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE opened_at IS NOT NULL)
        / NULLIF(COUNT(*) FILTER (WHERE delivered_at IS NOT NULL), 0), 2
    )                                                    AS open_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)
        / NULLIF(COUNT(*) FILTER (WHERE opened_at IS NOT NULL), 0), 2
    )                                                    AS ctr
FROM communication_logs
GROUP BY campaign_id;
