-- ============================================================
-- StudioFlow CRM - Full Database Schema
-- Multi-tenant architecture with Row-Level Security (RLS)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE org_type AS ENUM ('dance', 'sports', 'yoga', 'fitness');
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'student');
CREATE TYPE attendance_method AS ENUM ('manual', 'qr', 'telegram');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'paused');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  type        org_type NOT NULL DEFAULT 'fitness',
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role                    user_role NOT NULL DEFAULT 'student',
  full_name               TEXT NOT NULL,
  phone                   TEXT,
  avatar_url              TEXT,
  telegram_id             BIGINT,               -- Telegram user ID for login/notifications
  telegram_username       TEXT,
  profile_data            JSONB DEFAULT '{}',   -- Additional niche-specific flexible data

  -- Sports niche: Medical certificate tracking
  medical_cert_url        TEXT,
  medical_cert_expires_at DATE,

  -- Dance niche: Partner & choreography
  partner_id              UUID REFERENCES profiles(id),
  dance_style             TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Index for fast org-based queries
CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_telegram_id ON profiles(telegram_id);

-- ============================================================
-- GROUPS / CLASSES
-- ============================================================

CREATE TABLE groups_classes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_id              UUID REFERENCES profiles(id),
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'group', -- 'group' | 'private' | 'trial'
  schedule              JSONB DEFAULT '[]',
  -- Example schedule entry: {"day": "monday", "start": "10:00", "end": "11:30", "location": "Hall A"}
  max_capacity          INT NOT NULL DEFAULT 20,
  current_count         INT NOT NULL DEFAULT 0,

  -- Yoga / Fitness specific
  difficulty_level      TEXT, -- 'beginner' | 'intermediate' | 'advanced'

  -- Dance specific
  choreography_name     TEXT,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE groups_classes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_groups_classes_org_id ON groups_classes(org_id);
CREATE INDEX idx_groups_classes_coach_id ON groups_classes(coach_id);

-- Junction table: students enrolled in classes
CREATE TABLE class_enrollments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id   UUID NOT NULL REFERENCES groups_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SUBSCRIPTIONS / PLANS
-- ============================================================

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_name       TEXT NOT NULL,
  price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'GEL',
  starts_at       DATE NOT NULL,
  expires_at      DATE NOT NULL,
  sessions_total  INT,         -- NULL = unlimited
  sessions_used   INT NOT NULL DEFAULT 0,
  status          subscription_status NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_student_id ON subscriptions(student_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- ============================================================
-- ATTENDANCE LOGS
-- ============================================================

CREATE TABLE attendance_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  class_id        UUID REFERENCES groups_classes(id) ON DELETE SET NULL,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_by   UUID REFERENCES profiles(id),
  method          attendance_method NOT NULL DEFAULT 'manual',
  notes           TEXT
);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attendance_logs_org_id ON attendance_logs(org_id);
CREATE INDEX idx_attendance_logs_student_id ON attendance_logs(student_id);
CREATE INDEX idx_attendance_logs_class_id ON attendance_logs(class_id);
CREATE INDEX idx_attendance_logs_checked_in_at ON attendance_logs(checked_in_at);

-- ============================================================
-- AUTOMATCH SUBSCRIPTION ON CHECK-IN (trigger)
-- Decrement sessions_used on each attendance log
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_session_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE subscriptions
  SET sessions_used = sessions_used + 1,
      status = CASE
        WHEN sessions_used + 1 >= sessions_total THEN 'expired'::subscription_status
        ELSE status
      END
  WHERE student_id = NEW.student_id
    AND org_id = NEW.org_id
    AND status = 'active'
    AND (sessions_total IS NULL OR sessions_used < sessions_total)
    AND starts_at <= CURRENT_DATE
    AND expires_at >= CURRENT_DATE
  ;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_attendance_log_insert
  AFTER INSERT ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION decrement_session_on_attendance();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Helper function: get caller's org_id from profiles
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: is caller admin or coach
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'coach') FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Organizations: users can only see their own org
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id = get_current_org_id());

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (
    id = get_current_org_id() AND is_staff()
  );

-- Profiles: same org isolation
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (
    org_id = get_current_org_id() AND is_staff()
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    org_id = get_current_org_id() AND (is_staff() OR id = auth.uid())
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (
    org_id = get_current_org_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Groups/Classes policies
CREATE POLICY "classes_select" ON groups_classes
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "classes_insert" ON groups_classes
  FOR INSERT WITH CHECK (org_id = get_current_org_id() AND is_staff());

CREATE POLICY "classes_update" ON groups_classes
  FOR UPDATE USING (org_id = get_current_org_id() AND is_staff());

CREATE POLICY "classes_delete" ON groups_classes
  FOR DELETE USING (
    org_id = get_current_org_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Enrollments
CREATE POLICY "enrollments_select" ON class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups_classes
      WHERE id = class_enrollments.class_id
        AND org_id = get_current_org_id()
    )
  );

CREATE POLICY "enrollments_insert" ON class_enrollments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups_classes
      WHERE id = class_enrollments.class_id
        AND org_id = get_current_org_id()
    ) AND is_staff()
  );

CREATE POLICY "enrollments_delete" ON class_enrollments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups_classes
      WHERE id = class_enrollments.class_id
        AND org_id = get_current_org_id()
    ) AND is_staff()
  );

-- Subscriptions
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT WITH CHECK (org_id = get_current_org_id() AND is_staff());

CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE USING (org_id = get_current_org_id() AND is_staff());

-- Attendance logs
CREATE POLICY "attendance_select" ON attendance_logs
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "attendance_insert" ON attendance_logs
  FOR INSERT WITH CHECK (org_id = get_current_org_id() AND is_staff());

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_groups_classes
  BEFORE UPDATE ON groups_classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: Demo org for development
-- ============================================================

INSERT INTO organizations (id, name, slug, type, settings) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Demo Dance Studio',
  'demo-dance',
  'dance',
  '{"currency": "GEL", "timezone": "Asia/Tbilisi", "language": "ka"}'
);
