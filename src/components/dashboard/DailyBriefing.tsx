import { format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, AlertCircle, MessageSquare, Clock } from "lucide-react";
import type { CalendarAppointment } from "@/lib/supabase/types";

interface Props {
  todayAppointments: CalendarAppointment[];
  openAlerts: number;
  openConversations: number;
}

export default function DailyBriefing({ todayAppointments, openAlerts, openConversations }: Props) {
  const now = new Date();
  const completed = todayAppointments.filter((a) => a.status === "completed").length;
  const remaining = todayAppointments.filter(
    (a) =>
      (a.status === "scheduled" || a.status === "confirmed") &&
      isAfter(parseISO(a.start_datetime), now)
  );
  const next = remaining[0] ?? null;

  const items = [
    {
      label: "Hoje",
      value: `${todayAppointments.length}`,
      sub: completed > 0 ? `${completed} atendida${completed !== 1 ? "s" : ""}` : `${remaining.length} a realizar`,
      icon: CalendarClock,
      iconClass: "text-cyan-600",
      bgClass: "bg-cyan-50",
      highlight: false,
    },
    {
      label: "Próxima consulta",
      value: next ? format(parseISO(next.start_datetime), "HH:mm", { locale: ptBR }) : "–",
      sub: next ? next.patient_name : "Nenhuma pendente",
      icon: Clock,
      iconClass: "text-violet-600",
      bgClass: "bg-violet-50",
      highlight: false,
    },
    {
      label: "Alertas abertos",
      value: String(openAlerts),
      sub: openAlerts > 0 ? "Requer atenção" : "Tudo tranquilo",
      icon: AlertCircle,
      iconClass: openAlerts > 0 ? "text-red-600" : "text-gray-400",
      bgClass: openAlerts > 0 ? "bg-red-50" : "bg-gray-50",
      highlight: openAlerts > 0,
    },
    {
      label: "Conversas abertas",
      value: String(openConversations),
      sub: openConversations > 0 ? "Aguardando resposta" : "Nenhuma pendente",
      icon: MessageSquare,
      iconClass: openConversations > 0 ? "text-amber-600" : "text-gray-400",
      bgClass: openConversations > 0 ? "bg-amber-50" : "bg-gray-50",
      highlight: openConversations > 0,
    },
  ];

  return (
    <div
      className={`rounded-xl border p-5 ${
        openAlerts > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
      }`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Resumo de hoje —{" "}
        {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`rounded-lg p-3 ${item.bgClass} ${item.highlight ? "ring-1 ring-red-300" : ""}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${item.iconClass}`} strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">{item.label}</p>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{item.value}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
