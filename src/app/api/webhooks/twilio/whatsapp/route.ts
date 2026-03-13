import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processMessage } from "@/lib/ai/claude";
import { buildClinicContext } from "@/lib/conversation/orchestrator";
import { bookAppointment } from "@/lib/scheduling/availability";
import { ConversationMessage } from "@/lib/supabase/types";
import { validateTwilioSignature } from "@/lib/twilio/validate";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlReply(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();

    // Verify the request genuinely came from Twilio
    if (!validateTwilioSignature(req, formData)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const from = (formData.get("From") as string) ?? "";      // "whatsapp:+5511999999999"
    const to = (formData.get("To") as string) ?? "";          // "whatsapp:+14155238886"
    const body = (formData.get("Body") as string) ?? "";
    const profileName = (formData.get("ProfileName") as string) ?? "";

    console.log("[WA] Incoming:", { from, to, body: body.slice(0, 50), profileName });

    if (!body.trim()) return new NextResponse("", { status: 200 });

    const senderPhone = from.replace("whatsapp:", "");
    const toNumber = to.replace("whatsapp:", "");

    const supabase = createAdminClient();

    // 1. Find clinic: by twilio_number → env var sandbox → first active clinic
    let clinicId: string | null = null;

    const { data: byNumber } = await supabase
      .from("clinics")
      .select("id")
      .eq("twilio_number", toNumber)
      .limit(1);
    clinicId = byNumber?.[0]?.id ?? null;

    if (!clinicId && process.env.TWILIO_SANDBOX_CLINIC_ID) {
      clinicId = process.env.TWILIO_SANDBOX_CLINIC_ID;
    }

    if (!clinicId) {
      const { data: first } = await supabase
        .from("clinics")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      clinicId = first?.[0]?.id ?? null;
    }

    if (!clinicId) {
      console.error("[WA] No clinic found for number", toNumber);
      return twimlReply("Desculpe, não consegui identificar a clínica. Tente novamente em instantes.");
    }

    console.log("[WA] Clinic found:", clinicId);

    // 2. Load or create active conversation
    const { data: existingConvs } = await supabase
      .from("conversations")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_phone", senderPhone)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    let conv = existingConvs?.[0] ?? null;

    if (!conv) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          clinic_id: clinicId,
          patient_phone: senderPhone,
          patient_name: profileName || null,
          channel: "whatsapp",
          messages: [],
          status: "active",
        })
        .select()
        .single();
      conv = newConv;
    }

    if (!conv) {
      console.error("Twilio WhatsApp: failed to create conversation");
      return twimlReply("Erro interno. Por favor, tente novamente.");
    }

    const history: ConversationMessage[] = Array.isArray(conv.messages)
      ? (conv.messages as unknown as ConversationMessage[])
      : [];

    // 3. Build clinic context and call AI
    console.log("[WA] Building context for clinic...");
    const ctx = await buildClinicContext(clinicId);
    console.log("[WA] Context built, calling AI...");
    const aiResponse = await processMessage(body, history, ctx);
    console.log("[WA] AI response:", aiResponse.intent, aiResponse.message.slice(0, 80));
    console.log("[WA] Extracted data:", JSON.stringify(aiResponse.extractedData));

    // 4. Handle emergency escalation
    if (aiResponse.intent === "emergency") {
      await supabase.from("escalation_logs").insert({
        conversation_id: conv.id,
        type: "emergency",
        message: `EMERGÊNCIA: ${profileName || senderPhone} — "${body}"`,
        patient_phone: senderPhone,
        status: "open",
      });
      await supabase
        .from("conversations")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", conv.id);
    }

    // 5. Auto-book if AI extracted all required data (schedule or reschedule)
    if ((aiResponse.intent === "schedule" || aiResponse.intent === "reschedule") && aiResponse.extractedData) {
      const { patientName, preferredDate, preferredTime, serviceName, patientInsurance, doctorName } = aiResponse.extractedData;
      console.log("[WA] Booking check:", { patientName, preferredDate, preferredTime, serviceName, patientInsurance, doctorName });
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
          console.log("[WA] Insurance plan lookup:", patientInsurance, "→", insurancePlanId);
        }

        // Lookup doctor_id by name if patient mentioned a doctor (needed for limit enforcement)
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
          console.log("[WA] Doctor lookup:", doctorName, "→", doctorId);
        }

        console.log("[WA] Booking appointment...");
        const booked = await bookAppointment({
          clinicId,
          doctorId,
          patientName,
          patientPhone: senderPhone,
          appointmentTypeName: serviceName,
          startDatetime: `${preferredDate}T${preferredTime}:00`,
          source: "whatsapp",
          insurancePlanId,
        });
        console.log("[WA] Booking result:", booked);

        if (booked && "error" in booked) {
          const limitMessages: Record<string, string> = {
            type_limit_exceeded: "Desculpe, o médico atingiu o limite diário para esse tipo de consulta. Por favor, escolha outro horário ou dia.",
            consecutive_not_allowed: "Desculpe, não é possível agendar consultas consecutivas desse tipo. Por favor, escolha um horário com intervalo.",
            insurance_limit_exceeded: "Desculpe, o médico atingiu o limite diário de consultas para esse convênio. Por favor, escolha outro dia.",
            time_conflict: "Desculpe, esse horário acabou de ser ocupado. Por favor, escolha outro horário disponível.",
          };
          const limitMsg = limitMessages[booked.error];
          if (limitMsg) {
            console.log("[WA] Booking blocked by limit:", booked.error);
            return twimlReply(limitMsg);
          }
        }
      }
    }

    // 6. Cancel appointment if AI confirmed cancellation
    if (aiResponse.intent === "cancel" && aiResponse.extractedData) {
      const { preferredDate, preferredTime } = aiResponse.extractedData;
      if (preferredDate && preferredTime) {
        const startDatetime = `${preferredDate}T${preferredTime}:00`;
        // Find appointments for this patient on this datetime
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
          console.log("[WA] Cancelled appointment:", appts[0].id);
        } else {
          console.log("[WA] No appointment found to cancel for", startDatetime);
        }
      }
    }

    // 7. Persist updated conversation
    const updatedMessages: ConversationMessage[] = [
      ...history,
      { role: "user", content: body, timestamp: new Date().toISOString() },
      { role: "assistant", content: aiResponse.message, timestamp: new Date().toISOString() },
    ];

    await supabase
      .from("conversations")
      .update({
        messages: updatedMessages,
        patient_name: profileName || conv.patient_name || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conv.id);

    // 7. Reply via TwiML (no extra Twilio credentials needed for sandbox)
    return twimlReply(aiResponse.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("[WA] ERROR MESSAGE:", msg);
    console.error("[WA] ERROR STACK:", stack);
    return twimlReply("Ocorreu um erro. Por favor, tente novamente.");
  }
}
