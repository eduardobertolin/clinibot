import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConversationMessage } from "@/lib/supabase/types";

const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export interface ClinicContext {
  clinicName: string;
  doctors: Array<{ name: string; specialty?: string }>;
  services: Array<{
    name: string;
    duration_minutes: number;
    particular: boolean;
    insurances: string[];
  }>;
  workingHours: Array<{ day: string; start: string; end: string }>;
  availableSlots?: string[];
  insurancePlans?: Array<{ name: string; code: string | null }>;
}

export interface AIResponse {
  message: string;
  intent: "schedule" | "cancel" | "reschedule" | "info" | "emergency" | "other";
  extractedData?: {
    patientName?: string;
    preferredDate?: string;
    preferredTime?: string;
    doctorName?: string;
    serviceName?: string;
    patientInsurance?: string;
  };
}

function buildSystemPrompt(ctx: ClinicContext): string {
  const hoursText = ctx.workingHours
    .map((h) => `${h.day}: ${h.start} às ${h.end}`)
    .join(", ");

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });

  return `Você é a secretária virtual da clínica "${ctx.clinicName}".
Data de hoje: ${today}. Use sempre o ano correto ao extrair datas. Você atende pacientes via WhatsApp e telefone em português brasileiro.

## Sua função:
- Agendar, cancelar e remarcar consultas
- Informar horários disponíveis, serviços e médicos
- Responder dúvidas sobre a clínica
- Identificar emergências e acionar o time humano

## Médicos disponíveis:
${ctx.doctors.map((d) => `- ${d.name}${d.specialty ? ` (${d.specialty})` : ""}`).join("\n")}

## Serviços oferecidos:
${ctx.services.map((s) => {
  const paymentParts: string[] = [];
  if (s.particular) paymentParts.push("Particular");
  if (s.insurances.length > 0) paymentParts.push(`Convênios: ${s.insurances.join(", ")}`);
  const paymentInfo = paymentParts.length > 0 ? ` | ${paymentParts.join(" | ")}` : "";
  return `- ${s.name} (${s.duration_minutes} min)${paymentInfo}`;
}).join("\n")}${
  ctx.insurancePlans && ctx.insurancePlans.length > 0
    ? `\n\n## Convênios aceitos pela clínica:\n${ctx.insurancePlans.map((p) => `- ${p.name}${p.code ? ` (código ANS: ${p.code})` : ""}`).join("\n")}`
    : ""
}

## Horário de funcionamento:
${hoursText}

${
  ctx.availableSlots && ctx.availableSlots.length > 0
    ? `## Próximos horários disponíveis:\n${ctx.availableSlots.slice(0, 8).join("\n")}`
    : ""
}

## Regras importantes:
1. Sempre responda em português brasileiro, de forma cordial e profissional
2. Se o paciente descrever sintomas graves, dor intensa, emergência médica ou risco de vida — responda com empatia e diga que irá acionar a equipe imediatamente. NÃO tente resolver emergências.
3. Ao confirmar um agendamento, sempre repita: nome do paciente, data, hora e médico/serviço
4. Se não souber responder algo, diga que vai verificar e avisar em breve
5. Seja conciso — respostas curtas e objetivas são melhores para WhatsApp

## Formato de resposta (JSON):
Responda SEMPRE em JSON válido com este formato exato:
{
  "message": "sua resposta para o paciente aqui",
  "intent": "schedule|cancel|reschedule|info|emergency|other",
  "extractedData": {
    "patientName": "nome se mencionado",
    "preferredDate": "YYYY-MM-DD se mencionado",
    "preferredTime": "HH:MM se mencionado",
    "doctorName": "nome do médico se mencionado",
    "serviceName": "nome do serviço se mencionado",
    "patientInsurance": "nome do convênio se mencionado pelo paciente"
  }
}`;
}

export async function processMessage(
  userMessage: string,
  history: ConversationMessage[],
  ctx: ClinicContext
): Promise<AIResponse> {
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: buildSystemPrompt(ctx),
  });

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  const result = await chat.sendMessage(userMessage);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]) as AIResponse;
  } catch {
    return { message: text, intent: "other" };
  }
}
