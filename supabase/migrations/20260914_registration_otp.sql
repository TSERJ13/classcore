-- Registration Flow PRD (v1.1) — email/SMS verification codes used during the
-- 5-step signup wizard, before a Supabase auth user exists yet. Codes are
-- generated and checked server-side only (service role); RLS is enabled with
-- no policies so anon/authenticated clients have zero direct access — the
-- two /api/auth/otp/* routes are the only way in or out.

BEGIN;

CREATE TABLE IF NOT EXISTS public.registration_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('email', 'sms')),
    contact text NOT NULL,
    code_hash text NOT NULL,
    code_salt text NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    verified_at timestamptz,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_otps_session_channel_idx
    ON public.registration_otps (session_token, channel, created_at DESC);

ALTER TABLE public.registration_otps ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service-role client (used inside
-- /api/auth/otp/send and /api/auth/otp/verify) can read or write this table.

COMMIT;
