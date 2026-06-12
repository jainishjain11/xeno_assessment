"""campaign_funnel_stats

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-13 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute('''
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
    ''')

def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS campaign_funnel_stats;")
