-- Limite por médico + tipo de atendimento
CREATE TABLE doctor_type_limits (
  doctor_id              uuid REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_type_id    uuid REFERENCES appointment_types(id) ON DELETE CASCADE,
  max_per_day            integer NOT NULL DEFAULT 1,
  allow_consecutive      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (doctor_id, appointment_type_id)
);

-- Limite por médico + convênio
CREATE TABLE doctor_insurance_limits (
  doctor_id          uuid REFERENCES doctors(id) ON DELETE CASCADE,
  insurance_plan_id  uuid REFERENCES insurance_plans(id) ON DELETE CASCADE,
  max_per_day        integer NOT NULL DEFAULT 1,
  PRIMARY KEY (doctor_id, insurance_plan_id)
);

-- Rastrear convênio em cada agendamento
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS insurance_plan_id uuid REFERENCES insurance_plans(id);

-- RLS
ALTER TABLE doctor_type_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_insurance_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass" ON doctor_type_limits
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role bypass" ON doctor_insurance_limits
  FOR ALL TO service_role USING (true);

CREATE POLICY "clinic owner" ON doctor_type_limits
  FOR ALL TO authenticated
  USING (doctor_id IN (
    SELECT id FROM doctors
    WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  ));

CREATE POLICY "clinic owner" ON doctor_insurance_limits
  FOR ALL TO authenticated
  USING (doctor_id IN (
    SELECT id FROM doctors
    WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
  ));
