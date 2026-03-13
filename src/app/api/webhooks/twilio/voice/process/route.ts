import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { processMessage } from "@/lib/ai/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClinicContext } from "@/lib/conversation/orchestrator";
import { ConversationMessage } from "@/lib/supabase/types";
import { validateTwilioSignature } from "@/lib/twilio/validate";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get("clinicId")!;
  const patientPhone = searchParams.get("phone")!;

  const formData = await req.formData();

  // Verify the request genuinely came from Twilio
  if (!validateTwilioSignature(req, formData)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const speechResult = formData.get("SpeechResult") as string;

  const twiml = new VoiceResponse();
  const supabase = createAdminClient();

  if (!speechResult) {
    twiml.say({ language: "pt-BR", voice: "Polly.Camila" },
      "Não consegui entender. Por favor, ligue novamente."
    );
    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Load clinic context via shared orchestrator function (uses correct schema tables)
  const ctx = await buildClinicContext(clinicId);

  // Load or create phone conversation
  let { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_phone", patientPhone)
    .eq("channel", "phone")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conv) {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        clinic_id: clinicId,
        patient_phone: patientPhone,
        channel: "phone",
        messages: [],
        status: "active",
      })
      .select()
      .single();
    conv = newConv;
  }

  const history: ConversationMessage[] = Array.isArray(conv?.messages) ? conv.messages as unknown as ConversationMessage[] : [];
  const aiResponse = await processMessage(speechResult, history, ctx);

  // Handle emergency
  if (aiResponse.intent === "emergency") {
    await supabase.from("escalation_logs").insert({
      conversation_id: conv?.id || null,
      type: "emergency",
      message: `EMERGÊNCIA (telefone): ${patientPhone} — "${speechResult}"`,
      patient_phone: patientPhone,
      status: "open",
      clinic_id: clinicId,
    });

    twiml.say({ language: "pt-BR", voice: "Polly.Camila" }, aiResponse.message);
    twiml.say({ language: "pt-BR", voice: "Polly.Camila" },
      "Estou acionando a equipe agora. Por favor, aguarde."
    );
    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Save conversation turn
  if (conv) {
    const updatedMessages: ConversationMessage[] = [
      ...history,
      { role: "user", content: speechResult, timestamp: new Date().toISOString() },
      { role: "assistant", content: aiResponse.message, timestamp: new Date().toISOString() },
    ];
    await supabase
      .from("conversations")
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq("id", conv.id);
  }

  // Respond via voice + gather next input
  const gather = twiml.gather({
    input: ["speech"],
    language: "pt-BR",
    speechTimeout: "auto",
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice/process?clinicId=${clinicId}&phone=${encodeURIComponent(patientPhone)}`,
    method: "POST",
  });

  gather.say({ language: "pt-BR", voice: "Polly.Camila" }, aiResponse.message);

  twiml.say({ language: "pt-BR", voice: "Polly.Camila" },
    "Posso ajudar com mais alguma coisa? Caso não, obrigado e até logo!"
  );

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
