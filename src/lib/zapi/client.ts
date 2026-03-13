import axios from "axios";

const BASE_URL = process.env.ZAPI_BASE_URL || "https://api.z-api.io";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Client-Token": process.env.ZAPI_TOKEN!,
  };
}

function instanceUrl(path: string) {
  return `${BASE_URL}/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}${path}`;
}

export async function sendWhatsAppText(phone: string, message: string): Promise<void> {
  // Z-API expects phone in format: 5511999999999 (country code + number, no +)
  const normalized = phone.replace(/\D/g, "");
  await axios.post(
    instanceUrl("/send-text"),
    { phone: normalized, message },
    { headers: getHeaders() }
  );
}

export async function getInstanceStatus(): Promise<{ connected: boolean }> {
  const res = await axios.get(instanceUrl("/status"), { headers: getHeaders() });
  return { connected: res.data?.connected === true };
}

// Webhook payload types from Z-API
export interface ZApiWebhookPayload {
  instanceId: string;
  messageId: string;
  phone: string;        // sender phone
  fromMe: boolean;
  momment: number;      // timestamp (Z-API typo, kept as-is)
  status: string;
  chatName: string;
  senderPhoto: string | null;
  senderName: string;
  participantPhone: string | null;
  photo: string | null;
  broadcast: boolean;
  type: string;
  text?: { message: string };
  audio?: { audioUrl: string };
  image?: { imageUrl: string; caption: string };
  document?: { documentUrl: string; fileName: string };
}
