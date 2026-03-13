import { createAdminClient } from "@/lib/supabase/admin";
import { format, addMinutes, isAfter, setHours, setMinutes, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function getAvailableSlots(
  clinicId: string,
  doctorId: string | null,
  daysAhead = 7,
  /** Pre-fetched doctor IDs — skips an extra DB round-trip when called from buildClinicContext */
  preloadedDoctorIds?: string[]
): Promise<string[]> {
  const supabase = createAdminClient();

  // Resolve doctor IDs — use preloaded list if provided (avoids duplicate DB fetch)
  let doctorIds: string[];
  if (doctorId) {
    doctorIds = [doctorId];
  } else if (preloadedDoctorIds) {
    doctorIds = preloadedDoctorIds;
  } else {
    const { data: doctors } = await supabase
      .from("doctors")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("active", true);
    doctorIds = (doctors || []).map((d) => d.id);
  }

  if (doctorIds.length === 0) return [];

  const now = new Date();
  const until = addDays(now, daysAhead);

  // Fetch schedules, blocked dates, and existing appointments in parallel
  const [{ data: schedules }, { data: blocked }, { data: existing }] = await Promise.all([
    supabase
      .from("schedules")
      .select("*")
      .in("doctor_id", doctorIds),
    supabase
      .from("blocked_dates")
      .select("doctor_id, date")
      .in("doctor_id", doctorIds),
    supabase
      .from("appointments")
      .select("start_datetime, end_datetime")
      .eq("clinic_id", clinicId)
      .in("status", ["scheduled", "confirmed"])
      .gte("start_datetime", now.toISOString())
      .lte("start_datetime", until.toISOString()),
  ]);

  if (!schedules || schedules.length === 0) return [];

  const blockedSet = new Set((blocked || []).map((b) => `${b.doctor_id}_${b.date}`));

  // Build list of booked ranges: {start, end} in ms for fast overlap check
  const bookedRanges = (existing || []).map((a) => ({
    start: new Date(a.start_datetime).getTime(),
    // Fall back to start + 30min if end_datetime is missing (safety net)
    end: a.end_datetime
      ? new Date(a.end_datetime).getTime()
      : new Date(a.start_datetime).getTime() + 30 * 60000,
  }));

  const slots: string[] = [];
  const slotDuration = 30;

  for (let d = 0; d < daysAhead; d++) {
    const day = addDays(startOfDay(now), d);
    const dayOfWeek = day.getDay();
    const dateStr = format(day, "yyyy-MM-dd");

    const daySchedules = schedules.filter(
      (s) => s.weekday === dayOfWeek && !blockedSet.has(`${s.doctor_id}_${dateStr}`)
    );

    for (const sched of daySchedules) {
      const [startH, startM] = sched.start_time.split(":").map(Number);
      const [endH, endM] = sched.end_time.split(":").map(Number);

      let slot = setMinutes(setHours(day, startH), startM);
      const endTime = setMinutes(setHours(day, endH), endM);

      while (isAfter(endTime, slot)) {
        const slotMs = slot.getTime();
        const isBooked = bookedRanges.some(
          (r) => slotMs >= r.start && slotMs < r.end
        );
        if (isAfter(slot, now) && !isBooked) {
          slots.push(format(slot, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR }));
        }
        slot = addMinutes(slot, slotDuration);
      }
    }
  }

  // Deduplicate (multiple doctors may share slots)
  return [...new Set(slots)];
}

