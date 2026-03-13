import { NextRequest, NextResponse } from "next/server";
import { ZApiWebhookPayload } from "@/lib/zapi/client";
import { handleIncomingWhatsApp } from "@/lib/conversation/orchestrator";
import { createAdminClient } from "@/lib/supabase/admin";

// Z-API sends a GET to verify webhook — respond with 200
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: NextRequest) {
  try {
    // Verify the request authenticity using the shared webhook secret.
    // Z-API sends the secret either as the "x-zapi-token" header or as a
    // "token" query parameter. If ZAPI_WEBHOOK_SECRET is not configured,
    // we allow the request through with a warning (useful in dev/staging).
    const webhookSecret = process.env.ZAPI_WEBHOOK_SECRET;
    if (webhookSecret) {
      const tokenHeader = req.headers.get("x-zapi-token");
      const tokenQuery = req.nextUrl.searchParams.get("token");
      const receivedToken = tokenHeader ?? tokenQuery;
      if (receivedToken !== webhookSecret) {
        console.warn("[Z-API] Invalid or missing webhook token — request rejected");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      console.warn("[Z-API] ZAPI_WEBHOOK_SECRET is not set — skipping token validation");
    }

    const payload: ZApiWebhookPayload = await req.json();

    // Skip messages sent by the bot itself
    if (payload.fromMe) return NextResponse.json({ ok: true });

    // Only handle text messages for now
    if (payload.type !== "ReceivedCallback" || !payload.text?.message) {
      return NextResponse.json({ ok: true });
    }

    // Find clinic by Z-API instance ID
    const supabase = createAdminClient();
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("zapi_instance_id", payload.instanceId)
      .eq("active", true)
      .single();

    if (!clinic) {
      console.warn("No clinic found for instance:", payload.instanceId);
      return NextResponse.json({ ok: true });
    }

    // Process in background — respond to Z-API immediately
    handleIncomingWhatsApp(
      clinic.id,
      payload.phone,
      payload.senderName,
      payload.text.message
    ).catch((err) => console.error("WhatsApp handler error:", err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
