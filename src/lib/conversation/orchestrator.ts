import { createAdminClient } from "@/lib/supabase/admin";
import { processMessage, ClinicContext } from "@/lib/ai/claude";
import { sendWhatsAppText } from "@/lib/zapi/client";
import { getAvailableSlots, bookAppointment } from "@/lib/scheduling/availability";
import { ConversationMessage } from "@/lib/supabase/types";

export async function handleIncomingWhatsApp(
  clinicId: string,
  senderPhone: string,
  senderName: string,
  messageText: string
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Load or create active conversation
  let { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_phone", senderPhone)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conv) {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        clinic_id: clinicId,
        patient_phone: senderPhone,
        channel: "whatsapp",
        messages: [],
        status: "active",
      })
      .select()
      .single();
    conv = newConv;
  }

  if (!conv) {
    console.error("Failed to create conversation");
    return;
  }

  const history: ConversationMessage[] = Array.isArray(conv.messages)
    ? (conv.messages as unknown as ConversationMessage[])
    : [];

  // 2. Build clinic context
  const ctx = await buildClinicContext(clinicId);

  // 3. Get AI response
  const aiResponse = await processMessage(messageText, history, ctx);

  // 4. Handle emergency — create escalation_log + mark conversation escalated
  if (aiResponse.intent === "emergency") {
    await supabase.from("escalation_logs").insert({
      clinic_id: clinicId,       // ← required for direct clinic_id queries (dashboard + alerts)
      conversation_id: conv.id,
      type: "emergency",
      message: `EMERGÊNCIA: ${senderName || senderPhone} — "${messageText}"`,
      patient_phone: senderPhone,
      status: "open",
    });

    await supabase
      .from("conversations")
      .update({ status: "escalated", updated_at: new Date().toISOString() })
      .eq("id", conv.id);
  }

  // 5. Handle scheduling — book if AI extracted all needed data
  if ((aiResponse.intent === "schedule" || aiResponse.intent === "reschedule") && aiResponse.extractedData) {
    const { patientName, preferredDate, preferredTime, serviceName, patientInsurance, doctorName } = aiResponse.extractedData;
    if (patientName && preferredDate && preferredTime && serviceName) {
      // Lookup insurance_plan_id by name if patient mentioned a convênio
      let insurancePlanId: string | undefined;
      if (patientInsurance) {
        const { data: plan } = await supabase
          .from("insurance_plans")
          .select("id")
          .eq("clinic_id", clinicId)
          .ilike("name", `%${patientInsurance}%`)
          .limit(1);
        insurancePlanId = plan?.[0]?.id;
      }

      // Lookup doctor_id by name if patient mentioned a doctor
      let doctorId: string | undefined;
      if (doctorName) {
        const { data: doctor } = await supabase
          .from("doctors")
          .select("id")
          .eq("clinic_id", clinicId)
          .ilike("name", `%${doctorName}%`)
          .eq("active", true)
          .limit(1);
        doctorId = doctor?.[0]?.id;
      }

      const bookResult = await bookAppointment({
        clinicId,
        doctorId,
        patientName,
        patientPhone: senderPhone,
        appointmentTypeName: serviceName,
        startDatetime: `${preferredDate}T${preferredTime}:00`,
        source: "whatsapp",
        insurancePlanId,
      });

      if (bookResult && "error" in bookResult && bookResult.error === "time_conflict") {
        await sendWhatsAppText(
          senderPhone,
          "Desculpe, esse horário acabou de ser ocupado. Por favor, escolha outro horário disponível."
        );
        return;
      }
    }
  }

  // 5b. Handle cancel — find appointment and mark as cancelled
  if (aiResponse.intent === "cancel" && aiResponse.extractedData) {
    const { preferredDate, preferredTime } = aiResponse.extractedData;
    if (preferredDate && preferredTime) {
      const { data: appts } = await supabase
        .from("appointments")
        .select("id")
        .eq("clinic_id", clinicId)
        .gte("start_datetime", `${preferredDate}T${preferredTime.slice(0, 5)}:00`)
        .lt("start_datetime", `${preferredDate}T${preferredTime.slice(0, 5)}:59`)
        .in("status", ["scheduled", "confirmed"])
        .limit(1);

      if (appts && appts.length > 0) {
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("id", appts[0].id);
      }
    }
  }

  // 6. Save updated conversation
  const updatedMessages: ConversationMessage[] = [
    ...history,
    { role: "user", content: messageText, timestamp: new Date().toISOString() },
    { role: "assistant", content: aiResponse.message, timestamp: new Date().toISOString() },
  ];

  await supabase
    .from("conversations")
    .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
    .eq("id", conv.id);

  // 7. Reply via WhatsApp
  await sendWhatsAppText(senderPhone, aiResponse.message);
}

export async function buildClinicContext(clinicId: string): Promise<ClinicContext> {
  const supabase = createAdminClient();

  // Wave 1: 4 queries in parallel — nothing depends on each other yet
  const [clinicRes, doctorsRes, typesRes, plansRes] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("doctors").select("id, name, specialization").eq("clinic_id", clinicId).eq("active", true),
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes, particular, appointment_type_insurance(insurance_plan_id)")
      .eq("clinic_id", clinicId),
    supabase.from("insurance_plans").select("id, name, code").eq("clinic_id", clinicId).eq("active", true),
  ]);

  const activeDoctorIds = (doctorsRes.data || []).map((d) => d.id);

  // Wave 2: schedules + availability slots both need doctor IDs — run in parallel
  const [schedulesRes, availableSlots] = await Promise.all([
    activeDoctorIds.length > 0
      ? supabase
          .from("schedules")
          .select("weekday, start_time, end_time")
          .in("doctor_id", activeDoctorIds)
      : Promise.resolve({ data: [] as Array<{ weekday: number; start_time: string; end_time: string }> }),
    // Pass pre-fetched doctor IDs to skip an internal doctor query inside getAvailableSlots
    getAvailableSlots(clinicId, null, 5, activeDoctorIds),
  ]);

  const planMap = new Map<string, string>(
    (plansRes.data || []).map((p: { id: string; name: string; code: string | null }) => [p.id, p.name])
  );

  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Deduplicate working hours by weekday
  const uniqueHours = Array.from(
    new Map(
      (schedulesRes.data || []).map((s) => [
        `${s.weekday}_${s.start_time}_${s.end_time}`,
        { day: dayNames[s.weekday], start: s.start_time, end: s.end_time },
      ])
    ).values()
  );

  return {
    clinicName: clinicRes.data?.name || "Clínica",
    doctors: (doctorsRes.data || []).map((d) => ({
      name: d.name,
      specialty: d.specialization || undefined,
    })),
    services: (typesRes.data || []).map((t) => {
      const insuranceIds: string[] = (t.appointment_type_insurance || []).map(
        (r: { insurance_plan_id: string }) => r.insurance_plan_id
      );
      const insurances = insuranceIds.map((id) => planMap.get(id)).filter(Boolean) as string[];
      return {
        name: t.name,
        duration_minutes: t.duration_minutes,
        particular: t.particular ?? true,
        insurances,
      };
    }),
    workingHours: uniqueHours,
    availableSlots,
    insurancePlans: (plansRes.data || []).map((p: { id: string; name: string; code: string | null }) => ({
      name: p.name,
      code: p.code,
    })),
  };
}
