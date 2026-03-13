-- =============================================================
-- Migration 006: Tabela blocked_dates
--
-- O arquivo src/lib/scheduling/availability.ts consulta a tabela
-- blocked_dates mas ela nunca foi criada em nenhuma migration.
-- Esta migration cria a tabela de forma idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS blocked_dates (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date      DATE        NOT NULL,
  reason    TEXT,
  UNIQUE (doctor_id, date)
);

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Webhook routes usam a service_role key: acesso irrestrito
DROP POLICY IF EXISTS "service_role_bypass_blocked_dates" ON blocked_dates;
CREATE POLICY "service_role_bypass_blocked_dates" ON blocked_dates
  FOR ALL TO service_role USING (TRUE);

-- Clinic owner acessa via: blocked_dates → doctors → clinics → owner_id
DROP POLICY IF EXISTS "blocked_dates_via_clinic" ON blocked_dates;
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

-- -------------------------------------------------------------
-- Índice de suporte (consulta filtra por doctor_id + date)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_blocked_dates_doctor_date
  ON blocked_dates(doctor_id, date);
