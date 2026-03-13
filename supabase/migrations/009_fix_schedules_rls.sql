-- =============================================================
-- Migration 009: Corrigir RLS da tabela schedules
--
-- Problema: A policy "schedules_via_clinic" criada em 002 filtra
-- apenas por doctor_id, o que quebra para schedules de clínica onde
-- doctor_id IS NULL. A migration 007 criou a policy correta, mas só
-- tem efeito se a tabela for criada do zero pelo IF NOT EXISTS.
-- Se o banco já tinha a tabela (criada manualmente via dashboard), a
-- policy antiga continua vigente e precisa ser substituída aqui.
--
-- Esta migration é idempotente: o DROP IF EXISTS garante que não
-- falha se a policy já foi corrigida pelo 007.
-- =============================================================

-- Remover a policy antiga (filtra apenas doctor_id — quebra para clinic schedules)
DROP POLICY IF EXISTS "schedules_via_clinic" ON schedules;

-- Nova policy para usuário autenticado: cobre AMBOS os casos
--   • schedules vinculados a um médico específico (doctor_id NOT NULL)
--   • schedules vinculados diretamente à clínica (clinic_id NOT NULL, doctor_id NULL)
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

-- Garantir que o bypass de service_role também está presente
DROP POLICY IF EXISTS "service_role_bypass_schedules" ON schedules;
CREATE POLICY "service_role_bypass_schedules" ON schedules
  FOR ALL TO service_role USING (TRUE);
