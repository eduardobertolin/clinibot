-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLINICS
-- ============================================================
CREATE TABLE clinics (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zapi_instance_id TEXT,
  zapi_token       TEXT,
  twilio_number    TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_owner_all" ON clinics
  FOR ALL USING (auth.uid() = owner_id);

-- ============================================================
-- DOCTORS
-- ============================================================
CREATE TABLE doctors (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  specialty  TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors_via_clinic" ON doctors
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_cents      INTEGER,
  active           BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_via_clinic" ON services
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- ============================================================
-- WORKING HOURS
-- ============================================================
CREATE TABLE working_hours (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hours_via_clinic" ON working_hours
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE patients (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  notes      TEXT,
  UNIQUE (clinic_id, phone)
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_via_clinic" ON patients
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id      UUID REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id     UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name   TEXT NOT NULL,
  patient_phone  TEXT NOT NULL,
  service_id     UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name   TEXT NOT NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','confirmed','cancelled','completed','no_show')),
  notes          TEXT,
  source         TEXT NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('whatsapp','phone','manual'))
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_via_clinic" ON appointments
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_appointments_clinic_date ON appointments(clinic_id, scheduled_at);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_phone TEXT NOT NULL,
  patient_name  TEXT,
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp','phone')),
  messages      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','resolved','escalated'))
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_via_clinic" ON conversations
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_conversations_clinic ON conversations(clinic_id, updated_at DESC);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('emergency','unhandled','error')),
  message         TEXT NOT NULL,
  patient_phone   TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','acknowledged','resolved'))
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_via_clinic" ON alerts
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_alerts_clinic_status ON alerts(clinic_id, status, created_at DESC);

-- ============================================================
-- Webhook: service role bypass for all tables
-- (used by API routes with service role key)
-- ============================================================
CREATE POLICY "service_role_bypass_clinics" ON clinics FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_doctors" ON doctors FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_services" ON services FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_hours" ON working_hours FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_patients" ON patients FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_appointments" ON appointments FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_conversations" ON conversations FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_bypass_alerts" ON alerts FOR ALL TO service_role USING (TRUE);
