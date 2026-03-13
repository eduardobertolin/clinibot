-- ============================================================
-- Migration 002: Fix existing schema to match application code
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. FIX APPOINTMENTS
-- ============================================================

-- Make doctor_id nullable (code inserts with doctor_id || null)
ALTER TABLE appointments ALTER COLUMN doctor_id DROP NOT NULL;

-- Make patient_id nullable (code doesn't use patients table)
ALTER TABLE appointments ALTER COLUMN patient_id DROP NOT NULL;

-- Add patient_name and patient_phone (code selects/inserts these)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone TEXT NOT NULL DEFAULT '';

-- Make end_datetime nullable (code inserts without it sometimes)
ALTER TABLE appointments ALTER COLUMN end_datetime DROP NOT NULL;

-- Fix status CHECK to include completed and no_show
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['scheduled','confirmed','cancelled','completed','no_show','rescheduled']));

-- ============================================================
-- 2. FIX CONVERSATIONS
-- ============================================================

-- Add patient_name (code reads conv.patient_name)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS patient_name TEXT;

-- Fix channel CHECK (code uses 'phone' not 'voice')
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_channel_check
  CHECK (channel = ANY (ARRAY['whatsapp','phone','voice']));

-- ============================================================
-- 3. FIX ESCALATION LOGS
-- ============================================================

-- Add clinic_id (dashboard page filters by clinic)
ALTER TABLE escalation_logs ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;

-- Make conversation_id nullable
ALTER TABLE escalation_logs ALTER COLUMN conversation_id DROP NOT NULL;

-- Fix status CHECK to include open and acknowledged
ALTER TABLE escalation_logs DROP CONSTRAINT IF EXISTS escalation_logs_status_check;
ALTER TABLE escalation_logs ADD CONSTRAINT escalation_logs_status_check
  CHECK (status = ANY (ARRAY['open','acknowledged','resolved','attempted_transfer','pending_callback']));

-- ============================================================
-- 4. ADD RLS POLICIES
-- ============================================================

-- CLINICS
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinic_owner_all" ON clinics;
CREATE POLICY "clinic_owner_all" ON clinics
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "service_role_bypass_clinics" ON clinics;
CREATE POLICY "service_role_bypass_clinics" ON clinics
  FOR ALL TO service_role USING (TRUE);

-- DOCTORS
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doctors_via_clinic" ON doctors;
CREATE POLICY "doctors_via_clinic" ON doctors
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "service_role_bypass_doctors" ON doctors;
CREATE POLICY "service_role_bypass_doctors" ON doctors
  FOR ALL TO service_role USING (TRUE);

-- APPOINTMENT TYPES
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointment_types_via_clinic" ON appointment_types;
CREATE POLICY "appointment_types_via_clinic" ON appointment_types
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "service_role_bypass_appointment_types" ON appointment_types;
CREATE POLICY "service_role_bypass_appointment_types" ON appointment_types
  FOR ALL TO service_role USING (TRUE);

-- SCHEDULES
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_via_clinic" ON schedules;
CREATE POLICY "schedules_via_clinic" ON schedules
  FOR ALL USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM doctors WHERE clinic_id IN (
        SELECT id FROM clinics WHERE owner_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "service_role_bypass_schedules" ON schedules;
CREATE POLICY "service_role_bypass_schedules" ON schedules
  FOR ALL TO service_role USING (TRUE);

-- APPOINTMENTS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_via_clinic" ON appointments;
CREATE POLICY "appointments_via_clinic" ON appointments
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "service_role_bypass_appointments" ON appointments;
CREATE POLICY "service_role_bypass_appointments" ON appointments
  FOR ALL TO service_role USING (TRUE);

-- CONVERSATIONS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_via_clinic" ON conversations;
CREATE POLICY "conversations_via_clinic" ON conversations
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "service_role_bypass_conversations" ON conversations;
CREATE POLICY "service_role_bypass_conversations" ON conversations
  FOR ALL TO service_role USING (TRUE);

-- ESCALATION LOGS
ALTER TABLE escalation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escalation_logs_via_clinic" ON escalation_logs;
CREATE POLICY "escalation_logs_via_clinic" ON escalation_logs
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "service_role_bypass_escalation_logs" ON escalation_logs;
CREATE POLICY "service_role_bypass_escalation_logs" ON escalation_logs
  FOR ALL TO service_role USING (TRUE);

-- PATIENTS (needed by existing FKs)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_via_clinic" ON patients;
CREATE POLICY "patients_via_clinic" ON patients
  FOR ALL USING (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "service_role_bypass_patients" ON patients;
CREATE POLICY "service_role_bypass_patients" ON patients
  FOR ALL TO service_role USING (TRUE);
