-- SMS module rebuild, Phase 1 (docs/tasks.md's "SMS module PRD alignment" —
-- classcore_sms_module_prd.pdf v1.3 §3/§4). Replaces the old hardcoded
-- 7-key `studio_settings.settings.sms_templates` jsonb blob with a real
-- category → template model the studio can extend freely, matching the
-- PRD's "user creates as many categories/templates as needed" principle.
--
-- Also backfills `sms_logs` as a tracked migration — that table already
-- exists in production (created via a manually-run SQL snippet during an
-- earlier security fix, never committed as a migration file here) — the
-- CREATE is IF NOT EXISTS so this is safe to run against an environment
-- that already has it, and the ALTERs add the new columns Phase 1 needs
-- for per-template log grouping (PRD §9).

BEGIN;

CREATE TABLE IF NOT EXISTS public.sms_categories (
    id text PRIMARY KEY,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    icon text,
    -- Set for a category auto-created by an integrated module (PRD §5) —
    -- 'attendance' | 'subscriptions'. NULL for a fully user-created
    -- category. Never used to block deletion — PRD §3 is explicit that
    -- even a module-linked category can be permanently deleted by the
    -- studio if they don't want its SMS at all.
    module_key text,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_categories_org_idx ON public.sms_categories (org_id);

CREATE TABLE IF NOT EXISTS public.sms_templates (
    id text PRIMARY KEY,
    org_id uuid NOT NULL,
    category_id text NOT NULL REFERENCES public.sms_categories(id) ON DELETE CASCADE,
    name text NOT NULL,
    text_ka text NOT NULL DEFAULT '',
    text_ru text NOT NULL DEFAULT '',
    text_en text NOT NULL DEFAULT '',
    -- 'manual' (admin/staff triggers it directly — Personal/Holiday-style
    -- sends) or 'event' (fires from a system signal — check-in, absence,
    -- payment due, birthday). No date-based scheduling yet (PRD §4's
    -- "თარიღზე დაფუძნებული" option) — this app has no cron/scheduler
    -- anywhere (confirmed during the Subscriptions PRD pass), so a
    -- schedule field here would be dead data with nothing to act on it;
    -- add it when a real scheduler exists.
    trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'event')),
    -- Only meaningful when trigger_type = 'event': 'payment_due' |
    -- 'subscription_expiring' | 'birthday' | 'individual_booking_pending'.
    event_key text,
    recipient_scope text NOT NULL DEFAULT 'all' CHECK (recipient_scope IN ('all', 'group', 'branch', 'person')),
    -- The specific group/branch/student id when recipient_scope isn't
    -- 'all' — which column depends on recipient_scope, not a separate FK
    -- per scope (PRD §6 treats these as mutually exclusive, never combined).
    recipient_target_id text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active')),
    frequency_limit_count integer,
    frequency_limit_days integer,
    -- True for a template created via "აირჩიე ავტომატური შაბლონები"
    -- (PRD §5) — purely informational (e.g. for a "suggested" badge in the
    -- UI); an auto-generated template is fully editable/deletable like any
    -- other the moment it exists (PRD §5: "'ავტომატური' ნიშნავს მხოლოდ
    -- მზა საწყის წერტილს, არა დაბლოკილ შინაარსს").
    is_auto_generated boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_templates_org_idx ON public.sms_templates (org_id);
CREATE INDEX IF NOT EXISTS sms_templates_category_idx ON public.sms_templates (category_id);

CREATE TABLE IF NOT EXISTS public.sms_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    actor_id text,
    actor_name text,
    action text NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('category', 'template')),
    target_id text NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_audit_log_org_idx ON public.sms_audit_log (org_id);

-- Backfill: create if this environment never got the manually-run SQL
-- from the earlier security fix; columns match exactly what
-- /api/sms/send/route.ts and /api/sms/logs/route.ts already read/write.
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid,
    student_name text,
    to_number text,
    text text,
    status text,
    error text,
    timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS template_id text REFERENCES public.sms_templates(id) ON DELETE SET NULL;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS recipient_student_id text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS delivery_status text CHECK (delivery_status IN ('sent', 'delivered', 'failed'));
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS sms_logs_org_idx ON public.sms_logs (org_id);
CREATE INDEX IF NOT EXISTS sms_logs_template_idx ON public.sms_logs (template_id);

ALTER TABLE public.sms_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Same auth.uid()-based org-membership check as every other RLS-backed
-- table in this migration series. Staff-token (Administrator/Teacher, no
-- auth.uid()) reach these tables through the dual-auth Server Actions
-- (src/lib/server-actions-auth.ts) with a service-role client instead.
DROP POLICY IF EXISTS "Org members can view sms categories" ON public.sms_categories;
DROP POLICY IF EXISTS "Org members can insert sms categories" ON public.sms_categories;
DROP POLICY IF EXISTS "Org members can update sms categories" ON public.sms_categories;
DROP POLICY IF EXISTS "Org members can delete sms categories" ON public.sms_categories;

CREATE POLICY "Org members can view sms categories" ON public.sms_categories FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can insert sms categories" ON public.sms_categories FOR INSERT TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can update sms categories" ON public.sms_categories FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can delete sms categories" ON public.sms_categories FOR DELETE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can view sms templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Org members can insert sms templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Org members can update sms templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Org members can delete sms templates" ON public.sms_templates;

CREATE POLICY "Org members can view sms templates" ON public.sms_templates FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can insert sms templates" ON public.sms_templates FOR INSERT TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can update sms templates" ON public.sms_templates FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can delete sms templates" ON public.sms_templates FOR DELETE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can view sms audit log" ON public.sms_audit_log;
DROP POLICY IF EXISTS "Org members can insert sms audit log" ON public.sms_audit_log;

CREATE POLICY "Org members can view sms audit log" ON public.sms_audit_log FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can insert sms audit log" ON public.sms_audit_log FOR INSERT TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can view sms logs" ON public.sms_logs;
CREATE POLICY "Org members can view sms logs" ON public.sms_logs FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
