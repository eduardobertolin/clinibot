import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClinicContextForTwilio } from "@/lib/conversation/twilio-handler";
import { validateTwilioSignature } from "@/lib/twilio/validate";

const VoiceResponse = twilio.twiml.VoiceResponse;

// Initial greeting when patient calls
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  // Verify the request genuinely came from Twilio
  if (!validateTwilioSignature(req, formData)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const toNumber = formData.get("To") as string;
  const from = formData.get("From") as string;

  const twiml = new VoiceResponse();

  // Find clinic by Twilio number
  const supabase = createAdminClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("twilio_number", toNumber)
    .eq("active", true)
    .single();

  if (!clinic) {
    twiml.say({ language: "pt-BR", voice: "Polly.Camila" },
      "Desculpe, não conseguimos identificar a clínica. Por favor, tente novamente mais tarde."
    );
    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Gather speech input
  const gather = twiml.gather({
    input: ["speech"],
    language: "pt-BR",
    speechTimeout: "auto",
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice/process?clinicId=${clinic.id}&phone=${encodeURIComponent(from)}`,
    method: "POST",
  });

  gather.say({ language: "pt-BR", voice: "Polly.Camila" },
    `Olá! Você ligou para a ${clinic.name}. Como posso ajudá-lo hoje?`
  );

  // If no input, prompt again
  twiml.say({ language: "pt-BR", voice: "Polly.Camila" },
    "Não ouvi sua resposta. Por favor, ligue novamente."
  );

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
