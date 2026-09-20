-- The new daily retention cron (src/app/api/cron/sms-log-retention) runs
-- `DELETE FROM sms_logs WHERE org_id = ? AND timestamp < ?` per org. The
-- existing sms_logs_org_idx (org_id only) can seek to an org's rows but
-- then has to scan all of them to evaluate the timestamp filter — a
-- composite index lets it seek directly to the expired rows instead,
-- which matters once an org's SMS history spans years.
CREATE INDEX IF NOT EXISTS sms_logs_org_timestamp_idx ON public.sms_logs (org_id, timestamp);

-- The composite index above covers every query the old org_id-only index
-- did (leftmost-prefix rule), making it pure redundant write overhead on
-- every sms_logs insert/delete (including this same cron) with no
-- remaining query benefit.
DROP INDEX IF EXISTS public.sms_logs_org_idx;
