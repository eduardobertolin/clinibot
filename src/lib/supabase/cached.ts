/**
 * React cache() wrappers for expensive Supabase calls.
 * Deduplicates calls across layout + page within the same server request.
 * Each wrapper is called AT MOST once per rendering pass regardless of how
 * many Server Components import and invoke it.
 */
import { cache } from "react";
import { createClient } from "./server";

/** Deduplicates auth.getUser() across layout + page in the same request. */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Deduplicates the clinic lookup across layout + page in the same request.
 * Returns only {id, name} — enough for routing and sidebar.
 * Pages that need full clinic data should query by id separately.
 */
export const getOwnerClinic = cache(async (ownerId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
});
