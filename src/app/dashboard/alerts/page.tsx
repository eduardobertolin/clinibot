import { getAuthUser, getOwnerClinic } from "@/lib/supabase/cached";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Info, Zap, Clock, CheckCircle2 } from "lucide-react";
import AcknowledgeButton from "@/components/dashboard/AcknowledgeButton";

const typeConfig = {
  emergency: { icon: Zap,           borderColor: "border-l-red-500",    iconClass: "text-red-600 bg-red-50",    label: "Emergência" },
  unhandled: { icon: AlertTriangle, borderColor: "border-l-orange-500", iconClass: "text-orange-600 bg-orange-50", label: "Não resolvida" },
  error:     { icon: Info,          borderColor: "border-l-gray-400",   iconClass: "text-gray-600 bg-gray-100", label: "Erro" },
};

export default async function AlertsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const clinic = await getOwnerClinic(user.id);
  if (!clinic) redirect("/dashboard/onboarding");

  // Admin client bypasses RLS — filter directly by clinic_id (single query, no two-step).
  // Records inserted before clinic_id was added to the orchestrator will be missed;
  // run the backfill in migration 005 to populate existing rows.
  const admin = createAdminClient();
  const { data: alerts } = await admin
    .from("escalation_logs")
    .select("id, type, message, patient_phone, status, created_at, conversation_id")
    .eq("clinic_id", clinic.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const open = (alerts || []).filter((a) => a.status === "open");
  const rest = (alerts || []).filter((a) => a.status !== "open");

  const stats = [
    { label: "Alertas abertos", value: open.length, icon: Zap, color: "text-red-600", bg: "bg-red-50" },
    { label: "Histórico", value: rest.length, icon: Clock, color: "text-gray-600", bg: "bg-gray-100" },
    { label: "Total", value: (alerts || []).length, icon: CheckCircle2, color: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-sm text-gray-500 mt-1">Notificações e escalações do assistente virtual</p>
      </div>

      <div className="p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">{s.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                  </div>
                  <div className={`${s.bg} p-3 rounded-xl`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {open.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
              Abertos ({open.length})
            </h2>
            <div className="space-y-3">
              {open.map((alert) => {
                const cfg = typeConfig[alert.type as keyof typeof typeConfig] || typeConfig.error;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    className={`bg-white border-l-4 ${cfg.borderColor} rounded-lg p-4 flex gap-4 shadow-sm`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.iconClass}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(parseISO(alert.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{alert.message || "—"}</p>
                      {alert.patient_phone && (
                        <p className="text-xs text-gray-400 mt-0.5">Paciente: {alert.patient_phone}</p>
                      )}
                    </div>
                    <AcknowledgeButton alertId={alert.id} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Histórico</h2>
            <div className="space-y-2">
              {rest.map((alert) => {
                const cfg = typeConfig[alert.type as keyof typeof typeConfig] || typeConfig.error;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    className={`bg-white border-l-4 ${cfg.borderColor} rounded-lg p-4 flex gap-4 opacity-50`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.iconClass.split(" ")[0]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{alert.message || "—"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(alert.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {(!alerts || alerts.length === 0) && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-lg font-medium">Nenhum alerta</p>
            <p className="text-sm mt-1">Emergências e mensagens não resolvidas aparecerão aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
