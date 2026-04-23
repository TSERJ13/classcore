
-- 🛰️ MASTER SYNC SCHEMA v3.1 (EVERYTHING)
-- This script adds the remaining tables for full synchronization.

-- 1. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id),
    student_id TEXT,
    plan_id TEXT,
    status TEXT,
    sessions_total INTEGER,
    sessions_used INTEGER,
    price DECIMAL,
    currency TEXT,
    branch_id TEXT,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ATTENDANCE (CHECKINS)
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id),
    student_id TEXT,
    group_id TEXT,
    branch_id TEXT,
    teacher_id TEXT,
    date DATE,
    type TEXT, -- 'regular', 'one-time', etc.
    status TEXT, -- 'present', 'absent'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SALES / INCOME
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id),
    type TEXT, -- 'subscription', 'product', etc.
    student_id TEXT,
    amount DECIMAL,
    currency TEXT,
    method TEXT,
    branch_id TEXT,
    description TEXT,
    date TIMESTAMPTZ DEFAULT now()
);

-- 4. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id),
    category TEXT,
    amount DECIMAL,
    currency TEXT,
    branch_id TEXT,
    description TEXT,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TRASH (DELETED ITEMS)
CREATE TABLE IF NOT EXISTS public.trash (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.studios(org_id),
    item_type TEXT,
    item_data JSONB,
    branch_id TEXT,
    deleted_at TIMESTAMPTZ DEFAULT now()
);

-- 🔓 DISABLE RLS ON ALL NEW TABLES
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash DISABLE ROW LEVEL SECURITY;

-- 🎁 GRANT UNIVERSAL ACCESS
GRANT ALL ON public.subscriptions TO anon, authenticated;
GRANT ALL ON public.attendance TO anon, authenticated;
GRANT ALL ON public.sales TO anon, authenticated;
GRANT ALL ON public.expenses TO anon, authenticated;
GRANT ALL ON public.trash TO anon, authenticated;
