"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MessageSquare } from "lucide-react";

const statusLabel: Record<string, { label: string; className: string }> = {
  scheduled:  { label: "Agendado",         className: "bg-blue-50 text-blue-700" },
  confirmed:  { label: "Confirmado",        className: "bg-green-50 text-green-700" },
  cancelled:  { label: "Cancelado",         className: "bg-red-50 text-red-700" },
  completed:  { label: "Realizado",         className: "bg-gray-100 text-gray-600" },
  no_show:    { label: "Não compareceu",    className: "bg-orange-50 text-orange-700" },
};

interface Props {
  appointment: {
    id: string;
    start_datetime: string;
    status: string;
    source: string;
    doctors?: { name: string } | null;
    appointment_types?: { name: string } | null;
    // patients may be joined in future
    patient_id?: string | null;
  };
}

export default function AppointmentCard({ appointment: a }: Props) {
  const status = statusLabel[a.status] || { label: a.status, className: "bg-gray-100 text-gray-600" };

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
      <div className="w-20 text-right flex-shrink-0">
        <p className="text-sm font-semibold text-gray-900">
          {format(parseISO(a.start_datetime), "HH:mm")}
        </p>
        <p className="text-xs text-gray-400">
          {format(parseISO(a.start_datetime), "EEE, d/MM", { locale: ptBR })}
        </p>
      </div>

      <div className="w-px h-10 bg-gray-200 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {a.appointment_types?.name || "Consulta"}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {a.doctors?.name || "—"}
        </p>
      </div>

      <div className="text-gray-400">
        {a.source === "whatsapp" ? (
          <MessageSquare className="w-4 h-4" />
        ) : (
          <Phone className="w-4 h-4" />
        )}
      </div>

      <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${status.className}`}>
        {status.label}
      </span>
    </div>
  );
}
