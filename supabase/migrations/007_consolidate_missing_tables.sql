-- =============================================================
-- Migration 007: Consolidação de tabelas criadas manualmente
--
-- As tabelas appointment_types, schedules e escalation_logs são
-- referenciadas em todo o código e pelas migrations 002–005, mas
-- nunca foram criadas via migration (provavelmente criadas via
-- Supabase Dashboard).  Este arquivo usa CREATE TABLE IF NOT EXISTS
-- para ser idempotente: não falha se as tabelas já existirem.
--
-- INCONSISTÊNCIAS DOCUMENTADAS
-- ------------------------------------------------------------
-- 1. doctors.specialty (001) vs Doctor.specialization (types.ts)
--    O schema SQL usa "specialty" mas o TypeScript lê "specialization".
--    Esta migration NÃO altera a coluna existente para não quebrar
--    dados em produção; corrija com um ALTER TABLE separado após
--    confirmar que nenhuma query usa o nome antigo.
--
-- 2. schedules — a policy do 002 filtra apenas por doctor_id, o que
--    quebra para linhas onde doctor_id IS NULL (schedules de clínica).
--    Esta migration cria uma policy corrigida que cobre ambos os casos.
--
-- 3. appointment_types.price — o código TypeScript (types.ts) usa
--    "price NUMERIC" (não "price_cents INTEGER" como em services).
--    Esta migration cria a coluna como NUMERIC para alinhar com
--    o tipo AppointmentType da aplicação.
-- =============================================================


-- =============================================================
-- 1. APPOINTMENT TYPES
-- =============================================================
CREATE TABLE IF NOT EXISTS appointment_types (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID    NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  -- Coluna "price" em NUMERIC conforme AppointmentType em types.ts.
  -- Nota: services usa price_cents INTEGER; appointment_types usa price NUMERIC.
  price            NUMERIC,
  insurance_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  particular       BOOLEAN NOT NULL DEFAULT TRUE,
  max_per_day      INTEGER
);

ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_appointment_types" ON appointment_types;
CREATE POLICY "service_role_bypass_appointment_types" ON appointment_types
  FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "appointment_types_via_clinic" ON appointment_types;
CREATE POLICY "appointment_types_via_clinic" ON appointment_types
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Índice (referenciado no 005)
CREATE INDEX IF NOT EXISTS idx_appointment_types_clinic
  ON appointment_types(clinic_id);


-- =============================================================
-- 2. SCHEDULES
-- =============================================================
-- clinic_id e doctor_id são nullable: um schedule pode ser da
-- clínica inteira (sem médico específico) ou de um médico específico.
CREATE TABLE IF NOT EXISTS schedules (
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

DROP POLICY IF EXISTS "service_role_bypass_schedules" ON schedules;
CREATE POLICY "service_role_bypass_schedules" ON schedules
  FOR ALL TO service_role USING (TRUE);

-- A policy do 002 só cobrialinhas com doctor_id NOT NULL.
-- Esta versão cobre ambos: schedule de clínica (clinic_id) e de médico (doctor_id).
DROP POLICY IF EXISTS "schedules_via_clinic" ON schedules;
CREATE POLICY "schedules_via_clinic" ON schedules
  FOR ALL TO authenticated
  USING (
    -- Schedule vinculado diretamente à clínica
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    OR
    -- Schedule vinculado a médico (join via clinic)
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    OR
    doctor_id IN (
      SELECT id FROM doctors
      WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    )
  );

-- Índices (referenciados no 005)
CREATE INDEX IF NOT EXISTS idx_schedules_doctor_id
  ON schedules(doctor_id);

CREATE INDEX IF NOT EXISTS idx_schedules_clinic_id
  ON schedules(clinic_id);


-- =============================================================
-- 3. ESCALATION LOGS
-- =============================================================
-- O status CHECK inclui todos os valores usados pelo código e
-- reconhecidos pela migration 002 (que fez ALTER na tabela existente).
CREATE TABLE IF NOT EXISTS escalation_logs (
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

DROP POLICY IF EXISTS "service_role_bypass_escalation_logs" ON escalation_logs;
CREATE POLICY "service_role_bypass_escalation_logs" ON escalation_logs
  FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "escalation_logs_via_clinic" ON escalation_logs;
CREATE POLICY "escalation_logs_via_clinic" ON escalation_logs
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );

-- Índices (referenciados no 005)
CREATE INDEX IF NOT EXISTS idx_escalation_logs_clinic_status
  ON escalation_logs(clinic_id, status)
  WHERE clinic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escalation_logs_conversation
  ON escalation_logs(conversation_id)
  WHERE conversation_id IS NOT NULL;
