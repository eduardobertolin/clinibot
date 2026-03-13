import twilio from "twilio";
import { NextRequest } from "next/server";

/**
 * Validates that an incoming request genuinely originated from Twilio.
 *
 * Uses `twilio.validateRequest()` which compares the X-Twilio-Signature
 * header against an HMAC-SHA1 hash of the full request URL + sorted POST
 * parameters, signed with TWILIO_AUTH_TOKEN.
 *
 * In development (NODE_ENV === "development") the check is skipped so that
 * local testing with tools like ngrok works without issues.
 *
 * @returns true if the request is valid (or if running in development),
 *          false if validation fails and the request should be rejected.
 */
export function validateTwilioSignature(
  req: NextRequest,
  formData: FormData
): boolean {
  // Skip in development to allow local testing
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn(
      "[Twilio] TWILIO_AUTH_TOKEN is not set — skipping signature validation"
    );
    return true;
  }

  // Reconstruct the original URL that Twilio signed.
  // Prefer x-forwarded-proto/host headers (set by reverse-proxies / Vercel)
  // so the URL matches exactly what Twilio used when generating the signature.
  const proto =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const pathAndQuery =
    req.nextUrl.pathname +
    (req.nextUrl.search ? req.nextUrl.search : "");
  const url = `${proto}://${host}${pathAndQuery}`;

  // Convert FormData to a plain Record<string, string> as required by the SDK
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value as string;
  });

  const twilioSignature = req.headers.get("x-twilio-signature") ?? "";

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);

  if (!isValid) {
    console.warn(
      `[Twilio] Invalid signature for ${url} — request rejected`
    );
  }

  return isValid;
}