export async function bookAppointment(params: {
  clinicId: string;
  doctorId?: string;
  patientName: string;
  patientPhone: string;
  appointmentTypeName: string;
  startDatetime: string; // ISO
  durationMinutes?: number;
  source: "whatsapp" | "phone" | "manual";
  insurancePlanId?: string;
}): Promise<{ id: string } | { error: string } | null> {
  const supabase = createAdminClient();

  // Find or create patient
  let patientId: string | null = null;
  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", params.clinicId)
    .eq("phone", params.patientPhone)
    .single();

  if (existingPatient) {
    patientId = existingPatient.id;
  } else {
    const { data: newPatient } = await supabase
      .from("patients")
      .insert({ clinic_id: params.clinicId, name: params.patientName, phone: params.patientPhone })
      .select("id")
      .single();
    patientId = newPatient?.id || null;
  }

  // Find appointment type
  const { data: apptType } = await supabase
    .from("appointment_types")
    .select("id, duration_minutes")
    .eq("clinic_id", params.clinicId)
    .ilike("name", `%${params.appointmentTypeName}%`)
    .single();

  const duration = params.durationMinutes || apptType?.duration_minutes || 30;
  const start = new Date(params.startDatetime);
  const end = new Date(start.getTime() + duration * 60000);
  const dateStr = start.toISOString().slice(0, 10);

  // Enforce per-doctor limits
  if (params.doctorId && apptType?.id) {
    const { data: typeLimit } = await supabase
      .from("doctor_type_limits")
      .select("max_per_day, allow_consecutive")
      .eq("doctor_id", params.doctorId)
      .eq("appointment_type_id", apptType.id)
      .single();

    if (typeLimit) {
      // 1. Daily limit by type
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", params.doctorId)
        .eq("appointment_type_id", apptType.id)
        .gte("start_datetime", `${dateStr}T00:00:00`)
        .lte("start_datetime", `${dateStr}T23:59:59`)
        .in("status", ["scheduled", "confirmed"]);

      if ((count ?? 0) >= typeLimit.max_per_day) {
        return { error: "type_limit_exceeded" };
      }

      // 2. Consecutive restriction
      if (!typeLimit.allow_consecutive) {
        const { data: adjacent } = await supabase
          .from("appointments")
          .select("start_datetime, end_datetime")
          .eq("doctor_id", params.doctorId)
          .eq("appointment_type_id", apptType.id)
          .gte("start_datetime", `${dateStr}T00:00:00`)
          .lte("start_datetime", `${dateStr}T23:59:59`)
          .in("status", ["scheduled", "confirmed"]);

        const hasConsecutive = (adjacent || []).some((a) => {
          const aStart = new Date(a.start_datetime).getTime();
          const aEnd = new Date(a.end_datetime || a.start_datetime).getTime();
          return aEnd === start.getTime() || aStart === end.getTime();
        });

        if (hasConsecutive) {
          return { error: "consecutive_not_allowed" };
        }
      }
    }
  }

  // 3. Daily limit by insurance plan
  if (params.doctorId && params.insurancePlanId) {
    const { data: insLimit } = await supabase
      .from("doctor_insurance_limits")
      .select("max_per_day")
      .eq("doctor_id", params.doctorId)
      .eq("insurance_plan_id", params.insurancePlanId)
      .single();

    if (insLimit) {
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", params.doctorId)
        .eq("insurance_plan_id", params.insurancePlanId)
        .gte("start_datetime", `${dateStr}T00:00:00`)
        .lte("start_datetime", `${dateStr}T23:59:59`)
        .in("status", ["scheduled", "confirmed"]);

      if ((count ?? 0) >= insLimit.max_per_day) {
        return { error: "insurance_limit_exceeded" };
      }
    }
  }

  // Verificar conflito de horário para o médico
  if (params.doctorId) {
    const { data: conflict } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", params.doctorId)
      .in("status", ["scheduled", "confirmed"])
      .lt("start_datetime", end.toISOString())   // appointment existente começa antes do novo terminar
      .gt("end_datetime", start.toISOString())   // appointment existente termina depois do novo começar
      .limit(1);

    if (conflict && conflict.length > 0) {
      return { error: "time_conflict" };
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: params.clinicId,
      doctor_id: params.doctorId || null,
      patient_id: patientId,
      appointment_type_id: apptType?.id || null,
      status: "scheduled",
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      source: params.source,
      insurance_plan_id: params.insurancePlanId || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("bookAppointment error:", error);
    return null;
  }

  return data;
}
