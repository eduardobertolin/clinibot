-- =============================================================
-- Migration 005: Performance indexes + escalation_logs backfill
-- Run in Supabase SQL Editor
-- =============================================================

-- -------------------------------------------------------------
-- clinics
-- -------------------------------------------------------------
-- Every dashboard page and the middleware query by owner_id
CREATE INDEX IF NOT EXISTS idx_clinics_owner_id
  ON clinics(owner_id);

-- Webhook handler looks up clinic by zapi_instance_id on every message
CREATE INDEX IF NOT EXISTS idx_clinics_zapi_instance
  ON clinics(zapi_instance_id)
  WHERE zapi_instance_id IS NOT NULL;

-- -------------------------------------------------------------
-- doctors
-- -------------------------------------------------------------
-- Most queries filter by clinic_id + active
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_active
  ON doctors(clinic_id, active);

-- -------------------------------------------------------------
-- schedules
-- -------------------------------------------------------------
-- Availability + config pages filter by doctor_id
CREATE INDEX IF NOT EXISTS idx_schedules_doctor_id
  ON schedules(doctor_id);

-- Config page also queries by clinic_id (for clinic-level schedules)
CREATE INDEX IF NOT EXISTS idx_schedules_clinic_id
  ON schedules(clinic_id);

-- -------------------------------------------------------------
-- appointments
-- -------------------------------------------------------------
-- Dashboard: filter by clinic_id + date range (the old index used scheduled_at
-- which no longer exists; this one uses the real column start_datetime)
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start
  ON appointments(clinic_id, start_datetime);

-- Availability check: filter by clinic_id + status
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_status
  ON appointments(clinic_id, status);

-- bookAppointment limit checks: filter by doctor_id + appointment_type_id + date
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_type_date
  ON appointments(doctor_id, appointment_type_id, start_datetime)
  WHERE doctor_id IS NOT NULL;

-- -------------------------------------------------------------
-- appointment_types
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_appointment_types_clinic
  ON appointment_types(clinic_id);

-- -------------------------------------------------------------
-- insurance_plans
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_insurance_plans_clinic
  ON insurance_plans(clinic_id);

-- -------------------------------------------------------------
-- escalation_logs
-- -------------------------------------------------------------
-- Dashboard + alerts page: filter by clinic_id + status
CREATE INDEX IF NOT EXISTS idx_escalation_logs_clinic_status
  ON escalation_logs(clinic_id, status)
  WHERE clinic_id IS NOT NULL;

-- Conversation join (legacy two-step queries and existing records)
CREATE INDEX IF NOT EXISTS idx_escalation_logs_conversation
  ON escalation_logs(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- -------------------------------------------------------------
-- Backfill: populate clinic_id on existing escalation_logs rows
-- that were inserted before the orchestrator was fixed.
-- -------------------------------------------------------------
UPDATE escalation_logs el
SET    clinic_id = c.clinic_id
FROM   conversations c
WHERE  el.conversation_id = c.id
  AND  el.clinic_id IS NULL;
