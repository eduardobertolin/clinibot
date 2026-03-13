import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getOwnerClinic } from "@/lib/supabase/cached";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  // Cached — shared with child page, no extra round-trip
  let clinic = await getOwnerClinic(user.id);

  // First login after e-mail confirmation: create clinic from signup metadata
  if (!clinic && user.user_metadata?.clinic_name) {
    const admin = createAdminClient();
    const { data: newClinic } = await admin
      .from("clinics")
      .insert({
        name: user.user_metadata.clinic_name as string,
        phone: (user.user_metadata.clinic_phone as string) || "",
        owner_id: user.id,
        active: true,
      })
      .select("id, name")
      .single();
    clinic = newClinic;
  }

  // Contar alertas abertos para badge na sidebar (filtro direto por clinic_id)
  let openAlertsCount = 0;
  if (clinic) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("escalation_logs")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("status", "open");
    openAlertsCount = count ?? 0;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar clinicName={clinic?.name || "Minha Clínica"} alertCount={openAlertsCount} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
