"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, User, Phone, Stethoscope, Clock, MessageSquare, PhoneCall, Monitor } from "lucide-react";
import type { CalendarAppointment } from "@/lib/supabase/types";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Agendado",       className: "bg-blue-50 text-blue-700" },
  confirmed:  { label: "Confirmado",     className: "bg-green-50 text-green-700" },
  cancelled:  { label: "Cancelado",      className: "bg-red-50 text-red-600" },
  completed:  { label: "Realizado",      className: "bg-gray-100 text-gray-600" },
  no_show:    { label: "Não compareceu", className: "bg-orange-50 text-orange-700" },
};

interface Props {
  appointment: CalendarAppointment;
  onClose: () => void;
}

export default function AppointmentDetailModal({ appointment: a, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const status = STATUS_LABEL[a.status] ?? STATUS_LABEL.scheduled;
  const start = parseISO(a.start_datetime);
  const isFinal = a.status === "completed" || a.status === "cancelled" || a.status === "no_show";

  async function changeStatus(newStatus: string) {
    setLoading(newStatus);
    const supabase = createClient();
    await supabase.from("appointments").update({ status: newStatus }).eq("id", a.id);
    setLoading(null);
    router.refresh();
    onClose();
  }

  function ActionBtn({
    status: s,
    label,
    className,
  }: {
    status: string;
    label: string;
    className: string;
  }) {
    return (
      <button
        onClick={() => changeStatus(s)}
        disabled={loading !== null}
        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${className}`}
      >
        {loading === s ? "..." : label}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
              {status.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <DetailRow icon={<User className="w-4 h-4" />} value={a.patient_name} bold />
          <DetailRow icon={<Phone className="w-4 h-4" />} value={a.patient_phone} />
          <DetailRow
            icon={<Stethoscope className="w-4 h-4" />}
            value={a.appointment_types?.name ?? "Consulta"}
          />
          {a.doctors?.name && (
            <DetailRow icon={<User className="w-4 h-4 opacity-0" />} value={a.doctors.name} muted />
          )}
          <DetailRow
            icon={<Clock className="w-4 h-4" />}
            value={format(start, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          />
          <DetailRow
            icon={
              a.source === "whatsapp" ? (
                <MessageSquare className="w-4 h-4" />
              ) : a.source === "phone" ? (
                <PhoneCall className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )
            }
            value={
              a.source === "whatsapp" ? "WhatsApp" : a.source === "phone" ? "Telefone" : "Manual"
            }
            muted
          />
        </div>

        {/* Actions — only for non-final statuses */}
        {!isFinal && (
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium">Atualizar status</p>
            <div className="flex gap-2">
              {a.status !== "confirmed" && (
                <ActionBtn
                  status="confirmed"
                  label="Confirmar"
                  className="bg-green-50 text-green-700 hover:bg-green-100"
                />
              )}
              <ActionBtn
                status="completed"
                label="Realizado"
                className="bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
              />
            </div>
            <div className="flex gap-2">
              <ActionBtn
                status="no_show"
                label="Não compareceu"
                className="bg-orange-50 text-orange-700 hover:bg-orange-100"
              />
              <ActionBtn
                status="cancelled"
                label="Cancelar"
                className="bg-red-50 text-red-600 hover:bg-red-100"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  value,
  bold,
  muted,
}: {
  icon: React.ReactNode;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      <span
        className={`text-sm ${
          bold ? "font-semibold text-gray-900" : muted ? "text-gray-400" : "text-gray-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
