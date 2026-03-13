"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { format } from "date-fns";

interface Doctor { id: string; name: string; }
interface AppointmentType { id: string; name: string; duration_minutes: number; }

interface Props {
  clinicId: string;
  doctors: Doctor[];
  appointmentTypes: AppointmentType[];
  defaultDate?: Date; // pre-fill date when user clicks a day
  onClose: () => void;
}

export default function NewAppointmentModal({
  clinicId,
  doctors,
  appointmentTypes,
  defaultDate,
  onClose,
}: Props) {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [typeId, setTypeId] = useState(appointmentTypes[0]?.id ?? "");
  const [date, setDate] = useState(
    format(defaultDate ?? new Date(), "yyyy-MM-dd")
  );
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    const start = new Date(`${date}T${time}:00`);
    const apptType = appointmentTypes.find((t) => t.id === typeId);
    const durationMs = (apptType?.duration_minutes ?? 30) * 60000;
    const end = new Date(start.getTime() + durationMs);

    const { error: err } = await supabase.from("appointments").insert({
      clinic_id: clinicId,
      doctor_id: doctorId || null,
      patient_name: patientName.trim(),
      patient_phone: patientPhone.trim(),
      appointment_type_id: typeId || null,
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      status: "scheduled",
      source: "manual",
    });

    setSaving(false);
    if (err) {
      setError("Erro ao agendar. Tente novamente.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nova consulta</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do paciente</label>
              <input
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="João Silva"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefone / WhatsApp</label>
              <input
                required
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="5511999999999"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Médico</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Sem médico</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de consulta</label>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Sem tipo</option>
                {appointmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horário</label>
              <input
                required
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {saving ? "Agendando..." : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
