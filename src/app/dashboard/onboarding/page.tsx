import { getAuthUser, getOwnerClinic } from "@/lib/supabase/cached";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  // Se já tem clínica, vai direto para a agenda
  const clinic = await getOwnerClinic(user.id);
  if (clinic) redirect("/dashboard");

  return <OnboardingClient />;
}
