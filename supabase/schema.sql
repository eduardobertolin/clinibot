-- Clini-bot — Schema completo
-- Gerado em: 2026-03-12
-- Aplicar em banco limpo via Supabase SQL Editor
-- Este arquivo substitui todas as migrations individuais para setup inicial

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- GRANTS — permissões de acesso por role
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;


-- ============================================================
-- CLINICS
-- ============================================================
CREATE TABLE clinics (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name             TEXT        NOT NULL,
  phone            TEXT        NOT NULL,
  owner_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zapi_instance_id TEXT,
  zapi_token       TEXT,
  twilio_number    TEXT,
  active           BOOLEAN     NOT NULL DEFAULT TRUE
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_clinics" ON clinics
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "clinic_owner_all" ON clinics
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Indexes
CREATE INDEX idx_clinics_owner_id
  ON clinics(owner_id);

CREATE INDEX idx_clinics_zapi_instance
  ON clinics(zapi_instance_id)
  WHERE zapi_instance_id IS NOT NULL;


-- ============================================================
-- DOCTORS
-- ============================================================
-- Coluna "specialization" (não "specialty") — alinhada com types.ts e orchestrator.ts
CREATE TABLE doctors (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id        UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  specialization   TEXT,
  active           BOOLEAN     NOT NULL DEFAULT TRUE
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_doctors" ON doctors
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "doctors_via_clinic" ON doctors
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_doctors_clinic_active
  ON doctors(clinic_id, active);


-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE patients (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id  UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  notes      TEXT,
  UNIQUE (clinic_id, phone)
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_patients" ON patients
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "patients_via_clinic" ON patients
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );


-- ============================================================
-- APPOINTMENT TYPES
-- ============================================================
-- "price" em NUMERIC (não price_cents INTEGER) — alinhado com AppointmentType em types.ts
-- "insurance_allowed", "particular" e "max_per_day" incluídos desde o início (migrations 003/007)
CREATE TABLE appointment_types (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID    NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price            NUMERIC,
  insurance_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  particular       BOOLEAN NOT NULL DEFAULT TRUE,
  max_per_day      INTEGER
);

ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_appointment_types" ON appointment_types
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "appointment_types_via_clinic" ON appointment_types
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_appointment_types_clinic
  ON appointment_types(clinic_id);


-- ============================================================
-- INSURANCE PLANS
-- ============================================================
CREATE TABLE insurance_plans (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id  UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  code       TEXT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

ALTER TABLE insurance_plans ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_insurance_plans" ON insurance_plans
  FOR ALL TO service_role USING (TRUE);

-- Política de leitura e escrita consolidadas em uma única policy ALL
CREATE POLICY "insurance_plans_via_clinic" ON insurance_plans
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_insurance_plans_clinic
  ON insurance_plans(clinic_id);


-- ============================================================
-- APPOINTMENT TYPE INSURANCE  (junction)
-- ============================================================
CREATE TABLE appointment_type_insurance (
  appointment_type_id UUID NOT NULL REFERENCES appointment_types(id) ON DELETE CASCADE,
  insurance_plan_id   UUID NOT NULL REFERENCES insurance_plans(id)   ON DELETE CASCADE,
  PRIMARY KEY (appointment_type_id, insurance_plan_id)
);

ALTER TABLE appointment_type_insurance ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_appointment_type_insurance" ON appointment_type_insurance
  FOR ALL TO service_role USING (TRUE);

-- Política de leitura e escrita consolidadas em uma única policy ALL
CREATE POLICY "appointment_type_insurance_via_clinic" ON appointment_type_insurance
  FOR ALL TO authenticated
  USING (
    appointment_type_id IN (
      SELECT id FROM appointment_types
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    appointment_type_id IN (
      SELECT id FROM appointment_types
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  );


-- ============================================================
-- SCHEDULES
-- ============================================================
-- clinic_id e doctor_id são ambos nullable:
--   • schedule de clínica inteira: clinic_id NOT NULL, doctor_id NULL
--   • schedule de médico específico: doctor_id NOT NULL, clinic_id pode ser NULL ou NOT NULL
CREATE TABLE schedules (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID     REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id   UUID     REFERENCES doctors(id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME     NOT NULL,
  end_time    TIME     NOT NULL,
  break_start TIME,
  break_end   TIME
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_schedules" ON schedules
  FOR ALL TO service_role USING (TRUE);

-- Policy final (migration 009): cobre schedules de clínica E de médico
CREATE POLICY "schedules_via_clinic" ON schedules
  FOR ALL TO authenticated
  USING (
    (doctor_id IS NOT NULL AND doctor_id IN (
      SELECT id FROM doctors WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    ))
    OR
    (clinic_id IS NOT NULL AND clinic_id IN (
      SELECT id FROM clinics WHERE owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    (doctor_id IS NOT NULL AND doctor_id IN (
      SELECT id FROM doctors WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    ))
    OR
    (clinic_id IS NOT NULL AND clinic_id IN (
      SELECT id FROM clinics WHERE owner_id = auth.uid()
    ))
  );

-- Indexes
CREATE INDEX idx_schedules_doctor_id
  ON schedules(doctor_id);

CREATE INDEX idx_schedules_clinic_id
  ON schedules(clinic_id);


-- ============================================================
-- BLOCKED DATES
-- ============================================================
CREATE TABLE blocked_dates (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  reason    TEXT,
  UNIQUE (doctor_id, date)
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_blocked_dates" ON blocked_dates
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "blocked_dates_via_clinic" ON blocked_dates
  FOR ALL TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    )
  );

-- Indexes
CREATE INDEX idx_blocked_dates_doctor_date
  ON blocked_dates(doctor_id, date);


-- ============================================================
-- APPOINTMENTS
-- ============================================================
-- Colunas refletem o código atual (migrations 002 + 004):
--   • scheduled_at removido; colunas start_datetime / end_datetime
--   • patient_name e patient_phone como NOT NULL DEFAULT ''
--   • doctor_id, patient_id, appointment_type_id, insurance_plan_id nullable
--   • status CHECK completo: inclui 'rescheduled' (migration 002)
--   • service_id / service_name removidos (tabela services obsoleta)
CREATE TABLE appointments (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id           UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id           UUID        REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id          UUID        REFERENCES patients(id) ON DELETE SET NULL,
  patient_name        TEXT        NOT NULL DEFAULT '',
  patient_phone       TEXT        NOT NULL DEFAULT '',
  appointment_type_id UUID        REFERENCES appointment_types(id) ON DELETE SET NULL,
  start_datetime      TIMESTAMPTZ NOT NULL,
  end_datetime        TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                          'scheduled',
                          'confirmed',
                          'cancelled',
                          'completed',
                          'no_show',
                          'rescheduled'
                        )),
  source              TEXT        NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('whatsapp', 'phone', 'manual')),
  insurance_plan_id   UUID        REFERENCES insurance_plans(id) ON DELETE SET NULL,
  notes               TEXT
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_appointments" ON appointments
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "appointments_via_clinic" ON appointments
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_appointments_clinic_start
  ON appointments(clinic_id, start_datetime);

CREATE INDEX idx_appointments_clinic_status
  ON appointments(clinic_id, status);

CREATE INDEX idx_appointments_doctor_type_date
  ON appointments(doctor_id, appointment_type_id, start_datetime)
  WHERE doctor_id IS NOT NULL;


-- ============================================================
-- CONVERSATIONS
-- ============================================================
-- channel CHECK inclui 'voice' (adicionado na migration 002)
-- patient_id nullable (adicionado para eventual link futuro com patients)
CREATE TABLE conversations (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id     UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    UUID        REFERENCES patients(id) ON DELETE SET NULL,
  patient_name  TEXT,
  patient_phone TEXT        NOT NULL,
  channel       TEXT        NOT NULL
                  CHECK (channel IN ('whatsapp', 'phone', 'voice')),
  messages      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'resolved', 'escalated'))
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_conversations" ON conversations
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "conversations_via_clinic" ON conversations
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_conversations_clinic
  ON conversations(clinic_id, updated_at DESC);


-- ============================================================
-- ESCALATION LOGS
-- ============================================================
-- Substitui a tabela "alerts" da migration 001.
-- clinic_id nullable para compatibilidade com registros antigos sem clínica.
-- status CHECK completo: inclui 'attempted_transfer' e 'pending_callback' (migration 002).
CREATE TABLE escalation_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id       UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  conversation_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  type            TEXT        NOT NULL
                    CHECK (type IN ('emergency', 'unhandled', 'error')),
  message         TEXT,
  patient_phone   TEXT,
  status          TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN (
                      'open',
                      'acknowledged',
                      'resolved',
                      'attempted_transfer',
                      'pending_callback'
                    ))
);

ALTER TABLE escalation_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_escalation_logs" ON escalation_logs
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "escalation_logs_via_clinic" ON escalation_logs
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_escalation_logs_clinic_status
  ON escalation_logs(clinic_id, status)
  WHERE clinic_id IS NOT NULL;

CREATE INDEX idx_escalation_logs_conversation
  ON escalation_logs(conversation_id)
  WHERE conversation_id IS NOT NULL;


-- ============================================================
-- DOCTOR TYPE LIMITS
-- ============================================================
CREATE TABLE doctor_type_limits (
  doctor_id           UUID    NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_type_id UUID    NOT NULL REFERENCES appointment_types(id) ON DELETE CASCADE,
  max_per_day         INTEGER NOT NULL DEFAULT 1,
  allow_consecutive   BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (doctor_id, appointment_type_id)
);

ALTER TABLE doctor_type_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_doctor_type_limits" ON doctor_type_limits
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "doctor_type_limits_via_clinic" ON doctor_type_limits
  FOR ALL TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  );


-- ============================================================
-- DOCTOR INSURANCE LIMITS
-- ============================================================
CREATE TABLE doctor_insurance_limits (
  doctor_id         UUID    NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  insurance_plan_id UUID    NOT NULL REFERENCES insurance_plans(id) ON DELETE CASCADE,
  max_per_day       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (doctor_id, insurance_plan_id)
);

ALTER TABLE doctor_insurance_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_bypass_doctor_insurance_limits" ON doctor_insurance_limits
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "doctor_insurance_limits_via_clinic" ON doctor_insurance_limits
  FOR ALL TO authenticated
  USING (
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  );


-- ============================================================
-- Tabelas criadas neste schema (em ordem de dependência):
--   1.  clinics
--   2.  doctors
--   3.  patients
--   4.  appointment_types
--   5.  insurance_plans
--   6.  appointment_type_insurance
--   7.  schedules
--   8.  blocked_dates
--   9.  appointments
--   10. conversations
--   11. escalation_logs
--   12. doctor_type_limits
--   13. doctor_insurance_limits
--
-- Tabelas das migrations originais NÃO incluídas (obsoletas):
--   • services        → substituída por appointment_types
--   • working_hours   → substituída por schedules
--   • alerts          → substituída por escalation_logs
-- ============================================================
