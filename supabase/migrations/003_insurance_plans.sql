-- Tabela de convênios por clínica
CREATE TABLE insurance_plans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name       text NOT NULL,
  code       text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Junction: quais convênios cada tipo de consulta aceita
CREATE TABLE appointment_type_insurance (
  appointment_type_id uuid REFERENCES appointment_types(id) ON DELETE CASCADE,
  insurance_plan_id   uuid REFERENCES insurance_plans(id)   ON DELETE CASCADE,
  PRIMARY KEY (appointment_type_id, insurance_plan_id)
);

-- Novos campos em appointment_types
ALTER TABLE appointment_types
  ADD COLUMN IF NOT EXISTS max_per_day integer,
  ADD COLUMN IF NOT EXISTS particular  boolean NOT NULL DEFAULT true;

-- RLS
ALTER TABLE insurance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_type_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass" ON insurance_plans
  FOR ALL TO service_role USING (true);

CREATE POLICY "clinic owner read" ON insurance_plans
  FOR SELECT TO authenticated
  USING (clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid()));

CREATE POLICY "clinic owner write" ON insurance_plans
  FOR ALL TO authenticated
  USING (clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid()));

CREATE POLICY "service_role bypass" ON appointment_type_insurance
  FOR ALL TO service_role USING (true);

CREATE POLICY "clinic owner read" ON appointment_type_insurance
  FOR SELECT TO authenticated
  USING (
    appointment_type_id IN (
      SELECT id FROM appointment_types
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "clinic owner write" ON appointment_type_insurance
  FOR ALL TO authenticated
  USING (
    appointment_type_id IN (
      SELECT id FROM appointment_types
      WHERE clinic_id IN (SELECT id FROM clinics WHERE owner_id = auth.uid())
    )
  );
