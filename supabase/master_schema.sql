-- ClassCore Master Normalized Schema
-- Author: Antigravity AI
-- Date: 2026-04-19

BEGIN;

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STUDIOS / ORGANIZATIONS
-- Stores the high-level configuration for each tenant.
CREATE TABLE IF NOT EXISTS public.studios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID UNIQUE NOT NULL,
    studio_slug TEXT UNIQUE NOT NULL,
    studio_name TEXT NOT NULL,
    logo_url TEXT,
    currency TEXT DEFAULT 'GEL',
    language TEXT DEFAULT 'ka',
    timezone TEXT DEFAULT 'Asia/Tbilisi',
    theme_key TEXT DEFAULT 'indigo',
    is_wizard_completed BOOLEAN DEFAULT false,
    plan TEXT DEFAULT 'trial',
    suspended BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    owner_info JSONB, -- { first_name, last_name, email, phone }
    settings JSONB,   -- { notifications, security, sms_templates, etc }
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BRANCHES
-- Each studio can have multiple physical locations.
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY, -- Using TEXT to match frontend-generated IDs
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. STAFF / TEACHERS
-- Consolidated staff management.
CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    password TEXT, -- For teacher personal login
    role TEXT NOT NULL, -- 'owner', 'manager', 'teacher', etc.
    status TEXT DEFAULT 'active',
    photo_url TEXT,
    permissions JSONB,
    specialty TEXT[], -- For teachers
    salary_rates JSONB, -- { hourly, monthly, percentage }
    assigned_group_ids TEXT[], 
    allowed_branch_ids TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. HALLS / ROOMS
CREATE TABLE IF NOT EXISTS public.halls (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    capacity INTEGER,
    sq_meters DECIMAL,
    color TEXT,
    photo_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. GROUPS
CREATE TABLE IF NOT EXISTS public.groups (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    coach_name TEXT,
    schedule_desc TEXT,
    capacity INTEGER,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    gender TEXT,
    status TEXT DEFAULT 'active',
    balance DECIMAL DEFAULT 0,
    notes TEXT,
    enrolled_group_ids TEXT[],
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SUBSCRIPTION PLANS (Tariffs)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT, -- 'group', 'individual', 'rental'
    period TEXT, -- 'sessions', 'monthly', 'unlimited'
    session_count INTEGER,
    validity_days INTEGER,
    price DECIMAL NOT NULL,
    group_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. STUDENT SUBSCRIPTIONS (Issued)
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    sessions_total INTEGER,
    sessions_used INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status TEXT, -- 'active', 'expired', 'paused'
    paid BOOLEAN DEFAULT false,
    amount_paid DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    hall_id TEXT REFERENCES public.halls(id) ON DELETE SET NULL,
    teacher_id TEXT REFERENCES public.staff(id) ON DELETE SET NULL,
    group_id TEXT REFERENCES public.groups(id) ON DELETE SET NULL,
    student_id TEXT, -- For individual sessions
    title TEXT NOT NULL,
    type TEXT, -- 'group_class', 'individual', 'rental', 'other'
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    recurring TEXT DEFAULT 'none',
    color TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. ATTENDANCE RECORDS
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES public.groups(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL, -- 'present', 'absent'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. HALL RENTALS
CREATE TABLE IF NOT EXISTS public.hall_rentals (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    hall_id TEXT REFERENCES public.halls(id) ON DELETE CASCADE,
    renter_name TEXT NOT NULL,
    renter_phone TEXT,
    renter_email TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    total_price DECIMAL,
    deposit DECIMAL,
    payment_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. INVENTORY & SHOP
CREATE TABLE IF NOT EXISTS public.inventory_products (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    price DECIMAL NOT NULL,
    cost_price DECIMAL,
    quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    total_amount DECIMAL NOT NULL,
    payment_method TEXT,
    items JSONB, -- array of { product_id, quantity, price }
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. TRASH (Recovery Bin)
CREATE TABLE IF NOT EXISTS public.trash (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_data JSONB NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT now(),
    deleted_by TEXT
);

-- 14. AUDIT LOGS (History)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.studios(org_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. ROW LEVEL SECURITY (RLS)
-- Ensuring zero cross-org leakage

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN (
        SELECT DISTINCT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'org_id'
        AND table_name NOT IN ('studios')
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Org isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Org isolation" ON public.%I FOR ALL TO authenticated USING (org_id::text IN (SELECT org_id::text FROM public.profiles WHERE id = auth.uid()))', t);
    END LOOP;
END $$;

-- Special policy for studios (lookup by slug allowed for auth)
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public slug lookup" ON public.studios;
CREATE POLICY "Public slug lookup" ON public.studios FOR SELECT TO authenticated USING (true);

COMMIT;
