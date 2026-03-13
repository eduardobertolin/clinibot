export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ── Convenience types matching your actual Supabase schema ──────────────────

export interface Clinic {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  owner_id: string | null;
  zapi_instance_id: string | null;
  zapi_token: string | null;
  twilio_number: string | null;
  active: boolean;
}

export interface ClinicUser {
  id: string;
  clinic_id: string;
  role: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  created_at: string;
  clinic_id: string;
  user_id: string | null;
  name: string;
  specialization: string | null;
  active: boolean;
}

export interface InsurancePlan {
  id: string;
  clinic_id: string;
  name: string;
  code: string | null;
  active: boolean;
}

export interface AppointmentType {
  id: string;
  clinic_id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  insurance_allowed: boolean;
  particular: boolean;
  max_per_day: number | null;
  insurance_plans?: InsurancePlan[];
}

export interface Schedule {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
}

export interface BlockedDate {
  id: string;
  doctor_id: string;
  date: string;
}

export interface Patient {
  id: string;
  created_at: string;
  clinic_id: string;
  name: string;
  phone: string;
  insurance_type: string | null;
}

export interface Appointment {
  id: string;
  created_at: string;
  clinic_id: string;
  doctor_id: string | null;
  patient_id: string | null;
  appointment_type_id: string | null;
  status: string;
  start_datetime: string;
  end_datetime: string | null;
  reminder_sent_at: string | null;
  source: "whatsapp" | "phone" | "manual";
  patient_name?: string;
  patient_phone?: string;
  service_name?: string;
  insurance_plan_id?: string | null;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  clinic_id: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  channel: string;
  full_transcript: string | null;
  messages: Json;
  status: string;
}

export interface EscalationLog {
  id: string;
  created_at: string;
  conversation_id: string | null;
  clinic_id: string | null;
  type: "emergency" | "unhandled" | "error";
  message: string | null;
  patient_phone: string | null;
  status: string;
}

export interface DoctorTypeLimit {
  doctor_id: string;
  appointment_type_id: string;
  max_per_day: number;
  allow_consecutive: boolean;
}

export interface DoctorInsuranceLimit {
  doctor_id: string;
  insurance_plan_id: string;
  max_per_day: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Used by WeeklyCalendar and AppointmentDetailModal
export interface CalendarAppointment {
  id: string;
  start_datetime: string;
  end_datetime: string | null;
  status: string;
  source: string;
  patient_name: string;
  patient_phone: string;
  doctors: { name: string } | null;
  appointment_types: { name: string; duration_minutes: number } | null;
}
